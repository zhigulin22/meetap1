export const PROFILE_COLOR_THEMES = [
  { id: "midnight", label: "Midnight", gradient: "linear-gradient(140deg,#0B1020,#152646 56%,#1E335D)" },
  { id: "aurora", label: "Aurora", gradient: "linear-gradient(140deg,#111A34,#1A3766 55%,#2B5E87)" },
  { id: "electric", label: "Electric", gradient: "linear-gradient(140deg,#0F1B3D,#2858A7 58%,#4C8DFF)" },
  { id: "mintwave", label: "Mintwave", gradient: "linear-gradient(140deg,#0E1B32,#1F3E64 52%,#52CC83)" },
  { id: "sunset", label: "Sunset", gradient: "linear-gradient(140deg,#1A233F,#304E8A 56%,#FFB020)" },
] as const;

export const PROFILE_EMOJI_PRESETS = [
  { id: "orbit", label: "Orbit", glyph: "◉", bg: "linear-gradient(135deg,#24417a,#4C8DFF)" },
  { id: "spark", label: "Spark", glyph: "✦", bg: "linear-gradient(135deg,#2b5f99,#56b7ff)" },
  { id: "mint", label: "Mint", glyph: "❖", bg: "linear-gradient(135deg,#2d6c62,#52CC83)" },
  { id: "pulse", label: "Pulse", glyph: "◈", bg: "linear-gradient(135deg,#3a4f83,#879cff)" },
  { id: "sun", label: "Sun", glyph: "✺", bg: "linear-gradient(135deg,#6b4e24,#FFB020)" },
  { id: "wave", label: "Wave", glyph: "≈", bg: "linear-gradient(135deg,#255173,#5dc4ff)" },
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
