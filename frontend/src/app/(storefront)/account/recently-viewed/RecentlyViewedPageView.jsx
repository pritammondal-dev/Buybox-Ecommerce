"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { History, Trash2, ShoppingCart, Star, ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";
import { useCartStore } from "../../../../stores/cart.store.js";
import { formatCurrency } from "../../../../utils/formatCurrency.js";
import {
  getRecentlyViewedIds,
  removeRecentlyViewedId,
  clearRecentlyViewed,
  getCanonicalProductId,
  deduplicateProducts,
} from "../../../../utils/recentlyViewed.js";
import { productService } from "../../../../services/product.service.js";

export function RecentlyViewedPageView() {
  // Deterministic initial state: identical on server render and initial client hydration
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    let active = true;

    async function loadRecentlyViewed() {
      try {
        const rawIds = getRecentlyViewedIds();
        if (!rawIds || rawIds.length === 0) {
          if (active) {
            setItems([]);
            setIsLoading(false);
            setIsMounted(true);
          }
          return;
        }

        // Deduplicate raw identifiers to prevent duplicate fetches & keys
        const uniqueIds = Array.from(
          new Set(
            rawIds
              .map((id) => (typeof id === "string" ? id.trim() : getCanonicalProductId(id)))
              .filter(Boolean)
          )
        );

        if (uniqueIds.length === 0) {
          if (active) {
            setItems([]);
            setIsLoading(false);
            setIsMounted(true);
          }
          return;
        }

        // Fetch product details for IDs concurrently
        const fetchResults = await Promise.allSettled(
          uniqueIds.slice(0, 20).map((id) => productService.getProductById(id))
        );

        if (!active) return;

        const resolvedProducts = [];
        fetchResults.forEach((res, index) => {
          if (res.status === "fulfilled" && res.value?.data) {
            const prod =
              res.value.data.product ||
              (res.value.data._id ? res.value.data : null);
            if (prod) {
              resolvedProducts.push(prod);
            }
          } else {
            // If product was deleted or 404s, clean up storage entry
            removeRecentlyViewedId(uniqueIds[index]);
          }
        });

        const cleanList = deduplicateProducts(resolvedProducts);
        setItems(cleanList);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsMounted(true);
        }
      }
    }

    loadRecentlyViewed();

    return () => {
      active = false;
    };
  }, []);

  const handleClearHistory = () => {
    try {
      clearRecentlyViewed();
      setItems([]);
      toast.success("Browsing history cleared.");
    } catch {
      // fallback
    }
  };

  const handleRemoveItem = (productId) => {
    const canonicalId = getCanonicalProductId(productId);
    if (!canonicalId) return;

    try {
      removeRecentlyViewedId(canonicalId);
      setItems((prev) =>
        prev.filter((p) => getCanonicalProductId(p) !== canonicalId)
      );
      toast.info("Item removed from history.");
    } catch {
      // fallback
    }
  };

  const handleAddToCart = async (prod) => {
    try {
      await addItem(prod, 1);
      toast.success(`${prod.name} added to cart!`);
    } catch {
      toast.error("Could not add item to cart.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900">Recently Viewed</h1>
                <p className="text-xs text-slate-500">
                  Products you&apos;ve browsed recently on this device.
                </p>
              </div>

              {/* Render Clear History button strictly after client hydration when items exist */}
              {isMounted && items.length > 0 && (
                <button
                  type="button"
                  id="clear-recently-viewed-btn"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear History
                </button>
              )}
            </div>

            {/* Initial Hydration / Loading Placeholder (identical between SSR and initial client render) */}
            {!isMounted || isLoading ? (
              <div
                data-testid="recently-viewed-skeleton"
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`rv-skeleton-${idx}`}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                  >
                    <Skeleton className="h-36 w-full rounded-xl" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-7 w-16 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div
                data-testid="recently-viewed-empty"
                className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-3"
              >
                <History className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="text-base font-bold text-slate-800">No recently viewed items</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  As you browse audio equipment and headphones, items you inspect will appear here for easy comparison.
                </p>
                <div className="pt-2">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
                  >
                    Browse Catalog <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div
                data-testid="recently-viewed-grid"
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                {items.map((prod) => {
                  const pId = getCanonicalProductId(prod);
                  const img = prod.images?.[0]?.url || prod.image;
                  const itemKey = `recently-viewed-${pId}`;

                  return (
                    <div
                      key={itemKey}
                      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
                    >
                      {/* Individual item remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(pId)}
                        aria-label={`Remove ${prod.name || "item"} from recently viewed`}
                        className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <div className="space-y-2">
                        <Link href={`/product/${prod.slug || pId}`}>
                          <div className="relative h-36 w-full rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                            {img ? (
                              <Image
                                src={img}
                                alt={prod.name || "Product image"}
                                fill
                                className="object-contain p-2 group-hover:scale-105 transition-transform"
                                sizes="200px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                                No image
                              </div>
                            )}
                          </div>
                        </Link>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                          {prod.brand?.name || "Verified"}
                        </span>
                        <Link
                          href={`/product/${prod.slug || pId}`}
                          className="font-bold text-xs text-slate-900 hover:text-[#004D38] line-clamp-2 transition-colors block"
                        >
                          {prod.name}
                        </Link>
                        <div className="flex items-center gap-1 text-[11px] text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="font-bold text-slate-800">
                            {(prod.averageRating || prod.rating || 5).toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="font-extrabold text-xs text-slate-900">
                          {formatCurrency(prod.price || prod.basePrice || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(prod)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#004D38] px-3 py-1 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors cursor-pointer"
                        >
                          <ShoppingCart className="h-3 w-3" /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecentlyViewedPageView;
