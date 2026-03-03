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
      className="group tap-press relative flex min-h-[66px] w-full items-center gap-3 overflow-hidden rounded-[18px] border border-border bg-[rgb(var(--surface-2-rgb)/0.86)] px-4 py-3 text-left shadow-card backdrop-blur-xl transition duration-150 hover:border-[rgb(var(--blue-rgb)/0.28)]"
    >
      <div
        className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(110deg, rgb(var(--blue-rgb) / 0.09), transparent 38%, rgb(var(--mint-rgb) / 0.08))",
        }}
      />
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/12 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)] ${iconToneClass ?? "bg-surface3/60 text-text2"}`}
      >
        {icon}
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em] text-text">{title}</p>
        <p className="truncate text-xs leading-5 text-text2">{subtitle}</p>
      </div>
      {badge ?? null}
      <ChevronRight className="relative h-4 w-4 text-text3 transition group-hover:text-text" />
    </Link>
  );
}
