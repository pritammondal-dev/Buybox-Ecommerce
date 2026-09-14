"use client";

import { useWishlistStore } from "../stores/wishlist.store.js";
import { useAuthStore } from "../stores/auth.store.js";

/**
 * Reusable Wishlist Hook
 *
 * Automatically harmonizes wishlist actions with current authentication state.
 */
export function useWishlist() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const isHydrated = useWishlistStore((state) => state.isHydrated);
  const serverWishlist = useWishlistStore((state) => state.serverWishlist);
  const guestWishlist = useWishlistStore((state) => state.guestWishlist);
  const isLoading = useWishlistStore((state) => state.isLoading);
  const error = useWishlistStore((state) => state.error);

  const isInWishlistStore = useWishlistStore((state) => state.isInWishlist);
  const addItemStore = useWishlistStore((state) => state.addItem);
  const removeItemStore = useWishlistStore((state) => state.removeItem);
  const clearWishlistStore = useWishlistStore((state) => state.clearWishlist);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);

  const rawItems = isAuthenticated
    ? serverWishlist?.items || []
    : guestWishlist.itemVariantIds;

  // Prior to client hydration, render stable initial state (0 items) to prevent SSR mismatch
  const items = isHydrated || isAuthenticated ? rawItems : [];
  const itemCount = isHydrated || isAuthenticated ? rawItems.length : 0;

  return {
    items,
    itemCount,
    isHydrated,
    isLoading,
    error,
    isAuthenticated,
    isInWishlist: (identifier) =>
      isInWishlistStore(identifier, isAuthenticated),
    addItem: (productOrVariantId, maybeVariantId = null) =>
      addItemStore(productOrVariantId, maybeVariantId, isAuthenticated),
    removeItem: (identifier) =>
      removeItemStore(identifier, isAuthenticated),
    clearWishlist: () => clearWishlistStore(isAuthenticated),
    fetchWishlist,
  };
}

export default useWishlist;
