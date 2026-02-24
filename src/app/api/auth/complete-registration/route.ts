import { cookies } from "next/headers";
import { completeRegistrationSchema } from "@/lib/schemas";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildTelegramCode } from "@/lib/telegram-code";
import { detectDeviceLabel } from "@/lib/session";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rate = checkRateLimit(`complete-registration:${ip}`, 12, 10 * 60 * 1000);
  if (!rate.ok) {
    return fail("Too many attempts", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = completeRegistrationSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request", 422);
  }

  const { token, code, name } = parsed.data;
  const expectedCode = buildTelegramCode(token);

  if (code !== expectedCode) {
    return fail("Неверный код из Telegram", 403);
  }

  const { data: rawVerification, error: vErr } = await supabaseAdmin
    .from("telegram_verifications")
    .select("phone, status, telegram_user_id, verified_phone")
    .eq("token", token)
    .single();

  const verification = rawVerification as
    | {
        phone: string;
        status: string;
        telegram_user_id: string | null;
        verified_phone: string | null;
      }
    | null;

  if (vErr || !verification || verification.status !== "verified") {
    return fail("Phone is not verified in Telegram", 403);
  }

  const resolvedPhone = verification.verified_phone ?? verification.phone;

  const { data: existingRaw } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("phone", resolvedPhone)
    .maybeSingle();

  const existing = existingRaw as { id: string; name: string } | null;
  let userId = existing?.id;

  if (!userId) {
    if (!name || name.trim().length < 2) {
      return ok({ needsName: true });
    }

    const authEmail = `${resolvedPhone.replace(/\D/g, "")}@phone.meetap.local`;
    const password = crypto.randomUUID();

    const auth = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    userId = auth.data.user?.id ?? crypto.randomUUID();

    const { error: insertErr } = await supabaseAdmin.from("users").insert({
      id: userId,
      phone: resolvedPhone,
      name: name.trim(),
      telegram_verified: true,
      telegram_user_id: verification.telegram_user_id,
      xp: 0,
      level: 1,
    });

    if (insertErr) {
      return fail(insertErr.message, 500);
    }
  }

  if (!userId) {
    return fail("Registration failed", 500);
  }

  const cookieStore = cookies();
  const base = {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };

  cookieStore.set("meetap_user_id", userId, base);
  cookieStore.set("meetap_verified", "1", base);

  const deviceLabel = detectDeviceLabel(req.headers.get("user-agent") ?? "");
  const ipAddress = req.headers.get("x-forwarded-for") ?? null;

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: userId,
      device_label: deviceLabel,
      user_agent: req.headers.get("user-agent") ?? null,
      ip: ipAddress,
    })
    .select("id")
    .maybeSingle();

  if (session?.id) {
    cookieStore.set("meetap_session_id", session.id, base);
  }

  return ok({ userId, mode: existing ? "login" : "register" });
}
