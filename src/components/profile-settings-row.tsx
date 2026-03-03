"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ProfileSettingsRow({
  href,
  icon,
  title,
  subtitle,
  badge,
  iconToneClass,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  iconToneClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[62px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] px-4 py-3 text-left shadow-[0_10px_24px_rgba(0,0,0,0.26)] backdrop-blur-xl transition duration-200 active:scale-[0.988] hover:border-white/25"
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: "linear-gradient(110deg,rgba(76,141,255,0.10),transparent 38%,rgba(82,204,131,0.10))" }} />
      <div className={`relative rounded-2xl border border-white/15 p-2.5 ${iconToneClass ?? "bg-black/15 text-muted"}`}>{icon}</div>
      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em] text-[#eef3ff]">{title}</p>
        <p className="truncate text-xs leading-5 text-[#a9b7cf]">{subtitle}</p>
      </div>
      {badge ?? null}
      <ChevronRight className="relative h-4 w-4 text-[#a5b5ce] transition group-hover:text-[#e7efff]" />
    </Link>
  );
}
