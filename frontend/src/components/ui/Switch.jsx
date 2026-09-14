import React from "react";
import { cn } from "../../utils/cn.js";

export const Switch = React.forwardRef(
  ({ className, checked, onChange, id, disabled, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex cursor-pointer select-none items-center",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          id={id}
          ref={ref}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          aria-hidden="true"
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            checked ? "bg-primary" : "bg-input",
            className
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
              checked ? "translate-x-4" : "translate-x-0"
            )}
          />
        </div>
      </label>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
