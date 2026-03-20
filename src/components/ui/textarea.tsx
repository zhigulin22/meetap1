import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[110px] w-full rounded-[var(--radius-md)] border border-[rgb(var(--violet-rgb)/0.4)] bg-[rgb(var(--surface-3-rgb)/0.96)] px-3 py-2 text-sm text-text placeholder:text-text2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--violet-rgb)/0.4)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
