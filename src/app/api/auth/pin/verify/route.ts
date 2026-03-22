import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { verifyPassword } from "@/lib/password";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  const cookieStore = cookies();
  const userId = cookieStore.get("meetap_user_id")?.value;
  if (!userId) return fail("Не авторизован", 401);

  const body = await req.json().catch(() => null);
  const pin: string = body?.pin ?? "";

  if (!/^\d{6}$/.test(pin)) return fail("PIN должен быть 6 цифр", 400);

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("pin_hash, pin_attempts, pin_locked_until")
    .eq("id", userId)
    .maybeSingle();

  if (!user || !user.pin_hash) return fail("PIN не установлен", 400);

  // Check lockout
  if (user.pin_locked_until && new Date(user.pin_locked_until) > new Date()) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуй позже.", lockedUntil: user.pin_locked_until },
      { status: 429 },
    );
  }

  const correct = verifyPassword(pin, user.pin_hash);

  if (!correct) {
    const attempts = (user.pin_attempts ?? 0) + 1;
    const update: Record<string, unknown> = { pin_attempts: attempts };
    if (attempts >= 5) {
      update.pin_locked_until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    }
    await supabaseAdmin.from("users").update(update).eq("id", userId);

    if (attempts >= 5) {
      return NextResponse.json(
        {
          error: "Превышено количество попыток. Заблокировано на 10 минут.",
          lockedUntil: update.pin_locked_until,
        },
        { status: 429 },
      );
    }
    return fail(`Неверный PIN. Осталось попыток: ${5 - attempts}`, 401);
  }

  // Success — reset counter, set session cookie
  await supabaseAdmin
    .from("users")
    .update({ pin_attempts: 0, pin_locked_until: null })
    .eq("id", userId);

  const res = NextResponse.json({ ok: true });
  // session-only (no maxAge) — браузер сбросит при закрытии
  res.cookies.set("meetap_pin_ok", "1", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
