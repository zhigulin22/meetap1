import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[image:var(--grad-primary)] text-[rgb(var(--bg-rgb))] shadow-[0_14px_28px_rgb(var(--teal-rgb)/0.28)] hover:brightness-[1.04] focus-visible:ring-cyan/30",
        event:
          "bg-[image:var(--grad-event)] text-[rgb(var(--event-night-rgb))] shadow-[0_14px_28px_rgb(var(--gold-rgb)/0.24)] hover:brightness-[1.04] focus-visible:ring-gold/30",
        secondary:
          "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-2-rgb)/0.9)] text-text hover:bg-surface3/80 hover:border-borderStrong focus-visible:ring-cyan/25",
        ghost: "text-text2 hover:bg-surface2/65 hover:text-text focus-visible:ring-cyan/25",
        danger: "bg-danger text-white shadow-[0_12px_24px_rgb(var(--danger-rgb)/0.26)] hover:brightness-[1.06] focus-visible:ring-danger/35",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
