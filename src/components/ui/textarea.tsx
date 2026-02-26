import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[110px] w-full rounded-xl border border-border bg-white/90 px-3 py-2 text-sm text-[#0B0F1A] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan dark:bg-[#111b2e]/80 dark:text-[#E6EDF6] dark:placeholder:text-[#7B879C]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
