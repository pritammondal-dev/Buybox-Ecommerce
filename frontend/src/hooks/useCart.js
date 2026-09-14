"use client";

import { useCartStore } from "../stores/cart.store.js";
import { useAuthStore } from "../stores/auth.store.js";

/**
 * Reusable Cart Hook
 *
 * Automatically harmonizes the authenticated status between auth store and cart store,
 * providing a unified API for cart UI components regardless of guest or authenticated state.
 */
export function useCart() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const isHydrated = useCartStore((state) => state.isHydrated);
  const guestCart = useCartStore((state) => state.guestCart);
  const serverCart = useCartStore((state) => state.serverCart);
  const isLoading = useCartStore((state) => state.isLoading);
  const isMigrating = useCartStore((state) => state.isMigrating);
  const error = useCartStore((state) => state.error);

  const getItems = useCartStore((state) => state.getItems);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const getSubtotal = useCartStore((state) => state.getSubtotal);
  const addItemStore = useCartStore((state) => state.addItem);
  const updateQuantityStore = useCartStore((state) => state.updateQuantity);
  const removeItemStore = useCartStore((state) => state.removeItem);
  const clearCartStore = useCartStore((state) => state.clearCart);
  const fetchServerCart = useCartStore((state) => state.fetchServerCart);
  const migrateGuestCartToServer = useCartStore(
    (state) => state.migrateGuestCartToServer
  );

  const rawItems = getItems(isAuthenticated);
  const rawItemCount = getItemCount(isAuthenticated);
  const rawSubtotal = getSubtotal(isAuthenticated);

  const items = isHydrated || isAuthenticated ? rawItems : [];
  const itemCount = isHydrated || isAuthenticated ? rawItemCount : 0;
  const subtotal = isHydrated || isAuthenticated ? rawSubtotal : 0;
  const hasGuestItems = guestCart.items.length > 0;

  const shippingTotal =
    isAuthenticated && serverCart?.shippingTotal !== undefined
      ? Number(serverCart.shippingTotal) || 0
      : 0;
  const taxTotal =
    isAuthenticated && serverCart?.taxTotal !== undefined
      ? Number(serverCart.taxTotal) || 0
      : 0;
  const discountTotal =
    isAuthenticated && serverCart?.discountTotal !== undefined
      ? Number(serverCart.discountTotal) || 0
      : 0;
  const grandTotal =
    isAuthenticated && serverCart?.grandTotal !== undefined
      ? Number(serverCart.grandTotal) || 0
      : null;

  return {
    items,
    itemCount,
    subtotal,
    shippingTotal,
    taxTotal,
    discountTotal,
    grandTotal,
    isHydrated,
    isLoading,
    isMigrating,
    error,
    isAuthenticated,
    hasGuestItems,
    guestItemCount: guestCart.items.length,

    // Actions pre-wired with current auth state
    addItem: (payload) => addItemStore(payload, isAuthenticated),
    updateQuantity: (payload) => updateQuantityStore(payload, isAuthenticated),
    removeItem: (payload) => removeItemStore(payload, isAuthenticated),
    clearCart: () => clearCartStore(isAuthenticated),
    fetchServerCart,
    migrateGuestCartToServer,
  };
}

export default useCart;
