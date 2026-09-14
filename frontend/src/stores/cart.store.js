import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cartService } from "../services/cart.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";

/**
 * Cart Store
 *
 * Architecture:
 * - Guest Cart: Maintained locally via Zustand with localStorage persistence.
 * - Authenticated Cart: Authoritative state loaded from backend `/api/v1/cart`.
 * - Clean Separation: The backend strictly requires authentication for `/cart`.
 * - Migration: Because no `POST /cart/merge` endpoint exists in the backend,
 *   the store provides `migrateGuestCartToServer()` which safely replays guest
 *   items one-by-one via `cartService.addItem()`.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      // Guest cart state (persisted to localStorage)
      guestCart: {
        items: [],
      },

      // Client-side item metadata cache (name, image, sku, slug) keyed by productVariantId
      itemMetadataMap: {},

      // Explicit hydration flag for SSR/client synchronization
      isHydrated: false,
      setHydrated: (isHydrated) => set({ isHydrated }),

      // Authenticated cart state (managed via backend API, never persisted locally)
      serverCart: null,
      isLoading: false,
      isMigrating: false,
      error: null,

      /**
       * Get currently active items based on auth state
       * @param {boolean} isAuthenticated
       */
      getItems: (isAuthenticated = false) => {
        if (isAuthenticated) {
          const serverItems = get().serverCart?.items || [];
          const metadataMap = get().itemMetadataMap || {};
          return serverItems.map((item) => {
            const meta = metadataMap[item.productVariantId] || {};
            const rawPrice =
              item.priceSnapshot?.$numberDecimal !== undefined
                ? Number(item.priceSnapshot.$numberDecimal)
                : Number(item.priceSnapshot || item.unitPrice || item.price || meta.price || 0);

            return {
              ...item,
              name: item.name || meta.name || meta.title || "Product details unavailable",
              title: item.title || meta.title || meta.name || "Product details unavailable",
              image: item.image || meta.image || null,
              sku: item.sku || meta.sku || null,
              slug: item.slug || meta.slug || null,
              unitPrice: rawPrice,
              price: rawPrice,
            };
          });
        }
        return get().guestCart.items;
      },

      /**
       * Get total item count in active cart
       * @param {boolean} isAuthenticated
       */
      getItemCount: (isAuthenticated = false) => {
        const items = get().getItems(isAuthenticated);
        return items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
      },

      /**
       * Get subtotal of active cart
       * @param {boolean} isAuthenticated
       */
      getSubtotal: (isAuthenticated = false) => {
        if (isAuthenticated && get().serverCart?.subtotal !== undefined) {
          return Number(get().serverCart.subtotal) || 0;
        }

        const items = get().getItems(false);
        return items.reduce((total, item) => {
          const price = Number(item.unitPrice || item.price) || 0;
          const qty = Number(item.quantity) || 0;
          return total + price * qty;
        }, 0);
      },

      /**
       * Fetch authoritative cart from backend for authenticated user
       */
      fetchServerCart: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await cartService.getCart();
          const serverCart = response?.data?.cart || response?.data || null;
          set({ serverCart, isLoading: false });
          return serverCart;
        } catch (err) {
          const normalized = normalizeApiError(err);
          set({ isLoading: false, error: normalized.message });
          throw normalized;
        }
      },

      /**
       * Add item to active cart
       * @param {Object} payload
       * @param {string} [payload.productVariantId]
       * @param {string} [payload.productId]
       * @param {number} [payload.quantity=1]
       * @param {Object} [payload.itemSnapshot] Optional display metadata for guest items
       * @param {boolean} isAuthenticated
       */
      addItem: async (
        { productVariantId, productId, quantity = 1, itemSnapshot = {} },
        isAuthenticated = false
      ) => {
        // Record metadata snapshot if provided
        const key = productVariantId || productId;
        if (itemSnapshot && Object.keys(itemSnapshot).length > 0 && key) {
          set((state) => ({
            itemMetadataMap: {
              ...state.itemMetadataMap,
              [key]: {
                ...(state.itemMetadataMap?.[key] || {}),
                ...itemSnapshot,
              },
            },
          }));
        }

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            const response = await cartService.addItem({
              productVariantId,
              productId,
              quantity,
            });
            const serverCart = response?.data?.cart || response?.data || null;
            set({ serverCart, isLoading: false });
            return serverCart;
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        }

        // Guest cart update
        const currentItems = [...get().guestCart.items];
        const existingIndex = currentItems.findIndex((item) => {
          if (productVariantId && item.productVariantId) {
            return item.productVariantId === productVariantId;
          }
          if (productId && item.productId) {
            return item.productId === productId;
          }
          return false;
        });

        if (existingIndex > -1) {
          const newQuantity = Math.min(
            99,
            currentItems[existingIndex].quantity + quantity
          );
          currentItems[existingIndex] = {
            ...currentItems[existingIndex],
            quantity: newQuantity,
            ...itemSnapshot,
          };
        } else {
          currentItems.push({
            ...(productVariantId ? { productVariantId } : {}),
            ...(productId ? { productId } : {}),
            quantity: Math.min(99, Math.max(1, quantity)),
            ...itemSnapshot,
            addedAt: new Date().toISOString(),
          });
        }

        set({ guestCart: { items: currentItems } });
      },

      /**
       * Update item quantity in active cart
       * @param {Object} payload
       * @param {string} payload.productVariantId
       * @param {number} payload.quantity
       * @param {boolean} isAuthenticated
       */
      updateQuantity: async ({ productVariantId, quantity }, isAuthenticated = false) => {
        if (quantity <= 0) {
          return get().removeItem({ productVariantId }, isAuthenticated);
        }

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            const response = await cartService.updateItemQuantity({
              productVariantId,
              quantity,
            });
            const serverCart = response?.data?.cart || response?.data || null;
            set({ serverCart, isLoading: false });
            return serverCart;
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        }

        // Guest cart quantity update
        const currentItems = get().guestCart.items.map((item) => {
          if (item.productVariantId === productVariantId) {
            return { ...item, quantity: Math.min(99, Math.max(1, quantity)) };
          }
          return item;
        });

        set({ guestCart: { items: currentItems } });
      },

      /**
       * Remove item from active cart
       * @param {Object} payload
       * @param {string} payload.productVariantId
       * @param {boolean} isAuthenticated
       */
      removeItem: async ({ productVariantId }, isAuthenticated = false) => {
        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            const response = await cartService.removeItem({ productVariantId });
            const serverCart = response?.data?.cart || response?.data || null;
            set({ serverCart, isLoading: false });
            return serverCart;
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        }

        // Guest cart removal
        const filtered = get().guestCart.items.filter(
          (item) => item.productVariantId !== productVariantId
        );
        set({ guestCart: { items: filtered } });
      },

      /**
       * Clear all items from active cart
       * @param {boolean} isAuthenticated
       */
      clearCart: async (isAuthenticated = false) => {
        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            await cartService.clearCart();
            set({
              serverCart: { items: [], subtotal: "0.00", itemCount: 0 },
              isLoading: false,
            });
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        } else {
          set({ guestCart: { items: [] } });
        }
      },

      /**
       * Clear guest cart explicitly
       */
      clearGuestCart: () => {
        set({ guestCart: { items: [] } });
      },

      /**
       * Clear server cart on logout
       */
      clearServerCart: () => {
        set({ serverCart: null });
      },

      /**
       * Migrate guest cart items to backend upon login.
       *
       * ARCHITECTURAL LIMITATION NOTE:
       * The backend does NOT currently support a bulk `/cart/merge` endpoint.
       * Therefore, this method iterates through each guest cart item and calls
       * `cartService.addItem({ productVariantId, quantity })` sequentially.
       * If an item succeeds, it is safely removed from guestCart.
       * If an item fails (e.g. stock exhausted), it remains in guestCart so data is not lost.
       *
       * When a future backend merge endpoint is built, this action can be updated
       * to call `cartService.mergeCart(guestCart.items)` in a single transaction.
       */
      migrateGuestCartToServer: async () => {
        const guestItems = [...get().guestCart.items];
        if (guestItems.length === 0) {
          return { success: true, migratedCount: 0, failedItems: [] };
        }

        set({ isMigrating: true, error: null });
        const failedItems = [];
        let migratedCount = 0;

        for (const item of guestItems) {
          try {
            await cartService.addItem({
              productVariantId: item.productVariantId,
              productId: item.productId,
              quantity: item.quantity,
            });
            migratedCount += 1;
            // Remove from guest cart as it successfully migrates
            set((state) => ({
              guestCart: {
                items: state.guestCart.items.filter((i) => {
                  if (item.productVariantId && i.productVariantId) {
                    return i.productVariantId !== item.productVariantId;
                  }
                  if (item.productId && i.productId) {
                    return i.productId !== item.productId;
                  }
                  return true;
                }),
              },
            }));
          } catch (itemErr) {
            failedItems.push({
              item,
              error: normalizeApiError(itemErr).message,
            });
          }
        }

        // Fetch refreshed authoritative server cart
        try {
          await get().fetchServerCart();
        } catch {
          // Ignore secondary fetch error
        }

        set({ isMigrating: false });
        return {
          success: failedItems.length === 0,
          migratedCount,
          failedItems,
        };
      },
    }),
    {
      name: "buybox_guest_cart",
      // Persist the guestCart slice and itemMetadataMap to localStorage.
      // Server cart is always fetched fresh from the backend.
      partialize: (state) => ({
        guestCart: state.guestCart,
        itemMetadataMap: state.itemMetadataMap || {},
      }),
      onRehydrateStorage: () => () => {
        useCartStore.setState({ isHydrated: true });
      },
    }
  )
);

export default useCartStore;
