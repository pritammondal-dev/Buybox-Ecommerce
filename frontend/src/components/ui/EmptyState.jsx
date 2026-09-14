import React from "react";
import { PackageOpen } from "lucide-react";
import { Button } from "./Button.jsx";
import { cn } from "../../utils/cn.js";

export function EmptyState({
  icon: Icon = PackageOpen,
  title = "No items found",
  description = "There are no items to display at this time.",
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
}) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <Icon className="size-7" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && (
        <div className="mt-6">
          {actionHref ? (
            <Button asChild>
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default EmptyState;
