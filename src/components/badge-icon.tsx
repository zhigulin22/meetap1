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
  common: "linear-gradient(135deg,rgba(142,163,204,0.35),rgba(126,148,196,0.26))",
  rare: "linear-gradient(135deg,rgba(76,141,255,0.38),rgba(109,182,255,0.22))",
  epic: "linear-gradient(135deg,rgba(82,204,131,0.34),rgba(76,141,255,0.26))",
  legendary: "linear-gradient(135deg,rgba(255,176,32,0.40),rgba(76,141,255,0.30))",
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
      className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 ${className ?? ""}`}
      style={{
        background,
        filter: earned ? "none" : "grayscale(0.78) saturate(0.55)",
        opacity: earned ? 1 : 0.72,
      }}
    >
      <Icon className="h-6 w-6 text-[#edf3ff]" strokeWidth={2} />
    </span>
  );
}
