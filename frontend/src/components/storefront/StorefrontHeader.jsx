"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Heart,
  User,
  Menu,
  PhoneCall,
  LogOut,
  PackageCheck,
  MapPin,
  Settings,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { SearchBar } from "./SearchBar.jsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/Sheet.jsx";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/DropdownMenu.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useCart } from "../../hooks/useCart.js";
import { useWishlist } from "../../hooks/useWishlist.js";
import { categoryService } from "../../services/category.service.js";
import { formatCurrency } from "../../utils/formatCurrency.js";
import { cn } from "../../utils/cn.js";

export function StorefrontHeader({ categories: propCategories, onCartClick, className }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount = 0, subtotal = 0, isHydrated: isCartHydrated } = useCart();
  const { itemCount: wishlistCount = 0, isHydrated: isWishlistHydrated } = useWishlist();

  const [internalCategories, setInternalCategories] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

  // Fetch real categories if not provided via props
  useEffect(() => {
    if (propCategories && propCategories.length > 0) return;

    let isMounted = true;
    categoryService
      .getCategories({ limit: 50 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
        setInternalCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b bg-white backdrop-blur-md shadow-xs", className)}>
      {/* Main Header Row */}
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Hamburger & Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile navigation menu"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-input text-foreground hover:bg-muted lg:hidden cursor-pointer"
          >
            <Menu className="size-5" />
          </button>

          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs transition-transform group-hover:scale-105">
              <ShoppingBag className="size-5 stroke-[2.2]" />
            </div>
            <span className="text-2xl font-black tracking-tight text-[#007A55]">
              Buybox
            </span>
          </Link>
        </div>

        {/* Center: Search Bar with Autocomplete & Category Scope */}
        <div className="hidden md:flex flex-1 max-w-2xl mx-2 lg:mx-6">
          <SearchBar
            categories={categories}
            placeholder="Search products, brands and categories..."
          />
        </div>

        {/* Right Section: Support, Account, Wishlist, Cart */}
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-6">
          {/* Hotline / 24/7 Support */}
          <div className="hidden xl:flex items-center gap-2.5 pl-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
              <PhoneCall className="size-4 stroke-[2.2]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-medium text-muted-foreground">24/7 Support</span>
              <span className="text-xs font-bold text-foreground">+800-777-003</span>
            </div>
          </div>

          {/* User Account Flyout (Amazon / Flipkart inspired) */}
          <DropdownMenu
            align="right"
            trigger={
              <button
                type="button"
                aria-label="User account menu"
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                {isAuthenticated ? (
                  <div className="flex size-9 items-center justify-center rounded-full bg-[#007A55] text-white text-xs font-bold shadow-xs">
                    {user?.firstName?.charAt(0) || "U"}
                  </div>
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-full border border-border text-foreground hover:border-[#007A55] hover:text-[#007A55] transition-colors">
                    <User className="size-4" />
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {isAuthenticated ? `Hello, ${user?.firstName || "User"}` : "Hello, Sign in"}
                    <ChevronDown className="size-3 text-muted-foreground opacity-70" />
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {isAuthenticated ? "Account & Orders" : "Account & Lists"}
                  </span>
                </div>
              </button>
            }
          >
            {isAuthenticated ? (
              <>
                <DropdownMenuLabel>
                  <p className="font-bold text-foreground text-sm">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account/profile" className="flex items-center gap-2.5 w-full cursor-pointer">
                    <User className="size-4 text-[#007A55]" />
                    <span>My Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/orders" className="flex items-center gap-2.5 w-full cursor-pointer">
                    <PackageCheck className="size-4 text-[#007A55]" />
                    <span>My Orders</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/addresses" className="flex items-center gap-2.5 w-full cursor-pointer">
                    <MapPin className="size-4 text-[#007A55]" />
                    <span>Saved Addresses</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/wishlist" className="flex items-center gap-2.5 w-full cursor-pointer">
                    <Heart className="size-4 text-[#007A55]" />
                    <span>My Wishlist ({isWishlistHydrated ? wishlistCount : 0})</span>
                  </Link>
                </DropdownMenuItem>
                {user?.role && user.role !== "customer" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2.5 w-full text-primary font-bold cursor-pointer">
                        <Settings className="size-4" />
                        <span>Admin Portal</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="size-4 mr-2" />
                  <span className="font-semibold">Sign Out</span>
                </DropdownMenuItem>
              </>
            ) : (
              <div className="p-3 w-64 space-y-3">
                <Link
                  href="/auth/login"
                  className="flex w-full items-center justify-center rounded-full bg-[#007A55] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all"
                >
                  Sign In
                </Link>
                <div className="text-center text-xs text-muted-foreground">
                  New customer?{" "}
                  <Link href="/auth/register" className="font-bold text-[#007A55] hover:underline">
                    Start here
                  </Link>
                </div>
                <div className="border-t border-border pt-2 space-y-1 text-xs">
                  <Link
                    href="/account/orders"
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 font-medium text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <span>Your Orders</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/account/wishlist"
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 font-medium text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <span>Your Wishlist</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Link>
                  <Link
                    href="/shop"
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 font-medium text-foreground hover:bg-slate-50 transition-colors"
                  >
                    <span>Help & Customer Care</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            )}
          </DropdownMenu>

          {/* Wishlist Icon */}
          <Link
            href="/account/wishlist"
            aria-label={isWishlistHydrated && wishlistCount > 0 ? `Wishlist with ${wishlistCount} items` : "Wishlist"}
            className="relative flex items-center justify-center text-foreground hover:text-[#007A55] transition-colors"
          >
            <div className="flex size-9 items-center justify-center rounded-full border border-border hover:border-[#007A55] transition-colors">
              <Heart className="size-4" />
            </div>
            {isWishlistHydrated && wishlistCount > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#007A55] text-[10px] font-bold text-white shadow-xs">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart Icon & Subtotal (opens Mini-Cart Drawer) */}
          <button
            type="button"
            onClick={onCartClick}
            aria-label={isCartHydrated && itemCount > 0 ? `Open shopping cart with ${itemCount} items` : "Open shopping cart"}
            className="relative flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="relative flex size-9 items-center justify-center rounded-full border border-border text-foreground hover:border-[#007A55] hover:text-[#007A55] transition-colors">
              <ShoppingBag className="size-4" />
              {isCartHydrated && itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#007A55] text-[10px] font-bold text-white shadow-xs">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-[11px] text-muted-foreground">Cart</span>
              <span className="text-xs font-extrabold text-[#007A55]">
                {formatCurrency(isCartHydrated ? subtotal : 0)}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Row */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBar
          categories={categories}
          placeholder="Search products, brands..."
        />
      </div>

      {/* Mobile Slide-Over Drawer Menu */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[310px] p-0 flex flex-col justify-between">
          <div className="overflow-y-auto">
            <SheetHeader className="p-4 border-b bg-emerald-50/50">
              <SheetTitle>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-[#007A55] text-white">
                    <ShoppingBag className="size-4.5" />
                  </div>
                  <span className="font-black text-xl text-[#007A55]">Buybox</span>
                </div>
              </SheetTitle>

              {/* User Banner in Drawer */}
              <div className="pt-3">
                {isAuthenticated ? (
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#007A55] text-white text-xs font-bold">
                      {user?.firstName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Hello, {user?.firstName}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{user?.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/auth/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 rounded-full bg-[#007A55] py-2 text-center text-xs font-bold text-white shadow-xs"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/auth/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex-1 rounded-full border border-border bg-white py-2 text-center text-xs font-bold text-foreground"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </SheetHeader>

            <div className="p-4 space-y-5">
              {/* Main Navigation Links */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Explore
                </p>
                <div className="space-y-1 text-sm font-medium">
                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-slate-50"
                  >
                    Home
                  </Link>
                  <Link
                    href="/shop"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-slate-50"
                  >
                    Shop All Products
                  </Link>
                  <Link
                    href="/shop?sort=discount"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50 font-bold"
                  >
                    <span>Today&apos;s Hot Deals</span>
                    <span className="rounded bg-[#E02424] px-1.5 py-0.5 text-[9px] text-white">HOT</span>
                  </Link>
                  <Link
                    href="/shop?sort=newest"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-slate-50"
                  >
                    New Arrivals
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-foreground hover:bg-slate-50"
                  >
                    Track Order
                  </Link>
                </div>
              </div>

              {/* Dynamic Categories Section */}
              {categories.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Categories
                  </p>
                  <div className="space-y-1 text-sm">
                    {categories.map((cat) => {
                      const id = cat.id || cat._id;
                      const slug = cat.slug || id;
                      return (
                        <Link
                          key={id}
                          href={`/category/${slug}`}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-foreground hover:bg-emerald-50 hover:text-[#007A55]"
                        >
                          <span>{cat.name}</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Hotline */}
          <div className="border-t p-4 bg-slate-50">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <PhoneCall className="size-3.5 text-[#007A55]" />
              <span>Support: 800-777-003</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-[#007A55]" />
              <span>Genuine Warranty & Safe Delivery</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

export default StorefrontHeader;
