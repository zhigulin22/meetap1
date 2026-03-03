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
      ? "border-[rgb(var(--teal-rgb)/0.32)] bg-[rgb(var(--teal-rgb)/0.12)] text-[rgb(var(--teal-hover-rgb))]"
      : tone === "gold"
      ? "border-[rgb(var(--gold-rgb)/0.46)] bg-[rgb(var(--gold-rgb)/0.22)] text-[rgb(146,102,12)]"
      : tone === "mint"
      ? "border-[rgb(var(--teal-rgb)/0.34)] bg-[rgb(var(--teal-rgb)/0.1)] text-[rgb(var(--teal-hover-rgb))]"
      : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] text-text2";

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
