import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_MODERATION_CHAT_ID: z.string().default(""),
  FACE_DETECT_MODEL: z.string().min(1).default("gpt-4o-mini"),
  FACE_DETECT_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.35),
  QA_BOTS_CONTROL_TOKEN: z.string().min(1).default("qa-bots-control-disabled"),
  QA_BOTS_PASSWORD: z.string().min(8).default("QaBots!2026"),
  DEMO_AUTH_ENABLED: z.coerce.boolean().default(false),
});

let publicCache: z.infer<typeof publicSchema> | null = null;
let serverCache: z.infer<typeof serverSchema> | null = null;

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
    FACE_DETECT_MODEL: process.env.FACE_DETECT_MODEL ?? "gpt-4o-mini",
    FACE_DETECT_MIN_CONFIDENCE: process.env.FACE_DETECT_MIN_CONFIDENCE ?? "0.35",
    QA_BOTS_CONTROL_TOKEN:
      process.env.QA_BOTS_CONTROL_TOKEN ?? "qa-bots-control-disabled",
    QA_BOTS_PASSWORD: process.env.QA_BOTS_PASSWORD ?? "QaBots!2026",
    DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED ?? "false",
  };

  const parsed = serverSchema.parse(source);
  serverCache = parsed;
  return serverCache;
}
