"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Package,
  Layers,
  Tags,
  ShoppingBag,
  RotateCcw,
  Receipt,
  Truck,
  Warehouse,
  Users,
  Building2,
  TicketPercent,
  Megaphone,
  CreditCard,
  Banknote,
  Headphones,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Box,
  LogOut,
  Image as ImageIcon,
  KeyRound,
  UserCog,
  FileText,
  Star,
  Sparkles,
  Sliders,
  FileSpreadsheet,
} from "lucide-react";
import { Tooltip } from "../ui/Tooltip.jsx";
import { useAdminAuth } from "../../hooks/useAdminAuth.js";
import { cn } from "../../utils/cn.js";

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/administrator/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
      {
        label: "My Tasks",
        href: "/administrator/tasks",
        icon: CheckSquare,
        permission: "tasks.view",
      },
    ],
  },
  {
    title: "Marketplace",
    items: [
      {
        label: "Vendors",
        href: "/administrator/vendors",
        icon: Building2,
        permission: "vendors.view",
      },
      {
        label: "Customers",
        href: "/administrator/customers",
        icon: Users,
        permission: "customers.view",
      },
      {
        label: "Products",
        href: "/administrator/catalog/products",
        icon: Package,
        permission: "products.view",
      },
      {
        label: "Categories",
        href: "/administrator/catalog/categories",
        icon: Layers,
        permission: "categories.view",
      },
      {
        label: "Brands",
        href: "/administrator/catalog/brands",
        icon: Tags,
        permission: "brands.view",
      },
      {
        label: "Attributes",
        href: "/administrator/catalog/attributes",
        icon: Sliders,
        permission: "products.view",
      },
      {
        label: "Bulk Import / Export",
        href: "/administrator/import-export",
        icon: FileSpreadsheet,
        permission: "products.create",
      },
      {
        label: "Reviews & Moderation",
        href: "/administrator/catalog/reviews",
        icon: Star,
        permission: "reviews.view",
      },
    ],
  },
  {
    title: "Orders & Fulfillment",
    items: [
      {
        label: "Orders",
        href: "/administrator/operations/orders",
        icon: ShoppingBag,
        permission: "orders.view",
      },
      {
        label: "Returns",
        href: "/administrator/operations/returns",
        icon: RotateCcw,
        permission: "returns.view",
      },
      {
        label: "Refunds",
        href: "/administrator/operations/refunds",
        icon: Receipt,
        permission: "refunds.view",
      },
      {
        label: "Inventory",
        href: "/administrator/inventory/stock",
        icon: Warehouse,
        permission: "inventory.view",
      },
      {
        label: "Warehouses",
        href: "/administrator/inventory/warehouses",
        icon: Warehouse,
        permission: "warehouses.view",
      },
      {
        label: "Shipments",
        href: "/administrator/operations/shipments",
        icon: Truck,
        permission: "shipping.view",
      },
    ],
  },
  {
    title: "Finance & Settlements",
    items: [
      {
        label: "Payments",
        href: "/administrator/payments",
        icon: CreditCard,
        permission: "payments.view",
      },
      {
        label: "Settlements & Payouts",
        href: "/administrator/finance/settlements",
        icon: Banknote,
        permission: "settlements.view",
      },
    ],
  },
  {
    title: "Marketing & CMS",
    items: [
      {
        label: "Campaigns",
        href: "/administrator/marketing/campaigns",
        icon: Megaphone,
        permission: "campaigns.view",
      },
      {
        label: "Coupons",
        href: "/administrator/marketing/coupons",
        icon: TicketPercent,
        permission: "coupons.view",
      },
      {
        label: "Store Banners (CMS)",
        href: "/administrator/marketing/banners",
        icon: ImageIcon,
        permission: "cms.view",
      },
      {
        label: "CMS Pages",
        href: "/administrator/cms/pages",
        icon: FileText,
        permission: "cms.view",
      },
    ],
  },
  {
    title: "Governance & Security",
    items: [
      {
        label: "Staff Management",
        href: "/administrator/staff",
        icon: UserCog,
        permission: "staff.view",
      },
      {
        label: "Job Roles & Hierarchy",
        href: "/administrator/job-roles",
        icon: ShieldCheck,
        roles: ["SUPERADMIN", "super_admin"],
        permission: "job_roles.view",
      },
      {
        label: "Role Permissions",
        href: "/administrator/settings/permissions",
        icon: KeyRound,
        roles: ["SUPERADMIN", "super_admin"],
      },
      {
        label: "Activity & Audit Logs",
        href: "/administrator/security/audit-logs",
        icon: ShieldCheck,
        permission: "activity_logs.view",
      },
      {
        label: "Security Events",
        href: "/administrator/security/events",
        icon: ShieldCheck,
        permission: "activity_logs.view",
      },
      {
        label: "Support Tickets",
        href: "/administrator/support/tickets",
        icon: Headphones,
        permission: "support.view",
      },
      {
        label: "Platform Credentials",
        href: "/administrator/settings/credentials",
        icon: KeyRound,
        roles: ["SUPERADMIN", "super_admin"],
      },
      {
        label: "Customer Login Options",
        href: "/administrator/settings/authentication",
        icon: KeyRound,
        roles: ["SUPERADMIN", "super_admin"],
        permission: "authentication.login_methods.read",
      },
    ],
  },
];

const checkItemAccess = (item, user) => {
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  if (role === "SUPERADMIN" || role === "SUPER_ADMIN") return true;
  if (
    item.roles &&
    !item.roles.map((r) => r.toUpperCase()).includes(role)
  ) {
    return false;
  }
  if (!item.permission) return true;

  const permissions = user.permissions || [];
  if (permissions.includes(item.permission)) return true;

  const legacyAliases = {
    "dashboard.view": "analytics:read",
    "tasks.view": "work_assignments:read",
    "vendors.view": "vendors:read",
    "customers.view": "users:read",
    "products.view": "products:read",
    "categories.view": "products:read",
    "brands.view": "products:read",
    "inventory.view": "inventory:read",
    "warehouses.view": "warehouses:read",
    "orders.view": "orders:read",
    "returns.view": "orders:read",
    "refunds.view": "finance:read",
    "shipping.view": "shipments:read",
    "payments.view": "payments:read",
    "settlements.view": "finance:read",
    "campaigns.view": "campaigns:read",
    "coupons.view": "coupons:read",
    "cms.view": "settings:read",
    "reviews.view": "reviews:read",
    "support.view": "support_tickets:read",
    "staff.view": "employees:read",
    "activity_logs.view": "audit_logs:read",
  };

  const alias = legacyAliases[item.permission];
  return Boolean(alias && permissions.includes(alias));
};

export function AdminSidebar({
  isCollapsed = false,
  onToggleCollapse,
  className,
}) {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const role = (user?.role || "").toUpperCase();

  return (
    <aside
      aria-label="Admin Navigation Sidebar"
      className={cn(
        "relative flex flex-col justify-between border-r bg-[#002C20] text-slate-200 transition-all duration-300 select-none",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Top Brand Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-4 border-b border-emerald-950/80 bg-[#00241A]">
          <Link
            href="/administrator/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Box className="size-5 stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-semibold text-white tracking-tight leading-tight">
                  BUYBOX
                </span>
                <span className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase">
                  {role === "SUPERADMIN" || role === "SUPER_ADMIN"
                    ? "SUPERADMIN"
                    : role === "EDITOR"
                    ? "EDITOR CONSOLE"
                    : "ADMIN CONSOLE"}
                </span>
              </div>
            )}
          </Link>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-emerald-950 transition-colors hidden lg:block"
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-8.5rem)]">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              checkItemAccess(item, user)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold tracking-wider text-emerald-400/80 uppercase">
                    {group.title}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/administrator/dashboard" &&
                        pathname?.startsWith(item.href));

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                          isActive
                            ? "bg-emerald-700 text-white shadow-xs font-semibold"
                            : "text-slate-300 hover:bg-emerald-950/60 hover:text-white",
                          isCollapsed && "justify-center px-0 py-2.5"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive ? "text-white" : "text-emerald-400"
                          )}
                        />
                        {!isCollapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                      </Link>
                    );

                    if (isCollapsed) {
                      return (
                        <Tooltip
                          key={item.href}
                          content={item.label}
                          position="right"
                        >
                          {linkContent}
                        </Tooltip>
                      );
                    }

                    return <div key={item.href}>{linkContent}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile and Logout */}
      <div className="p-3 border-t border-emerald-950 bg-[#00241A]">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-emerald-950/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user?.firstName?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-white truncate leading-tight">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[10px] text-emerald-400 truncate">
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-emerald-900/60 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <Tooltip content="Sign Out" position="right">
              <button
                onClick={logout}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-emerald-950 transition-colors"
              >
                <LogOut className="size-4" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AdminSidebar;
