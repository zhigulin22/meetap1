import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  AI_SERVICE_URL: z.string().url().default("http://127.0.0.1:8000"),
  FACE_DETECT_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.35),
});

let publicCache: z.infer<typeof publicSchema> | null = null;
let serverCache: z.infer<typeof serverSchema> | null = null;

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
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "placeholder-telegram",
    TELEGRAM_WEBHOOK_SECRET:
      process.env.TELEGRAM_WEBHOOK_SECRET ?? "placeholder-secret",
    AI_SERVICE_URL: process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8000",
    FACE_DETECT_MIN_CONFIDENCE: process.env.FACE_DETECT_MIN_CONFIDENCE ?? "0.35",
  };

  const parsed = serverSchema.parse(source);
  serverCache = parsed;
  return serverCache;
}
