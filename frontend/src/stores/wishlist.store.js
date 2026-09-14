import { create } from "zustand";
import { persist } from "zustand/middleware";
import { wishlistService } from "../services/wishlist.service.js";
import { normalizeApiError } from "../lib/api/api-error.js";

/**
 * Wishlist Store
 *
 * Architecture:
 * - Authenticated Wishlist: Authoritatively fetched from backend `/api/v1/wishlist`.
 * - Guest Wishlist: Kept explicitly separate in local storage as a list of productVariantIds.
 * - No guest backend endpoints are invented.
 */
export const useWishlistStore = create(
  persist(
    (set, get) => ({
      // Local guest wishlist item variant IDs
      guestWishlist: {
        itemVariantIds: [],
      },

      // Explicit hydration flag for SSR/client synchronization
      isHydrated: false,
      setHydrated: (isHydrated) => set({ isHydrated }),

      // Authenticated backend wishlist
      serverWishlist: null,
      isLoading: false,
      error: null,

      /**
       * Fetch backend wishlist for authenticated user
       */
      fetchWishlist: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await wishlistService.getWishlist();
          const serverWishlist =
            response?.data?.wishlist || response?.data || null;
          set({ serverWishlist, isLoading: false });
          return serverWishlist;
        } catch (err) {
          const normalized = normalizeApiError(err);
          set({ isLoading: false, error: normalized.message });
          throw normalized;
        }
      },

      /**
       * Check whether a product or variant is in the active wishlist
       * @param {string} identifier - productId or productVariantId
       * @param {boolean} isAuthenticated
       * @returns {boolean}
       */
      isInWishlist: (identifier, isAuthenticated = false) => {
        if (!identifier) return false;
        if (isAuthenticated) {
          const items = get().serverWishlist?.items || [];
          return items.some((item) => {
            const prodId = item.productId?._id || item.productId;
            const variantId =
              item.productVariantId?._id || item.productVariantId;
            return prodId === identifier || variantId === identifier;
          });
        }
        return get().guestWishlist.itemVariantIds.includes(identifier);
      },

      /**
       * Add a product / variant to active wishlist
       * @param {string|Object} productOrVariantId
       * @param {string|boolean} [maybeVariantId]
       * @param {boolean} [maybeAuth]
       */
      addItem: async (productOrVariantId, maybeVariantId = null, maybeAuth = false) => {
        let productId = productOrVariantId;
        let productVariantId = maybeVariantId;
        let isAuthenticated = maybeAuth;

        if (typeof maybeVariantId === "boolean") {
          isAuthenticated = maybeVariantId;
          productVariantId = null;
        } else if (typeof productOrVariantId === "object" && productOrVariantId !== null) {
          productId = productOrVariantId.productId || productOrVariantId._id;
          productVariantId = productOrVariantId.productVariantId || null;
          if (typeof maybeVariantId === "boolean") {
            isAuthenticated = maybeVariantId;
          }
        }

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            const response = await wishlistService.addItem({ productId, productVariantId });
            const serverWishlist =
              response?.data?.wishlist || response?.data || null;
            set({ serverWishlist, isLoading: false });
            return serverWishlist;
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        }

        // Guest wishlist update
        const idToStore = productVariantId || productId;
        if (idToStore) {
          const currentIds = get().guestWishlist.itemVariantIds;
          if (!currentIds.includes(idToStore)) {
            set({
              guestWishlist: {
                itemVariantIds: [...currentIds, idToStore],
              },
            });
          }
        }
      },

      /**
       * Remove item from wishlist
       * For authenticated users, accepts either the backend wishlist itemId OR the productId / productVariantId.
       * For guest users, accepts the productVariantId / productId.
       * @param {string} identifier - itemId, productId, or productVariantId
       * @param {boolean} isAuthenticated
       */
      removeItem: async (identifier, isAuthenticated = false) => {
        if (!identifier) return;

        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            const currentItems = get().serverWishlist?.items || [];

            // 1. Check if identifier is already an exact match for item._id (wishlist subdocument item ID)
            let targetItem = currentItems.find((i) => i._id === identifier);

            // 2. If not found by item._id, match by productId or productVariantId (supporting populated and unpopulated shapes)
            if (!targetItem) {
              targetItem = currentItems.find((i) => {
                const prodId =
                  typeof i.productId === "object" && i.productId !== null
                    ? (i.productId._id || i.productId.id)
                    : i.productId;
                const variantId =
                  typeof i.productVariantId === "object" && i.productVariantId !== null
                    ? (i.productVariantId._id || i.productVariantId.id)
                    : i.productVariantId;
                return prodId === identifier || variantId === identifier;
              });
            }

            // 3. If the item isn't in serverWishlist, handle gracefully (nothing to delete on server)
            if (!targetItem) {
              set({ isLoading: false });
              return;
            }

            const wishlistItemId = targetItem._id;
            await wishlistService.removeItem(wishlistItemId);

            // 4. Update local serverWishlist cache only after backend deletion succeeds
            const filtered = currentItems.filter((i) => i._id !== wishlistItemId);
            set({
              serverWishlist: {
                ...get().serverWishlist,
                items: filtered,
              },
              isLoading: false,
            });
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
          return;
        }

        // Guest wishlist removal
        set({
          guestWishlist: {
            itemVariantIds: get().guestWishlist.itemVariantIds.filter(
              (id) => id !== identifier
            ),
          },
        });
      },


      /**
       * Clear all wishlist items
       * @param {boolean} isAuthenticated
       */
      clearWishlist: async (isAuthenticated = false) => {
        if (isAuthenticated) {
          set({ isLoading: true, error: null });
          try {
            await wishlistService.clearWishlist();
            set({
              serverWishlist: { items: [] },
              isLoading: false,
            });
          } catch (err) {
            const normalized = normalizeApiError(err);
            set({ isLoading: false, error: normalized.message });
            throw normalized;
          }
        } else {
          set({ guestWishlist: { itemVariantIds: [] } });
        }
      },

      /**
       * Reset server wishlist on logout
       */
      clearServerWishlist: () => {
        set({ serverWishlist: null });
      },
    }),
    {
      name: "buybox_guest_wishlist",
      partialize: (state) => ({ guestWishlist: state.guestWishlist }),
      onRehydrateStorage: () => () => {
        useWishlistStore.setState({ isHydrated: true });
      },
    }
  )
);

export default useWishlistStore;
