import { ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";
import { buildTelegramCode } from "@/lib/telegram-code";

function normalizePhone(value: string) {
  return `+${value.replace(/\D/g, "")}`;
}

async function sendTelegramMessage(chatId: string, text: string, keyboard?: unknown) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: keyboard,
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
  const contactPhone = message.contact?.phone_number
    ? normalizePhone(String(message.contact.phone_number))
    : null;

  if (text.startsWith("/start")) {
    const token = text.split(" ")[1];

    if (!token) {
      await sendTelegramMessage(
        chatId,
        "Привет! Для подтверждения номера открой бота по ссылке из приложения Meetap после ввода телефона.",
      );
      return ok({ received: true });
    }

    const { data: verification } = await supabaseAdmin
      .from("telegram_verifications")
      .select("id, status")
      .eq("token", token)
      .maybeSingle();

    if (!verification || verification.status !== "pending") {
      await sendTelegramMessage(
        chatId,
        "Токен недействителен или уже использован. Вернись в приложение и запроси подтверждение ещё раз.",
      );
      return ok({ received: true });
    }

    await supabaseAdmin
      .from("telegram_verifications")
      .update({ telegram_user_id: telegramUserId })
      .eq("token", token)
      .eq("status", "pending");

    await sendTelegramMessage(
      chatId,
      "Подтверди номер: нажми кнопку ниже и отправь контакт.",
      {
        keyboard: [[{ text: "Поделиться номером", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    );
  }

  if (contactPhone && telegramUserId) {
    const { data } = await supabaseAdmin
      .from("telegram_verifications")
      .select("id, phone, token")
      .eq("telegram_user_id", telegramUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && normalizePhone(data.phone) === contactPhone) {
      await supabaseAdmin
        .from("telegram_verifications")
        .update({ status: "verified", verified_phone: contactPhone })
        .eq("id", data.id);

      const code = buildTelegramCode(data.token);

      await sendTelegramMessage(
        chatId,
        `✅ Номер подтвержден.\nТвой код входа в Meetap: ${code}\nВведите его на сайте в шаге \"Код из Telegram\".`,
        { remove_keyboard: true },
      );
    } else {
      await sendTelegramMessage(chatId, "❌ Этот номер не совпадает с введенным в приложении.");
    }
  }

  return ok({ received: true });
}
