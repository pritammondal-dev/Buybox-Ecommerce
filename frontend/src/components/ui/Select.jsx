import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn.js";

export const Select = React.forwardRef(
  ({ className, children, error, id, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 pr-8 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground opacity-70"
          aria-hidden="true"
        />
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
