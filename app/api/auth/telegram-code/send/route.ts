import { supabaseAdmin } from "@/supabase/admin";
import { ok, fail } from "@/lib/http";
import { randomUUID } from "crypto";
import { buildTelegramCode } from "@/lib/telegram-code";

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone: string = body?.phone ?? "";

  const cleaned = phone.replace(/[\s()-]/g, "");
  const normalized = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;

  if (!phoneRegex.test(normalized)) {
    return fail("Неверный формат номера телефона", 400);
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!botUsername) return fail("Telegram Bot не настроен", 500);

  // Expire old pending verifications for this phone
  await supabaseAdmin
    .from("telegram_verifications")
    .update({ status: "expired" })
    .eq("phone", normalized)
    .eq("status", "pending");

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("telegram_verifications")
    .insert({ phone: normalized, token, status: "pending", expires_at: expiresAt });

  if (error) {
    console.error("[telegram-code/send] DB insert error:", error.message);
    return fail("Ошибка создания верификации", 500);
  }

  const botLink = `https://t.me/${botUsername}?start=${token}`;

  // Look up known telegram_user_id for this phone (users table first, then previous verifications)
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("telegram_user_id")
    .eq("phone", normalized)
    .maybeSingle();

  let knownTelegramId: string | null = userRow?.telegram_user_id ?? null;

  if (!knownTelegramId) {
    const { data: prevVerif } = await supabaseAdmin
      .from("telegram_verifications")
      .select("telegram_user_id")
      .eq("phone", normalized)
      .not("telegram_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    knownTelegramId = prevVerif?.telegram_user_id ?? null;
  }

  if (knownTelegramId) {
    const code = buildTelegramCode(token);
    await sendTelegramMessage(
      knownTelegramId,
      `Код для входа в Meetap: <b>${code}</b>\nДействует 30 минут. Введи его в приложении.`,
    );
    // Mark as verified since we already know the user's Telegram identity
    // Extend expiry to 30 min so onboarding has enough time
    await supabaseAdmin
      .from("telegram_verifications")
      .update({
        status: "verified",
        telegram_user_id: knownTelegramId,
        verified_phone: normalized,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .eq("token", token);

    return ok({ ok: true, botLink, botUsername, sentDirectly: true });
  }

  return ok({ ok: true, botLink, botUsername, sentDirectly: false });
}
