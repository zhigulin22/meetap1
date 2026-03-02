"use client";

import { PROFILE_EMOJI_PRESETS, resolveEmojiConfig } from "@/lib/profile-style";

export function ProfileEmojiBadge({
  value,
  size = "md",
}: {
  value: unknown;
  size?: "sm" | "md";
}) {
  const config = resolveEmojiConfig(value);
  if (!config) return null;

  const base = size === "sm" ? "h-6 w-6 text-[11px]" : "h-7 w-7 text-xs";

  if (config.type === "preset") {
    const preset = PROFILE_EMOJI_PRESETS.find((x) => x.id === config.id);
    if (!preset) return null;

    return (
      <span
        className={`${base} inline-flex items-center justify-center rounded-full border border-white/30 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]`}
        style={{ background: preset.bg }}
        title={preset.label}
      >
        {preset.glyph}
      </span>
    );
  }

  return (
    <span
      className={`${base} inline-flex items-center justify-center rounded-full border border-white/30 text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]`}
      style={{ background: config.color }}
      title="Custom emoji"
    >
      {config.glyph}
    </span>
  );
}
