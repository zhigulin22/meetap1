import { getServerEnv, isPlaceholderEnvValue } from "@/lib/env";

function parseChatIds(raw: string | null | undefined) {
  if (!raw) return [];
  return raw
    .split(/[;,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function sendMessage(token: string, chatId: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, ...payload }),
  });

  if (!res.ok) {
    const errorPayload = await res.json().catch(() => null);
    return { ok: false as const, reason: errorPayload?.description || "Telegram sendMessage failed" };
  }

  return { ok: true as const };
}

export async function sendStudentVerificationToTelegramModeration(input: {
  id: string;
  userId: string;
  university: string | null;
  studentIdNumber: string | null;
  fileUrl: string | null;
  storagePath: string;
}) {
  const env = getServerEnv();

  if (env.APP_ENV === "local" && env.TELEGRAM_MODERATION_MOCK) {
    return { ok: true as const, reason: "mocked in local mode", mock: true };
  }

  if (isPlaceholderEnvValue(env.TELEGRAM_BOT_TOKEN)) {
    return { ok: false as const, reason: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const chatIds = parseChatIds(env.TELEGRAM_MODERATION_CHAT_ID);
  if (!chatIds.length) {
    return { ok: false as const, reason: "TELEGRAM_MODERATION_CHAT_ID is missing" };
  }

  const lines = [
    `🎓 <b>Верификация студента</b>`,
    "",
    `ID заявки: <code>${input.id}</code>`,
    `User: <code>${input.userId}</code>`,
    `ВУЗ: ${input.university || "—"}`,
    `Студбилет №: ${input.studentIdNumber || "—"}`,
    `Фото: ${input.fileUrl || "—"}`,
    `Storage path: <code>${input.storagePath}</code>`,
  ];

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `studentver:approve:${input.id}` },
        { text: "❌ Отклонить", callback_data: `studentver:reject:${input.id}` },
      ],
    ],
  };

  const payload = {
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: inlineKeyboard,
  };

  let lastError: string | null = null;
  const delivered: string[] = [];

  for (const chatId of chatIds) {
    try {
      const res = await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, payload);
      if (res.ok) delivered.push(chatId);
      else lastError = res.reason ?? lastError;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  if (!delivered.length) {
    return { ok: false as const, reason: lastError ?? "Telegram sendMessage failed" };
  }

  return { ok: true as const, delivered };
}
