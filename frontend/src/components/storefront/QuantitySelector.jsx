"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function QuantitySelector({
  value = 1,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = "md",
  className,
}) {
  const handleDecrement = (e) => {
    e.preventDefault();
    if (value > min && !disabled) {
      onChange?.(value - 1);
    }
  };

  const handleIncrement = (e) => {
    e.preventDefault();
    if (value < max && !disabled) {
      onChange?.(value + 1);
    }
  };

  const handleInputChange = (e) => {
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed)) {
      onChange?.(min);
    } else {
      onChange?.(Math.max(min, Math.min(max, parsed)));
    }
  };

  const sizeClasses = {
    sm: "h-7 text-xs [&_button]:size-7",
    md: "h-9 text-sm [&_button]:size-9",
    lg: "h-11 text-base [&_button]:size-11",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-input bg-background shadow-xs overflow-hidden",
        disabled && "opacity-50 cursor-not-allowed",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min || disabled}
        aria-label="Decrease quantity"
        className="flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-40 transition-colors"
      >
        <Minus className="size-3.5" />
      </button>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        aria-label="Quantity"
        className="w-10 text-center font-medium bg-transparent text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max || disabled}
        aria-label="Increase quantity"
        className="flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-40 transition-colors"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export default QuantitySelector;
