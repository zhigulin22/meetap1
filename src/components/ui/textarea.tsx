import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[110px] w-full rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] px-3 py-2 text-sm text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--sky-rgb)/0.28)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
