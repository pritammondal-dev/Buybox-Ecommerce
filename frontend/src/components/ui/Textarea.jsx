import React from "react";
import { cn } from "../../utils/cn.js";

export const Textarea = React.forwardRef(
  ({ className, error, id, ...props }, ref) => {
    return (
      <textarea
        id={id}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
