import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "../../utils/cn.js";

export function SectionHeading({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = "View All",
  className,
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4", className)}>
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
        >
          <span>{viewAllLabel}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export default SectionHeading;
