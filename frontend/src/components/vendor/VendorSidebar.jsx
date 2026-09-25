"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  ShoppingBag,
  Truck,
  RotateCcw,
  Wallet,
  Star,
  HelpCircle,
  Store,
  Bell,
  LifeBuoy,
  History,
  ExternalLink,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Settings,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

const navSections = [
  {
    title: "Marketplace Operations",
    items: [
      { name: "Dashboard", href: "/vendor/dashboard", icon: LayoutDashboard },
      { name: "Products", href: "/vendor/products", icon: Package },
      { name: "Inventory", href: "/vendor/inventory", icon: Boxes },
      { name: "Warehouses", href: "/vendor/warehouses", icon: Warehouse },
      { name: "Orders", href: "/vendor/orders", icon: ShoppingBag },
      { name: "Shipments", href: "/vendor/shipments", icon: Truck },
      { name: "Returns & RMA", href: "/vendor/returns", icon: RotateCcw },
    ],
  },
  {
    title: "Finance & Payouts",
    items: [
      { name: "Settlements & Finance", href: "/vendor/finance", icon: Wallet },
    ],
  },
  {
    title: "Customer Engagement",
    items: [
      { name: "Product Reviews", href: "/vendor/reviews", icon: Star },
      { name: "Questions & Q/A", href: "/vendor/questions", icon: HelpCircle },
    ],
  },
  {
    title: "Settings & Support",
    items: [
      { name: "Store Settings", href: "/vendor/store", icon: Store },
      { name: "Account & Security", href: "/vendor/settings", icon: Settings },
      { name: "Notifications", href: "/vendor/notifications", icon: Bell },
      { name: "Support Tickets", href: "/vendor/support", icon: LifeBuoy },
      { name: "Activity Logs", href: "/vendor/activity", icon: History },
    ],
  },
];

export function VendorSidebar({
  isCollapsed = false,
  onToggleCollapse,
  vendorProfile,
  onCloseMobile,
  className = "",
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const businessName = vendorProfile?.businessName || user?.firstName ? `${user?.firstName}'s Store` : "Merchant Console";
  const onboardingStatus = vendorProfile?.onboardingStatus || "pending";
  const isApproved = onboardingStatus === "approved" && vendorProfile?.isActive;

  return (
    <aside
      className={`flex flex-col bg-[#00241A] text-slate-100 border-r border-[#003828] transition-all duration-300 z-30 ${
        isCollapsed ? "w-20" : "w-64"
      } ${className}`}
    >
      {/* Brand & Store Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#003828] bg-[#001D15]">
        <Link
          href="/vendor/dashboard"
          className="flex items-center gap-3 overflow-hidden"
          onClick={onCloseMobile}
        >
          <div className="flex items-center justify-center size-9 rounded-xl bg-[#007A55] text-white font-black text-sm shrink-0 shadow-md">
            BB
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Merchant Console
              </span>
              <span className="text-sm font-semibold text-white truncate max-w-[140px]">
                {businessName}
              </span>
            </div>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-emerald-300/70 hover:text-white hover:bg-[#003828] transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        )}
      </div>

      {/* Status Badge (if expanded) */}
      {!isCollapsed && (
        <div className="px-4 py-2.5 bg-[#002B1F] border-b border-[#003828]">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Status:</span>
            {isApproved ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <ShieldCheck className="size-3" /> Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60 capitalize">
                <Clock className="size-3" /> {onboardingStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-emerald-900">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500/70">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/vendor/dashboard" && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#007A55] text-white font-semibold shadow-sm"
                          : "text-slate-300 hover:text-white hover:bg-[#003828]"
                      } ${isCollapsed ? "justify-center px-2" : ""}`}
                      title={isCollapsed ? item.name : undefined}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!isCollapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Footer Actions */}
      <div className="p-3 border-t border-[#003828] bg-[#001D15] space-y-2">
        <Link
          href="/"
          target="_blank"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-[#003828] transition-colors ${
            isCollapsed ? "justify-center px-2" : ""
          }`}
          title="Visit Storefront"
        >
          <ExternalLink className="size-4 shrink-0" />
          {!isCollapsed && <span>View Marketplace</span>}
        </Link>

        <button
          onClick={async () => {
            await logout();
            router.push("/vendor/login");
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors ${
            isCollapsed ? "justify-center px-2" : ""
          }`}
          title="Sign Out"
        >
          <LogOut className="size-4 shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default VendorSidebar;
