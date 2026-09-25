"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  LayoutGrid,
  ChevronRight,
  Headphones,
  Keyboard,
  Monitor,
  Wrench,
  Gamepad2,
  Zap,
  Folder,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { cn } from "../../../utils/cn.js";

function getCategoryIcon(slug = "", name = "") {
  const lower = `${slug} ${name}`.toLowerCase();
  if (lower.includes("audio") || lower.includes("headphone") || lower.includes("sound") || lower.includes("speaker")) {
    return Headphones;
  }
  if (lower.includes("keyboard") || lower.includes("peripheral") || lower.includes("typing") || lower.includes("switch")) {
    return Keyboard;
  }
  if (lower.includes("display") || lower.includes("monitor") || lower.includes("screen")) {
    return Monitor;
  }
  if (lower.includes("gaming") || lower.includes("game")) {
    return Gamepad2;
  }
  if (lower.includes("power") || lower.includes("charge") || lower.includes("smart") || lower.includes("dock")) {
    return Zap;
  }
  if (lower.includes("edc") || lower.includes("gear") || lower.includes("tool") || lower.includes("minimalist")) {
    return Wrench;
  }
  return Folder;
}

export function CategoryDrawer({ isOpen, onClose, categories = [] }) {
  const pathname = usePathname();
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      // Focus close button on open
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Support parent / child grouping if backend contains parentId
  const { rootCategories, subCategoryMap } = React.useMemo(() => {
    const roots = [];
    const subMap = new Map();

    (categories || []).forEach((cat) => {
      const parentId = cat.parentId?._id || cat.parentId;
      if (!parentId) {
        roots.push(cat);
      } else {
        const pIdStr = String(parentId);
        if (!subMap.has(pIdStr)) {
          subMap.set(pIdStr, []);
        }
        subMap.get(pIdStr).push(cat);
      }
    });

    // If no parent-child relationship configured, treat all as top-level
    if (roots.length === 0 && categories.length > 0) {
      return { rootCategories: categories, subCategoryMap: new Map() };
    }

    return { rootCategories: roots, subCategoryMap: subMap };
  }, [categories]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="All Categories Navigation"
      className="fixed inset-0 z-50 flex"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        className="relative flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out z-10 animate-in slide-in-from-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-[#004D38] text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#007A55] text-white shadow-xs">
              <LayoutGrid className="size-4.5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">
                All Categories
              </h2>
              <p className="text-[11px] text-emerald-100/80">
                {categories.length} verified departments
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close categories drawer"
            className="flex size-8 items-center justify-center rounded-full text-emerald-100 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {rootCategories.length > 0 ? (
            rootCategories.map((cat) => {
              const id = cat.id || cat._id;
              const slug = cat.slug || id;
              const href = `/category/${slug}`;
              const isActive = pathname === href;
              const Icon = getCategoryIcon(cat.slug, cat.name);
              const children = subCategoryMap.get(String(id)) || [];

              return (
                <div key={id} className="rounded-xl transition-colors">
                  <Link
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all group",
                      isActive
                        ? "bg-emerald-50 text-[#007A55] font-bold"
                        : "text-slate-800 hover:bg-slate-50 hover:text-[#007A55]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "bg-[#007A55] text-white"
                            : "bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-[#007A55]"
                        )}
                      >
                        <Icon className="size-4 stroke-[1.8]" />
                      </div>
                      <span className="truncate">{cat.name}</span>
                    </div>

                    <ChevronRight
                      className={cn(
                        "size-4 text-slate-400 transition-transform group-hover:translate-x-0.5",
                        isActive && "text-[#007A55]"
                      )}
                    />
                  </Link>

                  {/* Subcategories (if backend has nested categories) */}
                  {children.length > 0 && (
                    <div className="ml-10 mt-1 mb-2 space-y-0.5 border-l-2 border-slate-100 pl-3">
                      {children.map((sub) => {
                        const subId = sub.id || sub._id;
                        const subSlug = sub.slug || subId;
                        const subHref = `/category/${subSlug}`;
                        const isSubActive = pathname === subHref;

                        return (
                          <Link
                            key={subId}
                            href={subHref}
                            onClick={onClose}
                            className={cn(
                              "block rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                              isSubActive
                                ? "text-[#007A55] font-bold bg-emerald-50"
                                : "text-slate-600 hover:text-[#007A55] hover:bg-slate-50"
                            )}
                          >
                            {sub.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No categories currently loaded
            </div>
          )}
        </div>

        {/* Footer Quick Action */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-2">
          <Link
            href="/shop"
            onClick={onClose}
            className="flex items-center justify-between rounded-xl bg-[#007A55] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4" />
              <span>Browse All Products</span>
            </div>
            <ArrowRight className="size-3.5" />
          </Link>

          <p className="text-center text-[10px] text-slate-400 font-medium">
            100% Genuine Hardware • Verified Manufacturer Warranty
          </p>
        </div>
      </div>
    </div>
  );
}

export default CategoryDrawer;
