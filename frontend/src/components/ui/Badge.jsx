import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../utils/cn.js";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-success text-success-foreground shadow hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground shadow hover:bg-warning/80",
        info:
          "border-transparent bg-info text-info-foreground shadow hover:bg-info/80",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-1.5 py-0.2 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export function Badge({ className, variant, size, children, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {children}
    </div>
  );
}

export default Badge;
