import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-14 w-full rounded-[22px] border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--surface-3-rgb)/0.98)] px-5 py-2 text-[15px] font-medium text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--violet-rgb)/0.45)] focus-visible:border-[rgb(var(--violet-rgb)/0.85)] transition-colors",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
