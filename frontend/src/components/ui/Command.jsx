"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function Command({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground border shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandInput({
  className,
  value,
  onValueChange,
  placeholder = "Type a command or search...",
  ...props
}) {
  return (
    <div className="flex items-center border-b px-3">
      <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange?.("")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function CommandList({ className, children, ...props }) {
  return (
    <div
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandEmpty({ children = "No results found.", className }) {
  return (
    <div className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function CommandGroup({ heading, children, className }) {
  return (
    <div className={cn("overflow-hidden p-1 text-foreground", className)}>
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      {children}
    </div>
  );
}

export function CommandItem({
  children,
  onSelect,
  className,
  disabled,
  ...props
}) {
  return (
    <div
      role="option"
      aria-selected={false}
      onClick={!disabled ? onSelect : undefined}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Command;
