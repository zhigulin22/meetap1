import { getServerEnv } from "@/lib/env";

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

export function normalizeTelegramContact(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/i.test(raw)) return raw;
  if (/^@?[A-Za-z0-9_]{5,32}$/.test(raw)) {
    const username = raw.startsWith("@") ? raw.slice(1) : raw;
    return `@${username}`;
  }

  return null;
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

  const chatId = env.TELEGRAM_MODERATION_CHAT_ID;
  if (!chatId) {
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

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard,
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return { ok: false as const, reason: "Telegram sendMessage failed" };
  }

  return { ok: true as const };
}
