"use client";

import {
  CalendarCheck,
  Camera,
  Clock3,
  Compass,
  Flame,
  Gem,
  Globe2,
  Handshake,
  Image,
  Leaf,
  MapPin,
  Medal,
  MessageCircle,
  Milestone,
  Monitor,
  PenSquare,
  Rocket,
  Send,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Trophy,
  Video,
  Zap,
} from "lucide-react";

const ICONS = {
  CalendarCheck,
  Camera,
  Clock3,
  Compass,
  Flame,
  Gem,
  Globe2,
  Handshake,
  Image,
  Leaf,
  MapPin,
  Medal,
  MessageCircle,
  Milestone,
  Monitor,
  PenSquare,
  Rocket,
  Send,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Trophy,
  Video,
  Zap,
} as const;

const RARITY_GRADIENT: Record<string, string> = {
  common: "linear-gradient(135deg,rgb(var(--text-2-rgb) / 0.22),rgb(var(--text-3-rgb) / 0.18))",
  rare: "linear-gradient(135deg,rgb(var(--badge-aqua-rgb, 46 211 183) / 0.34),rgb(var(--sky-rgb) / 0.24))",
  epic: "linear-gradient(135deg,rgb(var(--violet-rgb) / 0.42),rgb(var(--sky-rgb) / 0.28))",
  legendary: "linear-gradient(135deg,rgb(var(--violet-rgb) / 0.45),rgb(var(--citrus-rgb) / 0.4))",
};

export function BadgeIcon({
  name,
  rarity,
  earned,
  className,
}: {
  name: string | null | undefined;
  rarity: string;
  earned: boolean;
  className?: string;
}) {
  const Icon = (name ? (ICONS as Record<string, typeof Medal>)[name] : null) ?? Medal;
  const background = RARITY_GRADIENT[rarity] ?? RARITY_GRADIENT.common;

  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-borderStrong ${className ?? ""}`}
      style={{
        background,
        filter: earned ? "none" : "grayscale(0.8) saturate(0.45)",
        opacity: earned ? 1 : 0.7,
      }}
    >
      <Icon className="h-6 w-6 text-text" strokeWidth={2} />
    </span>
  );
}
