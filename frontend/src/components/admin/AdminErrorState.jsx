import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function AdminErrorState({
  title = "Failed to load admin data",
  message = "A server error occurred while retrieving this dataset.",
  onRetry,
  className,
}) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center",
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2.5">
        <AlertCircle className="size-5" aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {message && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5 h-8 text-xs">
          <RotateCcw className="size-3" />
          <span>Retry</span>
        </Button>
      )}
    </div>
  );
}

export default AdminErrorState;
