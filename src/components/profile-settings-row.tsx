"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ProfileSettingsRow({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-border bg-surface2/70 px-4 py-3 text-left transition active:scale-[0.99] hover:border-white/20"
    >
      <div className="rounded-xl border border-white/15 bg-black/15 p-2 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{title}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      {badge ?? null}
      <ChevronRight className="h-4 w-4 text-muted transition group-hover:text-text" />
    </Link>
  );
}
