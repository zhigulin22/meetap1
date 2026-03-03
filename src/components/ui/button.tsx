import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[rgb(var(--peach-rgb))] text-[rgb(var(--text-rgb))] shadow-[0_8px_18px_rgb(var(--peach-rgb)/0.22)] hover:bg-[rgb(var(--peach-pressed-rgb))] focus-visible:ring-[rgb(var(--peach-rgb)/0.28)]",
        event:
          "bg-[image:var(--grad-event)] text-[rgb(var(--text-rgb))] shadow-[0_8px_18px_rgb(var(--gold-rgb)/0.24)] hover:brightness-[1.02] focus-visible:ring-[rgb(var(--gold-rgb)/0.35)]",
        secondary:
          "border border-[color:var(--border-soft)] bg-[rgb(var(--surface-1-rgb))] text-text hover:bg-[rgb(var(--surface-2-rgb))] focus-visible:ring-[rgb(var(--sky-rgb)/0.28)]",
        ghost:
          "text-[rgb(var(--teal-rgb))] hover:bg-[rgb(var(--teal-rgb)/0.1)] hover:text-[rgb(var(--teal-hover-rgb))] focus-visible:ring-[rgb(var(--teal-rgb)/0.25)]",
        danger:
          "bg-danger text-white shadow-[0_8px_18px_rgb(var(--danger-rgb)/0.24)] hover:brightness-[0.98] focus-visible:ring-danger/35",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
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
