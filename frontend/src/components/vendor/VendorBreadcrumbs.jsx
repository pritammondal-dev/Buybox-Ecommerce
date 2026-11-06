"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

/**
 * Accessible Seller Console Breadcrumbs Navigation
 *
 * @param {Object} props
 * @param {Array<{ label: string, href?: string }>} props.items
 * @param {string} [props.className]
 */
export function VendorBreadcrumbs({ items = [], className = "" }) {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center text-xs text-slate-500 overflow-x-auto whitespace-nowrap py-1 ${className}`}
    >
      <ol className="flex items-center gap-1.5 list-none m-0 p-0">
        <li className="flex items-center">
          <Link
            href="/vendor/dashboard"
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors"
            title="Merchant Dashboard"
          >
            <Home className="size-3.5" />
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;

          return (
            <li key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="size-3 text-slate-300 shrink-0" aria-hidden="true" />
              {isLast || !item.href ? (
                <span
                  className="font-semibold text-slate-800 truncate max-w-[200px]"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-slate-900 transition-colors truncate max-w-[160px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default VendorBreadcrumbs;

