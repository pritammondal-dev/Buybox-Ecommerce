"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Tags,
  ShoppingBag,
  Truck,
  Warehouse,
  Users,
  Building2,
  TicketPercent,
  Receipt,
  Headphones,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Box,
  LogOut,
} from "lucide-react";
import { Tooltip } from "../ui/Tooltip.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { cn } from "../../utils/cn.js";

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/admin/catalog/products", icon: Package },
      { label: "Categories", href: "/admin/catalog/categories", icon: Layers },
      { label: "Brands", href: "/admin/catalog/brands", icon: Tags },
    ],
  },
  {
    title: "Fulfillment",
    items: [
      { label: "Orders", href: "/admin/operations/orders", icon: ShoppingBag },
      { label: "Shipments", href: "/admin/operations/shipments", icon: Truck },
      { label: "Inventory", href: "/admin/inventory/stock", icon: Warehouse },
    ],
  },
  {
    title: "Stakeholders",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Vendors", href: "/admin/vendors", icon: Building2 },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Coupons", href: "/admin/marketing/coupons", icon: TicketPercent },
      { label: "Finance & Taxes", href: "/admin/finance/settlements", icon: Receipt },
      { label: "Support Tickets", href: "/admin/support/tickets", icon: Headphones },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Security & Logs", href: "/admin/security/audit-logs", icon: ShieldCheck },
    ],
  },
];

export function AdminSidebar({ isCollapsed = false, onToggleCollapse, className }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      aria-label="Admin Navigation Sidebar"
      className={cn(
        "relative flex flex-col justify-between border-r bg-slate-950 text-slate-200 transition-all duration-300 select-none",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Top Brand Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/80">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Box className="size-5 stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-base font-black tracking-tight text-white leading-tight">
                  BUYBOX
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Admin Console
                </span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "hidden lg:flex size-6 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors",
                isCollapsed && "mx-auto"
              )}
            >
              {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </button>
          )}
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5 scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed && (
                <h4 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </h4>
              )}

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  const linkElement = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-primary text-white font-semibold shadow-xs"
                          : "text-slate-300 hover:bg-slate-900 hover:text-white",
                        isCollapsed && "justify-center px-2"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href} content={item.label} side="right">
                        {linkElement}
                      </Tooltip>
                    );
                  }

                  return linkElement;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom User Footer */}
      <div className="border-t border-slate-800/80 p-3">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-foreground text-xs font-bold ring-1 ring-primary/40">
            {user?.firstName?.charAt(0) || "A"}
          </div>

          {!isCollapsed && (
            <div className="flex flex-1 flex-col truncate">
              <span className="text-xs font-semibold text-white truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Staff Admin"}
              </span>
              <span className="text-[10px] text-slate-400 capitalize truncate">
                {user?.role || "Administrator"}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Sign out"
              className="size-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-900 hover:text-rose-400 transition-colors"
            >
              <LogOut className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
