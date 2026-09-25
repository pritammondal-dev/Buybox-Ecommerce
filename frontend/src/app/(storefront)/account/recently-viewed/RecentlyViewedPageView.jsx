"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { History, Trash2, ShoppingCart, Star, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { useCartStore } from "../../../../stores/cart.store.js";
import { formatCurrency } from "../../../../utils/formatCurrency.js";

export function RecentlyViewedPageView() {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("buybox_recently_viewed");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });
  const addItem = useCartStore((s) => s.addItem);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem("buybox_recently_viewed");
      setItems([]);
      toast.success("Browsing history cleared.");
    } catch {
      // ignore
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

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors shadow-2xs"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear History
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {items.map((prod) => {
                  const pId = prod._id || prod.id;
                  const img = prod.images?.[0]?.url || prod.image;

                  return (
                    <div
                      key={pId}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                    >
                      <div className="space-y-2">
                        <Link href={`/product/${prod.slug || pId}`}>
                          <div className="relative h-36 w-full rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                            {img && (
                              <Image
                                src={img}
                                alt={prod.name}
                                fill
                                className="object-contain p-2 hover:scale-105 transition-transform"
                                sizes="200px"
                              />
                            )}
                          </div>
                        </Link>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
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
                          className="inline-flex items-center gap-1 rounded-lg bg-[#004D38] px-3 py-1 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
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
