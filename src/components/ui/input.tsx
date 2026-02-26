import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm text-[#0B0F1A] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan dark:bg-[#111b2e]/80 dark:text-[#E6EDF6] dark:placeholder:text-[#7B879C]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
