import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TopBar({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[1.68rem] font-semibold tracking-[-0.02em] text-text">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-text2">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
