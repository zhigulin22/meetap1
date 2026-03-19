import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-[20px] border border-[color:var(--border-strong)] bg-[rgb(var(--surface-2-rgb))] px-4 py-2 text-[15px] text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--violet-rgb)/0.35)] focus-visible:border-[color:rgb(var(--violet-rgb)/0.7)] transition-colors",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
