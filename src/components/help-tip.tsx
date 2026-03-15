"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

export function HelpTip({
  title,
  body,
  why,
  influence,
  normal,
  next,
  compact = false,
}: {
  title: string;
  body: string;
  why: string;
  influence: string;
  normal: string;
  next: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface2/80 text-muted transition hover:text-text active:scale-[0.96]"
        aria-label="Что это значит"
        title="Что это значит"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className={`absolute z-40 ${compact ? "right-0 top-6 w-72" : "left-0 top-7 w-[360px]"}`}>
          <div className="rounded-2xl border border-border bg-surface p-3 text-xs shadow-soft">
            <p className="font-medium text-text">{title}</p>
            <p className="mt-1 text-muted">{body}</p>
            <p className="mt-2 text-text"><span className="text-muted">Зачем:</span> {why}</p>
            <p className="mt-1 text-text"><span className="text-muted">Как влиять:</span> {influence}</p>
            <p className="mt-1 text-text"><span className="text-muted">Норма:</span> {normal}</p>
            <p className="mt-1 text-cyan"><span className="text-muted">Дальше:</span> {next}</p>
          </div>
        </div>
      ) : null}
    </span>
  );
}
