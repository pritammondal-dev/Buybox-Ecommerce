"use client";

import React from "react";
import { Sheet, SheetContent } from "../ui/Sheet.jsx";
import { AdminSidebar } from "./AdminSidebar.jsx";

export function AdminMobileNav({ isOpen, onClose }) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="left"
        onClose={onClose}
        className="w-72 p-0 bg-slate-950 text-slate-200 border-r-slate-800"
      >
        <AdminSidebar isCollapsed={false} className="w-full h-full border-r-0" />
      </SheetContent>
    </Sheet>
  );
}

export default AdminMobileNav;
