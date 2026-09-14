"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../utils/cn.js";

export function DropdownMenu({ trigger, children, align = "right", className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-elevated animate-in fade-in zoom-in-95 duration-150",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({ className, children, onClick, disabled, asChild, ...props }) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      role: "menuitem",
      onClick: (e) => {
        children.props.onClick?.(e);
        onClick?.(e);
      },
      className: cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        children.props.className,
        className
      ),
      ...props,
    });
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ className, children, ...props }) {
  return (
    <div
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className, ...props }) {
  return (
    <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

export default DropdownMenu;
