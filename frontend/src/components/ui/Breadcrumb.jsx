import React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "../../utils/cn.js";

export function Breadcrumb({ className, ...props }) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn("flex flex-wrap items-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function BreadcrumbList({ className, ...props }) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1.5 break-words", className)}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }) {
  return (
    <li className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  );
}

export function BreadcrumbLink({ href, className, children, ...props }) {
  return (
    <Link
      href={href}
      className={cn("transition-colors hover:text-foreground", className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function BreadcrumbPage({ className, children, ...props }) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function BreadcrumbSeparator({ children, className, ...props }) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5 text-muted-foreground", className)}
      {...props}
    >
      {children || <ChevronRight />}
    </li>
  );
}

export default Breadcrumb;
