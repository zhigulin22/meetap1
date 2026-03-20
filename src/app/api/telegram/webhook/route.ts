import { ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { buildTelegramCode } from "@/lib/telegram-code";
import { getServerEnv } from "@/lib/env";

async function sendTelegramMessage(chatId: string, text: string) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const message = payload?.message;

  if (!message) {
    return ok({ received: true });
  }

  const telegramUserId = String(message.from?.id ?? "");
  const chatId = String(message.chat?.id ?? telegramUserId);
  const text = String(message.text ?? "").trim();

  if (!text.startsWith("/start")) {
    await sendTelegramMessage(
      chatId,
      "Открой регистрацию в Meetap, введи номер и нажми подтверждение. Я пришлю код автоматически.",
    );
    return ok({ received: true });
  }

  const token = text.split(" ")[1];

  if (!token) {
    await sendTelegramMessage(
      chatId,
      "Чтобы получить код, сначала введи номер в приложении Meetap и нажми подтверждение.",
    );
    return ok({ received: true });
  }

  const { data: verification } = await supabaseAdmin
    .from("telegram_verifications")
    .select("id, phone, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!verification || verification.status !== "pending") {
    await sendTelegramMessage(
      chatId,
      "Токен не найден или уже использован. Запроси новый код в приложении.",
    );
    return ok({ received: true });
  }

  if (new Date(verification.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("telegram_verifications")
      .update({ status: "expired" })
      .eq("id", verification.id);

    await sendTelegramMessage(
      chatId,
      "Время кода вышло. Вернись в приложение и запроси код заново.",
    );
    return ok({ received: true });
  }

  await supabaseAdmin
    .from("telegram_verifications")
    .update({
      status: "verified",
      telegram_user_id: telegramUserId,
      verified_phone: verification.phone,
    })
    .eq("id", verification.id)
    .eq("status", "pending");

  const code = buildTelegramCode(token);

  await sendTelegramMessage(
    chatId,
    `Код для входа в Meetap: <b>${code}</b>\nДействует 10 минут. Введи его на шаге "Код".`,
  );

  return ok({ received: true });
}
