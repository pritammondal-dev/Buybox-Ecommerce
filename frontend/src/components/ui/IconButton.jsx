import React from "react";
import { Button } from "./Button.jsx";
import { cn } from "../../utils/cn.js";

export const IconButton = React.forwardRef(
  (
    {
      icon: Icon,
      label,
      className,
      variant = "ghost",
      size = "icon",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={label}
        className={cn("shrink-0", className)}
        {...props}
      >
        {Icon ? <Icon className="size-4" aria-hidden="true" /> : children}
        <span className="sr-only">{label}</span>
      </Button>
    );
  }
);

IconButton.displayName = "IconButton";

export default IconButton;
