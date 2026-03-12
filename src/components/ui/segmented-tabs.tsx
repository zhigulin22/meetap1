"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}) {
  return (
    <div className={cn("relative inline-flex rounded-[14px] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 min-w-[72px] rounded-[10px] px-3 py-1.5 text-xs font-medium transition tap-press",
              active ? "text-white" : "text-text2 hover:text-text",
            )}
          >
            {active ? (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 -z-10 rounded-[10px] border border-[rgb(var(--teal-rgb)/0.3)] bg-[image:var(--grad-primary)] shadow-[0_0_14px_rgb(var(--teal-rgb)/0.26)]"
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
