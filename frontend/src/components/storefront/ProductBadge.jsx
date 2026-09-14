import React from "react";
import { Badge } from "../ui/Badge.jsx";
import { cn } from "../../utils/cn.js";

export function ProductBadge({ type = "sale", label, className }) {
  const badgeConfig = {
    sale: {
      defaultLabel: "SALE",
      variant: "destructive",
      className: "bg-rose-500 text-white font-bold",
    },
    new: {
      defaultLabel: "NEW",
      variant: "default",
      className: "bg-primary text-primary-foreground font-semibold",
    },
    outOfStock: {
      defaultLabel: "OUT OF STOCK",
      variant: "secondary",
      className: "bg-muted text-muted-foreground font-medium",
    },
    lowStock: {
      defaultLabel: "LOW STOCK",
      variant: "warning",
      className: "bg-amber-500 text-white font-semibold",
    },
    bestSeller: {
      defaultLabel: "BEST SELLER",
      variant: "success",
      className: "bg-emerald-600 text-white font-semibold",
    },
  };

  const config = badgeConfig[type] || badgeConfig.sale;
  const displayText = label || config.defaultLabel;

  return (
    <Badge
      variant={config.variant}
      size="sm"
      className={cn("shadow-xs uppercase tracking-wider", config.className, className)}
    >
      {displayText}
    </Badge>
  );
}

export default ProductBadge;
