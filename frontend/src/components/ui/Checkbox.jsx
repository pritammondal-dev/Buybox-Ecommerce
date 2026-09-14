import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn.js";

export const Checkbox = React.forwardRef(
  ({ className, checked, onChange, id, disabled, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex cursor-pointer select-none items-center gap-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          id={id}
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary shadow transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            checked
              ? "bg-primary text-primary-foreground"
              : "bg-background text-transparent",
            className
          )}
        >
          <Check className="size-3 stroke-[3]" />
        </div>
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
