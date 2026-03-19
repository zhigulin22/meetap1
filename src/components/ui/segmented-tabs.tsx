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
    <div
      className={cn(
        "relative inline-flex rounded-full border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.92)] p-1.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 min-w-[96px] rounded-full px-5 py-2 text-sm font-semibold transition tap-press",
              active ? "text-white" : "text-text2 hover:text-text",
            )}
          >
            {active ? (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 -z-10 rounded-full border border-[rgb(var(--teal-rgb)/0.28)] bg-[image:var(--grad-primary)] shadow-[0_0_18px_rgb(var(--teal-rgb)/0.32)]"
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
