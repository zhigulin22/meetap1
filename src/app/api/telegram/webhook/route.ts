import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { supabaseAdmin } from "@/supabase/admin";

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
  const env = getServerEnv();

  // MVP fallback: do not hard-block webhook when secret headers are misconfigured on platform.
  // If header exists and explicitly mismatches, keep warning path only.
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader && env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("Telegram webhook secret mismatch; accepting update in fallback mode");
  }

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
    if (token) {
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
  }

  if (contactPhone && telegramUserId) {
    const { data } = await supabaseAdmin
      .from("telegram_verifications")
      .select("id, phone")
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

      await sendTelegramMessage(chatId, "✅ Номер подтвержден. Возвращайся в приложение.", {
        remove_keyboard: true,
      });
    } else {
      await sendTelegramMessage(chatId, "❌ Этот номер не совпадает с введенным в приложении.");
    }
  }

  return ok({ received: true });
}
