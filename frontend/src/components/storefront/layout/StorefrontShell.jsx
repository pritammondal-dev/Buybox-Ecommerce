"use client";

import React, { useState, useEffect } from "react";
import { AnnouncementBar } from "../AnnouncementBar.jsx";
import { StorefrontHeader } from "../StorefrontHeader.jsx";
import { MainShoppingNav } from "../navigation/MainShoppingNav.jsx";
import { CategoryNavBar } from "../navigation/CategoryNavBar.jsx";
import { CategoryDrawer } from "../navigation/CategoryDrawer.jsx";
import { StorefrontFooter } from "../StorefrontFooter.jsx";
import { MobileNavigation } from "../MobileNavigation.jsx";
import { CartDrawer } from "../CartDrawer.jsx";
import { useAuthStore } from "../../../stores/auth.store.js";
import { useCartStore } from "../../../stores/cart.store.js";
import { useWishlistStore } from "../../../stores/wishlist.store.js";
import { useCategoryStore } from "../../../stores/category.store.js";
import { useAddressStore } from "../../../stores/address.store.js";

export function StorefrontShell({ children }) {
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const categories = useCategoryStore((state) => state.categories);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Client hydration, session synchronization, and centralized categories load
  useEffect(() => {
    // Mark stores hydrated on client mount
    useCartStore.getState().setHydrated(true);
    useWishlistStore.getState().setHydrated(true);

    // Silently probe refresh endpoint for active session
    useAuthStore.getState().initializeAuth();

    // Centralized fetch of categories once for all storefront components
    useCategoryStore.getState().fetchCategories().catch(() => {});
  }, []);

  // When authenticated as customer, sync authoritative server cart, wishlist, and delivery addresses
  useEffect(() => {
    const isCustomerUser = !user?.role || user?.role === "customer";
    if (isAuthenticated && isCustomerUser) {
      useCartStore.getState().fetchServerCart().catch(() => {});
      useWishlistStore.getState().fetchWishlist().catch(() => {});
      useAddressStore.getState().fetchAddresses().catch(() => {});

      // If any guest cart items exist, migrate them safely
      const guestCount = useCartStore.getState().guestCart?.items?.length || 0;
      if (guestCount > 0) {
        useCartStore.getState().migrateGuestCartToServer().catch(() => {});
      }
    } else if (!isAuthenticated) {
      useAddressStore.getState().clear();
    }
  }, [isAuthenticated, user?.role]);

  return (
    <div className="relative flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* Top Announcement Utility Bar */}
      <AnnouncementBar />

      {/* Main Header with Logo, Search, Account, Wishlist, Cart */}
      <StorefrontHeader
        categories={categories}
        onCartClick={() => setCartDrawerOpen(true)}
      />

      {/* Level 1: Main Shopping Navigation */}
      <MainShoppingNav />

      {/* Level 2: Category Navigation Strip */}
      <CategoryNavBar
        categories={categories}
        onOpenDrawer={() => setCategoryDrawerOpen(true)}
      />

      {/* Main Page Content Area */}
      <main className="flex-1 pb-20 md:pb-0 bg-[#F4F6F8]">
        {children}
      </main>

      {/* Footer */}
      <StorefrontFooter categories={categories} />

      {/* Mobile Bottom App Navigation */}
      <MobileNavigation onCartClick={() => setCartDrawerOpen(true)} />

      {/* Side-sliding Category Drawer */}
      <CategoryDrawer
        isOpen={categoryDrawerOpen}
        onClose={() => setCategoryDrawerOpen(false)}
        categories={categories}
      />

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
      />
    </div>
  );
}

export default StorefrontShell;
