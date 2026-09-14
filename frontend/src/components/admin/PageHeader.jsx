import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { cn } from "../../utils/cn.js";

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  children,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b",
        className
      )}
    >
      <div className="space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>{backLabel}</span>
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
