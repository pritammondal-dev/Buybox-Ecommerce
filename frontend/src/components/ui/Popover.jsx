"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "../../utils/cn.js";

export function Popover({ trigger, children, align = "center", className }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const alignClasses = {
    left: "left-0",
    right: "right-0",
    center: "left-1/2 -translate-x-1/2",
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-elevated outline-none animate-in fade-in zoom-in-95 duration-150",
            alignClasses[align] || alignClasses.center,
            className
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Popover;
