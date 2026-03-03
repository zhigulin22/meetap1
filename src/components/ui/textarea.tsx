import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[110px] w-full rounded-[var(--radius-md)] border border-border bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/40",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
