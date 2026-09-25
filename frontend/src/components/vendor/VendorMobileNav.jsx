"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { VendorSidebar } from "./VendorSidebar.jsx";

export function VendorMobileNav({
  isOpen,
  onClose,
  vendorProfile,
}) {
  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[#00241A] shadow-2xl z-50">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#003828] bg-[#001D15]">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Navigation Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-[#003828] transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <VendorSidebar
          isCollapsed={false}
          vendorProfile={vendorProfile}
          onCloseMobile={onClose}
          className="flex-1 w-full border-r-0"
        />
      </div>
    </div>
  );
}

export default VendorMobileNav;
