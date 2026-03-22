import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { detectDeviceLabel } from "@/lib/session";
import { supabaseAdmin } from "@/supabase/admin";
import { trackEvent } from "@/server/analytics";

const phoneRegex = /^\+?[1-9]\d{9,14}$/;
const usernameRegex = /^[a-z0-9_]{3,30}$/;

const schema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Неверные данные", 422);
  }

  const { login, password } = parsed.data;

  const cleaned = login.replace(/[\s()-]/g, "");
  const isPhone = phoneRegex.test(cleaned.startsWith("+") ? cleaned : `+${cleaned}`);
  const isUsername = usernameRegex.test(login.toLowerCase());

  if (!isPhone && !isUsername) {
    return fail("Введи номер телефона или имя пользователя", 422);
  }

  let user: { id: string; password_hash: string | null; is_blocked?: boolean; blocked_until?: string | null; deleted_at?: string | null } | null = null;

  if (isPhone) {
    const phone = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,password_hash,is_blocked,blocked_until,deleted_at")
      .eq("phone", phone)
      .maybeSingle();
    user = data;
  } else {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id,password_hash,is_blocked,blocked_until,deleted_at")
      .eq("username", login.toLowerCase())
      .maybeSingle();
    user = data;
  }

  if (!user?.id || !user.password_hash) {
    return fail("Пользователь не найден или пароль не настроен", 404);
  }

  const blockedUntil = user.blocked_until ? new Date(user.blocked_until).getTime() : null;
  const blocked = Boolean(user.is_blocked) && (!blockedUntil || blockedUntil > Date.now());

  if (blocked || user.deleted_at) {
    return fail("Аккаунт ограничен", 403);
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
    maxAge: 60 * 60 * 24 * 180,
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

  await trackEvent({ eventName: "login_password", userId: user.id, path: "/login" });

  return ok({ success: true });
}