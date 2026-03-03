import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] px-3 py-2 text-sm text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/25",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
