import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[140px] w-full rounded-[var(--radius-md)] border border-[rgb(var(--violet-rgb)/0.45)] bg-[rgb(var(--surface-3-rgb)/0.98)] px-4 py-3 text-[15px] font-medium text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--violet-rgb)/0.45)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
