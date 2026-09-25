"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  SlidersHorizontal,
  Trash2,
  ShoppingCart,
  Check,
  X,
  Star,
  ShieldCheck,
  ArrowRight,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useCompare } from "../../../hooks/useCompare.js";
import { useCartStore } from "../../../stores/cart.store.js";
import { Button } from "../../../components/ui/Button.jsx";

export function ComparePageView() {
  const { items, removeFromCompare, clearCompare } = useCompare();
  const addItem = useCartStore((s) => s.addItem);
  const [highlightDiffs, setHighlightDiffs] = useState(false);

  // Extract all distinct specification keys across all compared items
  const allSpecKeys = useMemo(() => {
    const keysSet = new Set();
    items.forEach((item) => {
      const specs = item.specifications;
      if (specs && typeof specs === "object") {
        const entries = specs instanceof Map ? Array.from(specs.keys()) : Object.keys(specs);
        entries.forEach((k) => keysSet.add(k));
      }
    });
    return Array.from(keysSet);
  }, [items]);

  const handleAddToCart = async (product) => {
    try {
      await addItem(product, 1);
      toast.success(`${product.name} added to cart!`);
    } catch {
      toast.error("Could not add product to cart.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-16 px-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
            <SlidersHorizontal className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900">Compare Products</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              You haven&apos;t added any products to compare yet. Browse our catalog and click compare on audio gear to see side-by-side technical specs.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004D38] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors w-full"
          >
            Explore Catalog <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              Product Comparison ({items.length}/4)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side technical specification analysis and pricing comparison
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={highlightDiffs}
                onChange={(e) => setHighlightDiffs(e.target.checked)}
                className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] h-4 w-4"
              />
              Highlight Differences
            </label>

            <button
              type="button"
              onClick={clearCompare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear All
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm scrollbar-thin">
          <table className="w-full border-collapse text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="p-4 font-bold text-slate-400 uppercase tracking-wider w-44 shrink-0">
                  Feature / Item
                </th>
                {items.map((prod) => (
                  <th key={prod._id || prod.id} className="p-4 w-64 align-top">
                    <div className="space-y-3">
                      <div className="relative h-32 w-full rounded-xl border border-slate-100 bg-white overflow-hidden">
                        {(prod.images?.[0]?.url || prod.image) && (
                          <Image
                            src={prod.images?.[0]?.url || prod.image}
                            alt={prod.name}
                            fill
                            className="object-contain p-2"
                            sizes="256px"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeFromCompare(prod._id || prod.id)}
                          className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-slate-400 hover:text-red-600 shadow-xs"
                          title="Remove from comparison"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {prod.brand?.name || "Verified Brand"}
                        </span>
                        <Link
                          href={`/product/${prod.slug || prod._id || prod.id}`}
                          className="font-bold text-slate-900 hover:text-[#004D38] line-clamp-2 transition-colors"
                        >
                          {prod.name}
                        </Link>
                      </div>

                      <div className="pt-1">
                        <Button
                          type="button"
                          onClick={() => handleAddToCart(prod)}
                          className="w-full rounded-xl bg-[#004D38] text-white hover:bg-[#003B2B] text-xs font-bold py-2 flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                        </Button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Price Row */}
              <tr className="bg-slate-50/30">
                <td className="p-4 font-bold text-slate-600">Price</td>
                {items.map((prod) => (
                  <td key={prod._id || prod.id} className="p-4 font-extrabold text-sm text-slate-900">
                    ₹{(prod.price || prod.basePrice || 0).toLocaleString("en-IN")}
                    {prod.compareAtPrice > prod.price && (
                      <span className="ml-2 text-xs text-slate-400 line-through font-normal">
                        ₹{prod.compareAtPrice.toLocaleString("en-IN")}
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Rating Row */}
              <tr>
                <td className="p-4 font-bold text-slate-600">Customer Rating</td>
                {items.map((prod) => (
                  <td key={prod._id || prod.id} className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-slate-800">
                        {(prod.averageRating || prod.rating || 0).toFixed(1)}
                      </span>
                      <span className="text-slate-400">
                        ({prod.totalReviews || prod.reviewCount || 0})
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Stock Status */}
              <tr className="bg-slate-50/30">
                <td className="p-4 font-bold text-slate-600">Availability</td>
                {items.map((prod) => {
                  const inStock = prod.stockStatus === "in_stock" || (prod.stockQuantity ?? 1) > 0;
                  return (
                    <td key={prod._id || prod.id} className="p-4">
                      {inStock ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> In Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                          <X className="h-3.5 w-3.5" /> Out of Stock
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Warranty */}
              <tr>
                <td className="p-4 font-bold text-slate-600">Warranty</td>
                {items.map((prod) => (
                  <td key={prod._id || prod.id} className="p-4 text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#004D38]" />
                      <span>{prod.warranty || "1 Year Brand Warranty"}</span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Technical Specifications */}
              {allSpecKeys.map((key) => {
                // Check if values differ across items
                const values = items.map((prod) => {
                  const specs = prod.specifications;
                  if (!specs) return "—";
                  if (specs instanceof Map) return specs.get(key) || "—";
                  return specs[key] || "—";
                });
                const isDiff = new Set(values).size > 1;

                return (
                  <tr
                    key={key}
                    className={`${highlightDiffs && isDiff ? "bg-amber-50/70" : ""}`}
                  >
                    <td className="p-4 font-bold text-slate-600 capitalize">{key}</td>
                    {values.map((val, idx) => (
                      <td key={idx} className="p-4 text-slate-800">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
