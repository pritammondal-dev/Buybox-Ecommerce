import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

const MAX_COMPARE_ITEMS = 4;

export const useCompareStore = create(
  persist(
    (set, get) => ({
      items: [],
      isHydrated: false,
      setHydrated: (isHydrated) => set({ isHydrated }),

      addItem: (product) => {
        if (!product) return;
        const currentItems = get().items;
        const prodId = product._id || product.id;

        const alreadyExists = currentItems.some(
          (item) => (item._id || item.id) === prodId
        );

        if (alreadyExists) {
          toast.info("Product is already in your comparison list");
          return;
        }

        if (currentItems.length >= MAX_COMPARE_ITEMS) {
          toast.warning(`You can compare up to ${MAX_COMPARE_ITEMS} products at once.`);
          return;
        }

        // Normalize product snapshot
        const normalizedProduct = {
          _id: prodId,
          id: prodId,
          name: product.name,
          slug: product.slug,
          price: Number(product.price?.$numberDecimal || product.price || 0),
          compareAtPrice: product.compareAtPrice
            ? Number(product.compareAtPrice?.$numberDecimal || product.compareAtPrice || 0)
            : null,
          image: product.images?.[0]?.url || product.image || null,
          ratingAverage: product.ratingAverage || 0,
          ratingCount: product.ratingCount || 0,
          stockStatus: product.stockStatus || "in_stock",
          sku: product.sku || "",
          specifications: product.specifications || {},
          brand: product.brand || null,
          category: product.category || null,
        };

        set({ items: [...currentItems, normalizedProduct] });
        toast.success("Added to product comparison", {
          description: `${product.name} added to compare table.`,
        });
      },

      removeItem: (productId) => {
        const currentItems = get().items;
        const filtered = currentItems.filter(
          (item) => (item._id || item.id) !== productId
        );
        set({ items: filtered });
        toast.info("Removed from comparison list");
      },

      clearCompare: () => {
        set({ items: [] });
      },

      isInCompare: (productId) => {
        if (!productId) return false;
        return get().items.some(
          (item) => (item._id || item.id) === productId
        );
      },
    }),
    {
      name: "buybox_compare_items",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => () => {
        useCompareStore.setState({ isHydrated: true });
      },
    }
  )
);

export default useCompareStore;
