import { create } from "zustand";
import { categoryService } from "../services/category.service.js";

/**
 * Global Store for Storefront Categories
 * Ensures categories are fetched once at the shell/layout level
 * and shared across Header, Category Navigation, Footer, and Homepage
 * with zero redundant network requests.
 */
export const useCategoryStore = create((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,
  isHydrated: false,

  fetchCategories: async (force = false) => {
    if (get().categories.length > 0 && !force) {
      return get().categories;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await categoryService.getCategories({ limit: 50 });
      const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
      const validCategories = Array.isArray(list) ? list : [];
      set({ categories: validCategories, isLoading: false, isHydrated: true });
      return validCategories;
    } catch (err) {
      set({
        error: err?.message || "Failed to load categories",
        isLoading: false,
        isHydrated: true,
      });
      return [];
    }
  },
}));

export default useCategoryStore;
