import React from "react";
import { cn } from "../../utils/cn.js";

export const RadioGroup = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn("grid gap-2", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef(
  ({ className, id, name, value, checked, onChange, disabled, ...props }, ref) => {
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
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <div
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border border-primary shadow transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            checked ? "border-primary bg-background" : "border-input bg-background",
            className
          )}
        >
          {checked && (
            <span className="size-2 rounded-full bg-primary transition-transform animate-in zoom-in" />
          )}
        </div>
      </label>
    );
  }
);

RadioGroupItem.displayName = "RadioGroupItem";

export default RadioGroup;
