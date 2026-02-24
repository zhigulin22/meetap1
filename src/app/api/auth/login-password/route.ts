import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { detectDeviceLabel } from "@/lib/session";
import { supabaseAdmin } from "@/supabase/admin";

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

const schema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => {
      const cleaned = v.replace(/[\s()-]/g, "");
      return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    })
    .refine((v) => phoneRegex.test(v), "Неверный номер"),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Неверные данные", 422);
  }

  const { phone, password } = parsed.data;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id,password_hash")
    .eq("phone", phone)
    .maybeSingle();

  if (!user?.id || !user.password_hash) {
    return fail("Пользователь не найден или пароль не настроен", 404);
  }

  const valid = verifyPassword(password, user.password_hash);
  if (!valid) {
    return fail("Неверный пароль", 403);
  }

  const base = {
    httpOnly: true as const,
    secure: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };

  const store = cookies();
  store.set("meetap_user_id", user.id, base);
  store.set("meetap_verified", "1", base);

  const deviceLabel = detectDeviceLabel(req.headers.get("user-agent") ?? "");
  const ip = req.headers.get("x-forwarded-for") ?? null;

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: user.id,
      device_label: deviceLabel,
      user_agent: req.headers.get("user-agent") ?? null,
      ip,
    })
    .select("id")
    .maybeSingle();

  if (session?.id) {
    store.set("meetap_session_id", session.id, base);
  }

  return ok({ success: true });
}
