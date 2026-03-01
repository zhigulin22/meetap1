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
      <div className="mb-3 flex items-start gap-3">
        <Link
          href={backHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface2/80 text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-semibold text-text">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
      </div>

      {children}
    </PageShell>
  );
}
