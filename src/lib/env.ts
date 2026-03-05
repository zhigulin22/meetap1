import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1),
});

const serverSchema = z.object({
  APP_ENV: z.enum(["local", "vercel"]).default("vercel"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_MODERATION_CHAT_ID: z.string().default(""),
  TELEGRAM_MODERATION_MOCK: z.coerce.boolean().default(false),
  FACE_DETECT_MODEL: z.string().min(1).default("gpt-4o-mini"),
  FACE_DETECT_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.35),
  QA_BOTS_CONTROL_TOKEN: z.string().min(1).default("qa-bots-control-disabled"),
  QA_BOTS_PASSWORD: z.string().min(8).default("QaBots!2026"),
  DEMO_AUTH_ENABLED: z.coerce.boolean().default(false),
  YANDEX_TICKETS_AUTH: z.string().default(""),
  YANDEX_TICKETS_BASE_URL: z.string().url().default("https://api.tickets.yandex.net"),
  YANDEX_TICKETS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(20000).default(5500),
  CRON_SECRET: z.string().default(""),
});

let publicCache: z.infer<typeof publicSchema> | null = null;
let serverCache: z.infer<typeof serverSchema> | null = null;

const PLACEHOLDER_RE = /(placeholder|your_|change_me|dummy|example|test[_-]?key|not-set)/i;

export function isPlaceholderEnvValue(value: string | null | undefined) {
  if (!value) return true;
  const v = String(value).trim();
  if (!v) return true;
  return PLACEHOLDER_RE.test(v);
}

function decodeBase64(value: string | undefined | null) {
  if (!value) return null;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function resolveSecret(params: {
  plain?: string;
  b64?: string;
  placeholder?: string;
}) {
  const plain = params.plain?.trim();
  if (plain && (!params.placeholder || plain !== params.placeholder)) return plain;

  const decoded = decodeBase64(params.b64);
  if (decoded?.trim()) return decoded.trim();

  return params.placeholder ?? "";
}

export function getPublicEnv() {
  if (publicCache) return publicCache;

  const source = {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "placeholder_bot",
  };

  const parsed = publicSchema.parse(source);
  publicCache = parsed;
  return publicCache;
}

export function getServerEnv() {
  if (serverCache) return serverCache;

  const source = {
    APP_ENV: process.env.APP_ENV ?? "vercel",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "placeholder-openai",
    TELEGRAM_BOT_TOKEN: resolveSecret({
      plain: process.env.TELEGRAM_BOT_TOKEN,
      b64: process.env.TELEGRAM_BOT_TOKEN_B64,
      placeholder: "placeholder-telegram",
    }),
    TELEGRAM_WEBHOOK_SECRET:
      process.env.TELEGRAM_WEBHOOK_SECRET ?? "placeholder-secret",
    TELEGRAM_MODERATION_CHAT_ID: resolveSecret({
      plain: process.env.TELEGRAM_MODERATION_CHAT_ID,
      b64: process.env.TELEGRAM_MODERATION_CHAT_ID_B64,
      placeholder: "",
    }),
    TELEGRAM_MODERATION_MOCK: process.env.TELEGRAM_MODERATION_MOCK ?? "false",
    FACE_DETECT_MODEL: process.env.FACE_DETECT_MODEL ?? "gpt-4o-mini",
    FACE_DETECT_MIN_CONFIDENCE: process.env.FACE_DETECT_MIN_CONFIDENCE ?? "0.35",
    QA_BOTS_CONTROL_TOKEN:
      process.env.QA_BOTS_CONTROL_TOKEN ?? "qa-bots-control-disabled",
    QA_BOTS_PASSWORD: process.env.QA_BOTS_PASSWORD ?? "QaBots!2026",
    DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED ?? "false",
    YANDEX_TICKETS_AUTH: process.env.YANDEX_TICKETS_AUTH ?? "",
    YANDEX_TICKETS_BASE_URL: process.env.YANDEX_TICKETS_BASE_URL ?? "https://api.tickets.yandex.net",
    YANDEX_TICKETS_TIMEOUT_MS: process.env.YANDEX_TICKETS_TIMEOUT_MS ?? "5500",
    CRON_SECRET: process.env.CRON_SECRET ?? "",
  };

  const parsed = serverSchema.parse(source);
  serverCache = parsed;
  return serverCache;
}

export function getEnvReadiness() {
  const pub = getPublicEnv();
  const sec = getServerEnv();

  return {
    public: {
      supabaseUrl: !isPlaceholderEnvValue(pub.NEXT_PUBLIC_SUPABASE_URL),
      anonKey: !isPlaceholderEnvValue(pub.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      telegramUsername: !isPlaceholderEnvValue(pub.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME),
    },
    server: {
      serviceRole: !isPlaceholderEnvValue(sec.SUPABASE_SERVICE_ROLE_KEY),
      openai: !isPlaceholderEnvValue(sec.OPENAI_API_KEY),
      telegramToken: !isPlaceholderEnvValue(sec.TELEGRAM_BOT_TOKEN),
      telegramWebhookSecret: !isPlaceholderEnvValue(sec.TELEGRAM_WEBHOOK_SECRET),
      telegramModerationChatId: !isPlaceholderEnvValue(sec.TELEGRAM_MODERATION_CHAT_ID),
      yandexTicketsAuth: !isPlaceholderEnvValue(sec.YANDEX_TICKETS_AUTH),
    },
  };
}
