"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Flame, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn.js";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop All", href: "/shop" },
  { label: "Categories", href: "/shop", hasDropdown: true },
  { label: "Today's Deals", href: "/shop?sort=discount", isHot: true },
  { label: "New Arrivals", href: "/shop?sort=newest", isNew: true },
  { label: "Track Order", href: "/account/orders" },
];

export function MainNavigation({ className }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn("hidden lg:flex items-center gap-6 text-sm font-medium", className)}
    >
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;

        return (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              "flex items-center gap-1 transition-colors py-1 hover:text-primary",
              isActive ? "text-primary font-semibold" : "text-foreground/80"
            )}
          >
            {link.isHot && <Flame className="size-3.5 text-rose-500 fill-rose-500" />}
            {link.isNew && <Sparkles className="size-3.5 text-amber-500" />}
            <span>{link.label}</span>
            {link.hasDropdown && (
              <ChevronDown className="size-3.5 text-muted-foreground opacity-60" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default MainNavigation;
