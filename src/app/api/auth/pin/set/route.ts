import { cookies } from "next/headers";
import { supabaseAdmin } from "@/supabase/admin";
import { hashPassword } from "@/lib/password";
import { ok, fail } from "@/lib/http";

export async function POST(req: Request) {
  const cookieStore = cookies();
  const userId = cookieStore.get("meetap_user_id")?.value;
  if (!userId) return fail("Не авторизован", 401);

  const body = await req.json().catch(() => null);
  const pin: string = body?.pin ?? "";

  if (!/^\d{6}$/.test(pin)) return fail("PIN должен быть 6 цифр", 400);

  const pin_hash = hashPassword(pin);

  const { error } = await supabaseAdmin
    .from("users")
    .update({ pin_hash, pin_attempts: 0, pin_locked_until: null })
    .eq("id", userId);

  if (error) return fail("Ошибка сохранения PIN", 500);

  return ok({ ok: true });
}
