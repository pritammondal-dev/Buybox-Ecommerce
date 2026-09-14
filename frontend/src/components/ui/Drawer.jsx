"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./Sheet.jsx";

export function Drawer({ open, onOpenChange, children }) {
  return <Sheet open={open} onOpenChange={onOpenChange}>{children}</Sheet>;
}

export function DrawerContent({ className, children, onClose, ...props }) {
  return (
    <SheetContent
      side="bottom"
      className={className}
      onClose={onClose}
      {...props}
    >
      <div className="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-muted" />
      {children}
    </SheetContent>
  );
}

export const DrawerHeader = SheetHeader;
export const DrawerFooter = SheetFooter;
export const DrawerTitle = SheetTitle;
export const DrawerDescription = SheetDescription;

export default Drawer;
