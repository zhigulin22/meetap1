import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Pill({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "teal" | "gold" | "mint";
  className?: string;
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-300/35 bg-[rgb(var(--teal-rgb)/0.16)] text-text"
      : tone === "gold"
      ? "border-gold/45 bg-[rgb(var(--gold-rgb)/0.2)] text-[rgb(var(--ivory-rgb))]"
      : tone === "mint"
      ? "border-mint/45 bg-mint/14 text-mint/95"
      : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.78)] text-text2";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}
