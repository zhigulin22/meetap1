import { getServerEnv, isPlaceholderEnvValue } from "@/lib/env";

type SubmissionPreview = {
  id: string;
  title: string;
  category: string;
  city: string;
  address: string;
  startsAt: string;
  endsAt?: string | null;
  mode: string;
  isPaid: boolean;
  price?: number | null;
  paymentUrl?: string | null;
  paymentNote?: string | null;
  telegramContact: string;
  organizerPhone?: string | null;
  shortDescription: string;
  fullDescription: string;
  coverUrls: string[];
  userId?: string | null;
  userName?: string | null;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toLocaleString("ru-RU");
}

function parseChatIds(raw: string | null | undefined) {
  if (!raw) return [];
  return raw
    .split(/[;,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeTelegramContact(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(raw)) return raw;
  if (/^t\.me\//i.test(raw)) return `https://${raw}`;
  if (raw.startsWith("@") && raw.length >= 3) return raw;
  if (!raw.startsWith("@") && raw.length >= 3) return `@${raw}`;

  return null;
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

export async function sendEventSubmissionToTelegramModerationBot(input: SubmissionPreview) {
  const env = getServerEnv();

  if (env.APP_ENV === "local" && env.TELEGRAM_MODERATION_MOCK) {
    return {
      ok: true as const,
      reason: "mocked in local mode",
      mock: true,
    };
  }

  if (isPlaceholderEnvValue(env.TELEGRAM_BOT_TOKEN)) {
    return { ok: false as const, reason: "TELEGRAM_BOT_TOKEN is missing" };
  }

  const chatIds = parseChatIds(env.TELEGRAM_MODERATION_CHAT_ID);
  if (!chatIds.length) {
    return { ok: false as const, reason: "TELEGRAM_MODERATION_CHAT_ID is missing" };
  }

  const lines = [
    `🧭 <b>Новая заявка события (комьюнити)</b>`,
    "",
    `ID: <code>${input.id}</code>`,
    `Название: <b>${input.title}</b>`,
    `Категория: ${input.category}`,
    `Тип: ${input.mode}`,
    `Дата/время: ${fmtDate(input.startsAt)}${input.endsAt ? ` → ${fmtDate(input.endsAt)}` : ""}`,
    `Город/место: ${input.city}, ${input.address}`,
    `Оплата: ${input.isPaid ? `Платно${input.price ? ` · ${input.price}₽` : ""}` : "Бесплатно"}`,
    `Ссылка на оплату: ${input.paymentUrl || "—"}`,
    `Комментарий по оплате: ${input.paymentNote || "—"}`,
    `Telegram организатора: ${input.telegramContact}`,
    `Телефон: ${input.organizerPhone || "—"}` ,
    `Пользователь: ${input.userName || "—"} (${input.userId || "—"})`,
    "",
    `<b>Кратко:</b> ${input.shortDescription}`,
    `<b>Полное:</b> ${input.fullDescription}`,
    "",
    `<b>Обложки:</b>`,
    ...(input.coverUrls.length ? input.coverUrls.map((u) => `• ${u}`) : ["• —"]),
  ];

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `eventmod:approve:${input.id}` },
        { text: "❌ Отклонить", callback_data: `eventmod:reject:${input.id}` },
      ],
      [{ text: "🟨 Запросить уточнение", callback_data: `eventmod:need_info:${input.id}` }],
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
      if (res.ok) {
        delivered.push(chatId);
      } else {
        lastError = res.reason ?? lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  if (!delivered.length) {
    return { ok: false as const, reason: lastError ?? "Telegram sendMessage failed" };
  }

  return { ok: true as const, delivered };
}
