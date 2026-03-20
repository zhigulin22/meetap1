import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-[20px] border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--surface-3-rgb)/0.96)] px-4 py-2 text-[15px] text-text placeholder:text-text2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--violet-rgb)/0.45)] focus-visible:border-[rgb(var(--violet-rgb)/0.8)] transition-colors",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
