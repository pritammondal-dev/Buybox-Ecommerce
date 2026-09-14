"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn.js";

const sideVariants = {
  top: "inset-x-0 top-0 border-b animate-in slide-in-from-top duration-300",
  bottom: "inset-x-0 bottom-0 border-t animate-in slide-in-from-bottom duration-300",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm animate-in slide-in-from-left duration-300",
  right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-md animate-in slide-in-from-right duration-300",
};

export function Sheet({ open, onOpenChange, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && open) {
        onOpenChange?.(false);
      }
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => onOpenChange?.(false)}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

export const SheetContent = React.forwardRef(
  ({ side = "right", className, children, onClose, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background p-6 shadow-modal transition ease-in-out",
          sideVariants[side],
          className
        )}
        {...props}
      >
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    );
  }
);
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col space-y-2 text-left", className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-auto",
        className
      )}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function SheetDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export default Sheet;
