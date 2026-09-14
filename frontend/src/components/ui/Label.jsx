import React from "react";
import { cn } from "../../utils/cn.js";

export const Label = React.forwardRef(
  ({ className, children, required, htmlFor, ...props }, ref) => {
    return (
      <label
        ref={ref}
        htmlFor={htmlFor}
        className={cn(
          "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className
        )}
        {...props}
      >
        {children}
        {required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
    );
  }
);

Label.displayName = "Label";

export default Label;
