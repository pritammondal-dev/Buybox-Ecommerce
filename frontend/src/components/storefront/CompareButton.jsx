"use client";

import React from "react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function CompareButton({
  isCompared = false,
  onToggle,
  size = "md",
  className,
  ariaLabel = "Add to compare",
}) {
  const sizeClasses = {
    sm: "size-7 [&_svg]:size-3.5",
    md: "size-9 [&_svg]:size-4",
    lg: "size-11 [&_svg]:size-5",
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.(!isCompared);
      }}
      aria-label={isCompared ? "Remove from compare" : ariaLabel}
      aria-pressed={isCompared}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-input/60 bg-background/90 backdrop-blur-xs text-foreground shadow-xs transition-all hover:scale-105 hover:bg-background active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCompared && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      <ArrowLeftRight className="transition-transform" aria-hidden="true" />
      <span className="sr-only">
        {isCompared ? "Remove from compare" : ariaLabel}
      </span>
    </button>
  );
}

export default CompareButton;
