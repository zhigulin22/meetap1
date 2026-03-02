export const PROFILE_COLOR_THEMES = [
  { id: "midnight", label: "Midnight", gradient: "linear-gradient(130deg,#08142F,#10244A)" },
  { id: "ocean", label: "Ocean", gradient: "linear-gradient(130deg,#051a33,#0d3a58)" },
  { id: "graphite", label: "Graphite", gradient: "linear-gradient(130deg,#151b2b,#1f2d46)" },
  { id: "aurora", label: "Aurora", gradient: "linear-gradient(130deg,#0f2440,#1f3f6d)" },
  { id: "cobalt", label: "Cobalt", gradient: "linear-gradient(130deg,#0B1D47,#183A7A)" },
] as const;

export const PROFILE_EMOJI_PRESETS = [
  { id: "orbit", label: "Orbit", glyph: "◉", bg: "linear-gradient(135deg,#1f3f78,#6b9cff)" },
  { id: "pulse", label: "Pulse", glyph: "✦", bg: "linear-gradient(135deg,#26406b,#66b4ff)" },
  { id: "forge", label: "Forge", glyph: "⬢", bg: "linear-gradient(135deg,#2f3447,#63708e)" },
  { id: "stream", label: "Stream", glyph: "≈", bg: "linear-gradient(135deg,#0f3f57,#4fb3d8)" },
  { id: "focus", label: "Focus", glyph: "◇", bg: "linear-gradient(135deg,#2d3b69,#8aa2ff)" },
  { id: "spark", label: "Spark", glyph: "✷", bg: "linear-gradient(135deg,#1c365f,#5e8ee6)" },
] as const;

export type ProfileEmojiConfig =
  | { type: "preset"; id: string }
  | { type: "custom"; glyph: string; color: string }
  | null;

export function getThemeGradient(themeId: string | null | undefined) {
  const found = PROFILE_COLOR_THEMES.find((t) => t.id === themeId);
  return found?.gradient ?? PROFILE_COLOR_THEMES[0].gradient;
}

export function getThemeId(themeId: string | null | undefined) {
  const found = PROFILE_COLOR_THEMES.find((t) => t.id === themeId);
  return found?.id ?? PROFILE_COLOR_THEMES[0].id;
}

export function resolveEmojiConfig(raw: unknown): ProfileEmojiConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;

  if (value.type === "preset" && typeof value.id === "string") {
    return { type: "preset", id: value.id };
  }

  if (value.type === "custom" && typeof value.glyph === "string" && typeof value.color === "string") {
    return { type: "custom", glyph: value.glyph.slice(0, 2), color: value.color };
  }

  return null;
}
