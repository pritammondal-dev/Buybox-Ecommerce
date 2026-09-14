"use client";

import React, { useState } from "react";
import { cn } from "../../utils/cn.js";

export function Tooltip({ content, children, side = "top", className }) {
  const [isVisible, setIsVisible] = useState(false);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background shadow-md animate-in fade-in zoom-in-95 duration-100",
            sideClasses[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default Tooltip;
