import { NextRequest } from "next/server";
import { startVerificationSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { buildTelegramCode } from "@/lib/telegram-code";
import { trackEvent } from "@/server/analytics";

async function sendTelegramMessage(chatId: string, text: string) {
  const env = getServerEnv();
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => null);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rate = checkRateLimit(`start-verification:${ip}`, 5, 10 * 60 * 1000);
  if (!rate.ok) {
    return fail("Слишком много попыток. Попробуй позже", 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = startVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Неверные данные", 422);
  }

  const phone = parsed.data.phone;
  const token = crypto.randomUUID();
  const code = buildTelegramCode(token);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("telegram_verifications").insert({
    phone,
    token,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    if (error.message.includes("telegram_verifications") || error.message.includes("schema cache")) {
      return fail(
        "Не настроена база: отсутствует таблица telegram_verifications. Выполни SQL миграцию в Supabase.",
        500,
      );
    }
    return fail(error.message, 500);
  }

  await trackEvent({ eventName: "register_started", path: "/register", properties: { phonePrefix: phone.slice(0, 4) } });

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("telegram_user_id,id")
    .eq("phone", phone)
    .maybeSingle();

  let immediate = false;
  const chatId = existing?.telegram_user_id ? String(existing.telegram_user_id) : null;

  if (chatId) {
    immediate = true;
    await supabaseAdmin
      .from("telegram_verifications")
      .update({ status: "verified", telegram_user_id: chatId, verified_phone: phone })
      .eq("token", token)
      .eq("status", "pending");

    await sendTelegramMessage(chatId, `Код входа в Meetap: ${code}\nСрок действия 10 минут.`);
    await trackEvent({ eventName: "telegram_verified", userId: existing?.id, path: "/register", properties: { immediate: true } });
  }

  const env = getPublicEnv();

  return ok({
    token,
    expiresAt,
    immediate,
    telegramDeepLink: `https://t.me/${env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${token}`,
  });
}
