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
      ? "border-[rgb(var(--teal-rgb)/0.32)] bg-[rgb(var(--teal-rgb)/0.14)] text-[rgb(var(--text-rgb))]"
      : tone === "gold"
      ? "border-[rgb(var(--gold-rgb)/0.5)] bg-[rgb(var(--gold-rgb)/0.24)] text-[rgb(var(--text-rgb))]"
      : tone === "mint"
      ? "border-[rgb(var(--sky-rgb)/0.35)] bg-[rgb(var(--sky-rgb)/0.14)] text-[rgb(var(--text-rgb))]"
      : "border-[rgb(var(--teal-rgb)/0.28)] bg-[rgb(var(--teal-rgb)/0.12)] text-[rgb(var(--text-rgb))]";

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
