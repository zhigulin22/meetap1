"use client";

import type { ReactNode } from "react";
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
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  iconToneClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group tap-press relative flex min-h-[76px] w-full items-center gap-3 overflow-hidden rounded-[18px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] px-4 py-3 text-left shadow-soft transition duration-150"
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{ background: "linear-gradient(110deg, rgb(var(--sky-rgb) / 0.08), transparent 42%, rgb(var(--teal-rgb) / 0.08))" }} />
      <div className="absolute left-4 right-4 top-0 h-[2px] rounded-full bg-[image:var(--grad-primary)] opacity-70" />

      <div
        className={`relative flex h-11 w-11 items-center justify-center rounded-[13px] shadow-[inset_0_1px_0_rgb(255_255_255/0.65)] ${iconToneClass ?? "icon-tile"}`}
      >
        {icon}
      </div>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-text">{title}</p>
        <p className="truncate text-[13px] leading-5 text-text2">{subtitle}</p>
      </div>

      {badge ?? null}
      <ChevronRight className="relative h-4 w-4 text-text3 transition group-hover:text-text" />
    </Link>
  );
}
