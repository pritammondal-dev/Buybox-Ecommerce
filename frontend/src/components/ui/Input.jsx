import React from "react";
import { cn } from "../../utils/cn.js";

export const Input = React.forwardRef(
  (
    {
      className,
      type = "text",
      prefixIcon: PrefixIcon,
      suffixIcon: SuffixIcon,
      error,
      id,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative w-full">
        {PrefixIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            <PrefixIcon className="size-4" aria-hidden="true" />
          </div>
        )}
        <input
          id={id}
          ref={ref}
          type={type}
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            PrefixIcon && "pl-9",
            SuffixIcon && "pr-9",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
        />
        {SuffixIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
            <SuffixIcon className="size-4" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
