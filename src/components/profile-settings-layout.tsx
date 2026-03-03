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
      <div className="mb-4 flex items-start gap-3">
        <Link
          href={backHref}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-[#dbe6ff] shadow-[0_8px_20px_rgba(0,0,0,0.25)] backdrop-blur-xl transition active:scale-[0.98]"
          aria-label="Назад"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 backdrop-blur-xl">
          <h1 className="font-display text-[1.2rem] font-semibold leading-tight text-[#eef4ff]">{title}</h1>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-[#aebcd6]">{subtitle}</p> : null}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </PageShell>
  );
}
