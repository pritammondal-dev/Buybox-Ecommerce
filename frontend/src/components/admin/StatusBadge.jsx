import React from "react";
import { Badge } from "../ui/Badge.jsx";
import { cn } from "../../utils/cn.js";

const STATUS_CONFIGS = {
  // Orders
  pending: { label: "Pending", variant: "warning", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  confirmed: { label: "Confirmed", variant: "info", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  shipped: { label: "Shipped", variant: "info", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  delivered: { label: "Delivered", variant: "success", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelled", variant: "destructive", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },

  // Payments
  paid: { label: "Paid", variant: "success", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  failed: { label: "Failed", variant: "destructive", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
  refunded: { label: "Refunded", variant: "secondary", className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },

  // Inventory / General
  active: { label: "Active", variant: "success", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  inactive: { label: "Inactive", variant: "secondary", className: "bg-muted text-muted-foreground" },
  draft: { label: "Draft", variant: "secondary", className: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  in_stock: { label: "In Stock", variant: "success", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  low_stock: { label: "Low Stock", variant: "warning", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  out_of_stock: { label: "Out of Stock", variant: "destructive", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" },
};

export function StatusBadge({ status = "pending", customLabel, className }) {
  const normalizedKey = String(status).toLowerCase().replace(/\s+/g, "_");
  const config = STATUS_CONFIGS[normalizedKey] || {
    label: customLabel || status,
    variant: "secondary",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <Badge
      variant={config.variant}
      size="sm"
      className={cn("font-medium capitalize", config.className, className)}
    >
      <span className="size-1.5 rounded-full bg-current mr-1.5 opacity-80" aria-hidden="true" />
      {customLabel || config.label}
    </Badge>
  );
}

export default StatusBadge;
