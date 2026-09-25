"use client";

import { useCompareStore } from "../stores/compare.store.js";

export function useCompare() {
  const items = useCompareStore((state) => state.items);
  const isHydrated = useCompareStore((state) => state.isHydrated);
  const addItem = useCompareStore((state) => state.addItem);
  const removeItem = useCompareStore((state) => state.removeItem);
  const clearCompare = useCompareStore((state) => state.clearCompare);
  const isInCompare = useCompareStore((state) => state.isInCompare);

  const safeItems = isHydrated ? items : [];

  return {
    items: safeItems,
    itemCount: safeItems.length,
    isHydrated,
    addItem,
    removeItem,
    clearCompare,
    isInCompare,
  };
}

export default useCompare;
