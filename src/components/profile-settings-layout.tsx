"use client";

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
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <PageShell>
      <div className="mb-4 rounded-[22px] border border-border bg-[linear-gradient(160deg,rgb(var(--surface-2-rgb)/0.9),rgb(var(--surface-3-rgb)/0.78))] p-3 shadow-card">
        <div className="mb-2 flex items-start gap-3">
          <Link
            href={backHref}
            className="tap-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border bg-[rgb(var(--surface-2-rgb)/0.95)] text-text shadow-card backdrop-blur-xl"
            aria-label="Назад"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0 flex-1 rounded-[14px] border border-border bg-[rgb(var(--surface-1-rgb)/0.68)] px-4 py-3 backdrop-blur-xl">
            <h1 className="font-display text-[1.22rem] font-semibold leading-tight text-text">{title}</h1>
            {subtitle ? <p className="mt-1 text-xs leading-5 text-text2">{subtitle}</p> : null}
          </div>
        </div>

        <div className="h-px bg-[linear-gradient(90deg,transparent,rgb(var(--blue-rgb)/0.35),transparent)]" />
      </div>

      <div className="space-y-3">{children}</div>
    </PageShell>
  );
}
