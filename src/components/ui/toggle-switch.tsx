"use client";

import { cn } from "@/lib/utils";

export function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "tap-press inline-flex h-7 w-12 items-center rounded-full border p-0.5 transition",
        checked
          ? "border-[rgb(var(--teal-rgb)/0.4)] bg-[rgb(var(--teal-rgb)/0.22)]"
          : "border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.86)]",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <span
        className={cn(
          "h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(15,43,35,0.22)] transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
