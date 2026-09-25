"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Lock,
  Bell,
  Award,
  Gift,
  Tag,
  History,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../hooks/useAuth.js";

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.info("Logged out successfully");
      router.push("/");
    } catch {
      toast.error("Could not complete logout.");
    }
  };

  const LINKS = [
    { label: "Dashboard", href: "/account", icon: User },
    { label: "My Orders", href: "/account/orders", icon: Package },
    { label: "Saved Addresses", href: "/account/addresses", icon: MapPin },
    { label: "Payment Methods", href: "/account/payment-methods", icon: CreditCard },
    { label: "Wishlist", href: "/account/wishlist", icon: Heart },
    { label: "Profile Details", href: "/account/profile", icon: ShieldCheck },
    { label: "Security & Login", href: "/account/security", icon: Lock },
    { label: "Notifications", href: "/account/notifications", icon: Bell },
    { label: "Rewards & Points", href: "/account/rewards", icon: Award },
    { label: "Gift Cards", href: "/account/gift-cards", icon: Gift },
    { label: "My Coupons", href: "/account/coupons", icon: Tag },
    { label: "Recently Viewed", href: "/account/recently-viewed", icon: History },
  ];

  return (
    <div className="space-y-4">
      {/* Mobile Horizontal Pill Navigation (< lg screens) */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border shadow-xs mb-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#007A55] text-white font-black text-sm">
            {user?.firstName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-950 truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.name || "Customer"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-red-600 hover:bg-red-50 text-xs font-bold shrink-0 transition-colors"
            title="Sign Out"
          >
            <LogOut className="size-4" />
          </button>
        </div>

        <nav aria-label="Mobile Account Navigation" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#007A55] text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Desktop Sidebar Navigation (>= lg screens) */}
      <div className="hidden lg:block rounded-2xl border bg-white p-4 shadow-xs space-y-4">
        {/* User Info Capsule */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#007A55] text-white font-black text-sm shadow-xs">
            {user?.firstName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-950 truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.name || "Customer"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</p>
          </div>
        </div>

        {/* Nav List */}
        <nav aria-label="Desktop Account Navigation" className="space-y-1">
          {LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#007A55] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 hover:text-[#007A55]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className={`size-3.5 ${isActive ? "text-white" : "text-slate-300"}`} />
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </div>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default AccountNav;
