"use client";

import React, { useState, useEffect } from "react";
import { AnnouncementBar } from "../AnnouncementBar.jsx";
import { StorefrontHeader } from "../StorefrontHeader.jsx";
import { CategoryNavigation } from "../CategoryNavigation.jsx";
import { StorefrontFooter } from "../StorefrontFooter.jsx";
import { MobileNavigation } from "../MobileNavigation.jsx";
import { CartDrawer } from "../CartDrawer.jsx";
import { useAuthStore } from "../../../stores/auth.store.js";
import { useCartStore } from "../../../stores/cart.store.js";
import { useWishlistStore } from "../../../stores/wishlist.store.js";
import { useCategoryStore } from "../../../stores/category.store.js";

export function StorefrontShell({ children }) {
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const categories = useCategoryStore((state) => state.categories);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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

  // When authenticated, sync authoritative server cart and wishlist
  useEffect(() => {
    if (isAuthenticated) {
      useCartStore.getState().fetchServerCart().catch(() => {});
      useWishlistStore.getState().fetchWishlist().catch(() => {});

      // If any guest cart items exist, migrate them safely
      const guestCount = useCartStore.getState().guestCart?.items?.length || 0;
      if (guestCount > 0) {
        useCartStore.getState().migrateGuestCartToServer().catch(() => {});
      }
    }
  }, [isAuthenticated]);

  return (
    <div className="relative flex min-h-screen flex-col bg-background font-sans text-foreground">
      {/* Top Announcement Bar */}
      <AnnouncementBar />

      {/* Main Header with Search and Account */}
      <StorefrontHeader
        categories={categories}
        onCartClick={() => setCartDrawerOpen(true)}
      />

      {/* Secondary Category Navigation Strip */}
      <CategoryNavigation categories={categories} />

      {/* Main Page Content Area */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* Dark Navy Slate Footer */}
      <StorefrontFooter categories={categories} />

      {/* Mobile Bottom App Navigation */}
      <MobileNavigation onCartClick={() => setCartDrawerOpen(true)} />

      {/* Slide-out Cart Drawer */}
      <CartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
      />
    </div>
  );
}

export default StorefrontShell;
