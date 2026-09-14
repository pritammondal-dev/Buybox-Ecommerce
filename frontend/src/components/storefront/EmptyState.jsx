import React from "react";
import { PackageOpen } from "lucide-react";
import { EmptyState as UIEmptyState } from "../ui/EmptyState.jsx";

export function EmptyState({
  icon = PackageOpen,
  title = "No products found",
  description = "We couldn't find any products matching your criteria. Try resetting filters or exploring other categories.",
  actionLabel = "Browse All Products",
  actionHref = "/shop",
  className,
}) {
  return (
    <UIEmptyState
      icon={icon}
      title={title}
      description={description}
      actionLabel={actionLabel}
      actionHref={actionHref}
      className={className}
    />
  );
}

export default EmptyState;
