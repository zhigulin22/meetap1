type Source = "ai" | "fallback";

export type CompatibilityCacheEntry = {
  score: number;
  reason: string;
  source: Source;
  updated_at: string;
};

const CACHE_KEY = "compatibility_cache_v1";

function toProfileObject(profile: unknown): Record<string, unknown> {
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    return { ...(profile as Record<string, unknown>) };
  }
  return {};
}

function normalizeSource(value: unknown): Source {
  return value === "ai" ? "ai" : "fallback";
}

export function isMissingCompatibilityTable(errorMessage: string | null | undefined) {
  const text = (errorMessage ?? "").toLowerCase();
  return text.includes("user_compatibility") && text.includes("schema cache");
}

export function readCompatibilityCacheFromProfile(
  profile: unknown,
): Record<string, CompatibilityCacheEntry> {
  const base = toProfileObject(profile);
  const raw = base[CACHE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, CompatibilityCacheEntry> = {};
  for (const [targetUserId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const score = Number(row.score);
    const reason = String(row.reason ?? "").trim().slice(0, 3500);
    if (!reason) continue;
    const updatedAt = String(row.updated_at ?? "").trim() || new Date().toISOString();
    result[targetUserId] = {
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      reason,
      source: normalizeSource(row.source),
      updated_at: updatedAt,
    };
  }
  return result;
}

export function writeCompatibilityCacheToProfile(
  profile: unknown,
  entries: Record<string, CompatibilityCacheEntry>,
) {
  const base = toProfileObject(profile);
  const cache = readCompatibilityCacheFromProfile(base);
  const merged = { ...cache, ...entries };
  base[CACHE_KEY] = merged;
  return base;
}

export function replaceCompatibilityCacheInProfile(
  profile: unknown,
  entries: Record<string, CompatibilityCacheEntry>,
) {
  const base = toProfileObject(profile);
  base[CACHE_KEY] = { ...entries };
  return base;
}
