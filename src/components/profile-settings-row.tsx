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
      className="group tap-press relative flex min-h-[62px] w-full items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface2/78 px-4 py-3 text-left shadow-card backdrop-blur-xl transition duration-150 hover:border-blue/35"
    >
      <div
        className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(110deg, rgb(var(--blue-rgb) / 0.1), transparent 38%, rgb(var(--mint-rgb) / 0.1))",
        }}
      />
      <div className={`relative rounded-2xl border border-borderStrong p-2.5 ${iconToneClass ?? "bg-surface3/60 text-text2"}`}>{icon}</div>
      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em] text-text">{title}</p>
        <p className="truncate text-xs leading-5 text-text2">{subtitle}</p>
      </div>
      {badge ?? null}
      <ChevronRight className="relative h-4 w-4 text-text3 transition group-hover:text-text" />
    </Link>
  );
}
