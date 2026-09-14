import React from "react";
import { Inbox } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function AdminEmptyState({
  icon: Icon = Inbox,
  title = "No records found",
  description = "Get started by adding your first entry or adjust your filters.",
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 p-8 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h4 className="text-base font-semibold text-foreground tracking-tight">{title}</h4>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {actionLabel && (
        <Button size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default AdminEmptyState;
