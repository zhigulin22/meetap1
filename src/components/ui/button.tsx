import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-[15px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[image:var(--grad-primary)] text-white shadow-[0_14px_28px_rgb(var(--violet-rgb)/0.35)] hover:brightness-[1.03] focus-visible:ring-[rgb(var(--violet-rgb)/0.45)]",
        event:
          "bg-[image:var(--grad-event)] text-[rgb(var(--text-rgb))] shadow-[0_10px_22px_rgb(var(--gold-rgb)/0.24)] hover:brightness-[1.02] focus-visible:ring-[rgb(var(--gold-rgb)/0.35)]",
        secondary:
          "border border-[rgb(var(--violet-rgb)/0.35)] bg-[rgb(var(--surface-1-rgb))] text-[rgb(var(--text-rgb))] shadow-[0_10px_20px_rgb(var(--violet-rgb)/0.14)] hover:border-[rgb(var(--violet-rgb)/0.5)] hover:bg-[rgb(var(--violet-rgb)/0.08)] focus-visible:ring-[rgb(var(--violet-rgb)/0.28)]",
        ghost:
          "text-[rgb(var(--violet-rgb))] hover:bg-[rgb(var(--violet-rgb)/0.12)] hover:text-[rgb(var(--violet-rgb))] focus-visible:ring-[rgb(var(--violet-rgb)/0.3)]",
        danger:
          "bg-danger text-white shadow-[0_10px_22px_rgb(var(--danger-rgb)/0.24)] hover:brightness-[0.98] focus-visible:ring-danger/35",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-7 text-base",
        icon: "h-12 w-12",
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
