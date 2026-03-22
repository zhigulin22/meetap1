"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export function ProfileSettingsLayout({
  title,
  subtitle,
  children,
  backHref = "/profile/me",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  backHref?: string;
}) {
  return (
    <PageShell>
      <div className="mb-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb)/0.98)] p-3 shadow-soft">
        <div className="flex items-start gap-3">
          <Link
            href={backHref}
            className="tap-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] text-text"
            aria-label="Назад"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1 rounded-[16px] bg-[rgb(var(--surface-2-rgb)/0.78)] px-4 py-3">
            <h1 className="font-display text-[1.2rem] font-semibold leading-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-[13px] leading-5 text-text2">{subtitle}</p> : null}
          </div>
        </div>

        <div className="mt-3 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--peach-rgb)/0.4),rgb(var(--teal-rgb)/0.4),transparent)]" />
      </div>

      <div className="space-y-3">{children}</div>
    </PageShell>
  );
}
