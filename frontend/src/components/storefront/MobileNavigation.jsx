"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Heart, ShoppingBag, User } from "lucide-react";
import { useCart } from "../../hooks/useCart.js";
import { useWishlist } from "../../hooks/useWishlist.js";
import { cn } from "../../utils/cn.js";

export function MobileNavigation({ className, onCartClick }) {
  const pathname = usePathname();
  const { itemCount = 0, isHydrated: isCartHydrated } = useCart();
  const { itemCount: wishlistCount = 0, isHydrated: isWishlistHydrated } = useWishlist();

  const NAV_ITEMS = [
    { label: "Home", href: "/", icon: Home },
    { label: "Shop", href: "/shop", icon: Compass },
    {
      label: "Wishlist",
      href: "/account/wishlist",
      icon: Heart,
      badge: isWishlistHydrated ? wishlistCount : 0,
    },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingBag,
      badge: isCartHydrated ? itemCount : 0,
      isAction: Boolean(onCartClick),
    },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-md px-2 md:hidden shadow-lg",
        className
      )}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        if (item.isAction) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={onCartClick}
              aria-label={item.badge > 0 ? `Shopping cart with ${item.badge} items` : "Shopping cart"}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center py-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="mt-1">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.badge > 0 ? `${item.label} with ${item.badge} items` : item.label}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center py-1 text-xs font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="size-5" />
              {item.badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </div>
            <span className="mt-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default MobileNavigation;
