"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Bell,
  Plus,
  LifeBuoy,
  Store,
  ShieldCheck,
  Clock,
  User,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

export function VendorHeader({
  onMenuClick,
  vendorProfile,
  title,
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const businessName = vendorProfile?.businessName || user?.firstName ? `${user?.firstName}'s Store` : "My Store";
  const onboardingStatus = vendorProfile?.onboardingStatus || "pending";
  const isApproved = onboardingStatus === "approved" && vendorProfile?.isActive;

  // Derive dynamic page title if not explicitly supplied
  const getPageTitle = () => {
    if (title) return title;
    if (pathname.includes("/vendor/products/new")) return "Add New Product";
    if (pathname.includes("/vendor/products")) return "Product Catalog";
    if (pathname.includes("/vendor/inventory")) return "Inventory Management";
    if (pathname.includes("/vendor/warehouses")) return "Fulfillment Centers";
    if (pathname.includes("/vendor/orders")) return "Customer Orders";
    if (pathname.includes("/vendor/shipments")) return "Shipment Tracking";
    if (pathname.includes("/vendor/returns")) return "Returns & RMA";
    if (pathname.includes("/vendor/finance")) return "Settlements & Finance";
    if (pathname.includes("/vendor/reviews")) return "Customer Reviews";
    if (pathname.includes("/vendor/questions")) return "Product Inquiries (Q&A)";
    if (pathname.includes("/vendor/store")) return "Store Settings & Profile";
    if (pathname.includes("/vendor/settings")) return "Account & Security Settings";
    if (pathname.includes("/vendor/notifications")) return "Notifications";
    if (pathname.includes("/vendor/support")) return "Vendor Support";
    if (pathname.includes("/vendor/activity")) return "Activity Audit Log";
    return "Merchant Dashboard";
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {getPageTitle()}
            </h1>
            {isApproved ? (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="size-3" /> Approved
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                <Clock className="size-3" /> {onboardingStatus}
              </span>
            )}
          </div>
          <span className="hidden md:block text-[11px] text-slate-500 truncate">
            {businessName} • Buybox Multi-Vendor Marketplace
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Add Product CTA */}
        <Link
          href="/vendor/products/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Add Product</span>
        </Link>

        {/* Notifications Icon */}
        <Link
          href="/vendor/notifications"
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Notifications"
          aria-label="View notifications"
        >
          <Bell className="size-4" />
        </Link>

        {/* Support Help */}
        <Link
          href="/vendor/support"
          className="hidden sm:flex p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Merchant Support"
          aria-label="Merchant support"
        >
          <LifeBuoy className="size-4" />
        </Link>

        <div className="h-6 w-px bg-slate-200 hidden sm:block" />

        {/* User Account Info */}
        <Link
          href="/vendor/settings"
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
          title="Account & Security Settings"
        >
          <div className="size-8 rounded-xl bg-emerald-100 text-[#004D38] flex items-center justify-center font-bold text-xs">
            {user?.firstName?.[0]?.toUpperCase() || "M"}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 max-w-[100px] truncate">
              {user?.firstName || "Merchant"}
            </span>
            <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
              {user?.email}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default VendorHeader;
