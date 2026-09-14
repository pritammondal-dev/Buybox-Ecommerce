import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./Button.jsx";
import { cn } from "../../utils/cn.js";

export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading this section. Please try again.",
  onRetry,
  className,
}) {
  return (
    <div
      className={cn(
        "flex min-h-[250px] flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center animate-in fade-in-50",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {message && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
