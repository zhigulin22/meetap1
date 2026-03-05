import { fail } from "@/lib/http";

type RateWindow = {
  count: number;
  resetAt: number;
};

const rateStore = new Map<string, RateWindow>();
const concurrencyStore = new Map<string, number>();

export function clientKeyFromRequest(req: Request, fallback = "anonymous") {
  const xfwd = req.headers.get("x-forwarded-for") || "";
  const ip = xfwd.split(",")[0]?.trim();
  if (ip) return ip;
  return req.headers.get("x-real-ip") || fallback;
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (current.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  rateStore.set(key, current);
  return { ok: true, retryAfterSec: 0 };
}

export async function withConcurrencyLimit<T>(key: string, max: number, fn: () => Promise<T>): Promise<T> {
  const active = concurrencyStore.get(key) ?? 0;
  if (active >= max) {
    throw new Error(`BUSY:${key}`);
  }

  concurrencyStore.set(key, active + 1);
  try {
    return await fn();
  } finally {
    const next = (concurrencyStore.get(key) ?? 1) - 1;
    if (next <= 0) concurrencyStore.delete(key);
    else concurrencyStore.set(key, next);
  }
}

export function busyResponse(endpoint: string) {
  return fail("Сервер занят. Повтори через 1-2 секунды.", 503, {
    code: "TIMEOUT",
    endpoint,
    hint: "Автоповтор включен; при частых ошибках открой diagnostics",
  });
}
