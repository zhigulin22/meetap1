import { NextRequest } from "next/server";
import { startVerificationSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/http";
import { supabaseAdmin } from "@/supabase/admin";
import { getPublicEnv } from "@/lib/env";

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

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("telegram_verifications").insert({
    phone: parsed.data.phone,
    token,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) {
    if (
      error.message.includes("telegram_verifications") ||
      error.message.includes("schema cache")
    ) {
      return fail(
        "Не настроена база: отсутствует таблица telegram_verifications. Выполни SQL миграцию в Supabase.",
        500,
      );
    }
    return fail(error.message, 500);
  }

  const env = getPublicEnv();
  return ok({
    token,
    expiresAt,
    telegramDeepLink: `https://t.me/${env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${token}`,
  });
}
