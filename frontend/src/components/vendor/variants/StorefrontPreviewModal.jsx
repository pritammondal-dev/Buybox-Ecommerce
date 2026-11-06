"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  X,
  Eye,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  getAttributeEntries,
  getCombinationFingerprint,
  formatAttributesString,
} from "@/utils/attribute.util";

export default function StorefrontPreviewModal({
  isOpen,
  onClose,
  product = {},
  variants = [],
}) {
  // Extract all available attribute names and their distinct values from active variants
  const activeVariants = useMemo(
    () => variants.filter((v) => v.isActive !== false),
    [variants]
  );

  const attributeMap = useMemo(() => {
    const map = {};
    for (const v of activeVariants) {
      const entries = getAttributeEntries(v.attributes);
      for (const { name, value } of entries) {
        if (!map[name]) map[name] = new Set();
        map[name].add(value);
      }
    }
    return Object.fromEntries(
      Object.entries(map).map(([k, set]) => [k, Array.from(set)])
    );
  }, [activeVariants]);

  // Initial selection: first variant's attributes
  const [selectedAttrs, setSelectedAttrs] = useState(() => {
    if (activeVariants.length > 0) {
      const firstEntries = getAttributeEntries(activeVariants[0].attributes);
      return Object.fromEntries(firstEntries.map((e) => [e.name, e.value]));
    }
    return {};
  });

  // Find matching variant
  const selectedVariant = useMemo(() => {
    if (activeVariants.length === 0) return null;
    const targetFingerprint = getCombinationFingerprint(selectedAttrs);
    return (
      activeVariants.find(
        (v) => getCombinationFingerprint(v.attributes) === targetFingerprint
      ) || null
    );
  }, [activeVariants, selectedAttrs]);

  if (!isOpen) return null;

  const handleSelectOption = (attrName, val) => {
    setSelectedAttrs((prev) => ({
      ...prev,
      [attrName]: val,
    }));
  };

  const currentPrice = selectedVariant
    ? Number(selectedVariant.price || 0)
    : Number(product.price || 0);

  const comparePrice = selectedVariant?.compareAtPrice
    ? Number(selectedVariant.compareAtPrice)
    : product.compareAtPrice
    ? Number(product.compareAtPrice)
    : null;

  const availableStock = selectedVariant
    ? selectedVariant.availableQuantity ??
      Math.max(0, (selectedVariant.onHand ?? selectedVariant.stockQuantity ?? 0) - (selectedVariant.reserved ?? 0))
    : 0;

  const isInStock = availableStock > 0;
  const isLowStock = availableStock > 0 && availableStock <= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between shrink-0 bg-slate-50">
          <div className="flex items-center gap-2">
            <Eye className="size-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Storefront Customer Simulation Preview
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Product Image Preview */}
            <div className="aspect-square rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden relative">
              {selectedVariant?.image?.url || product.images?.[0]?.url ? (
                <Image
                  src={selectedVariant?.image?.url || product.images?.[0]?.url}
                  alt={product.name || "Product"}
                  width={300}
                  height={300}
                  className="size-full object-cover"
                  unoptimized
                />
              ) : (
                <Package className="size-16 text-slate-300" />
              )}
              {selectedVariant?.sku && (
                <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {selectedVariant.sku}
                </span>
              )}
            </div>

            {/* Product Options & Details */}
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Storefront View
                </span>
                <h4 className="text-lg font-black text-slate-900 leading-tight">
                  {product.name || product.title}
                </h4>
                {selectedVariant && (
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {formatAttributesString(selectedVariant.attributes)}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  ₹{currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                {comparePrice && comparePrice > currentPrice && (
                  <span className="text-xs font-semibold text-slate-400 line-through">
                    ₹{comparePrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Stock Status Badge */}
              <div>
                {selectedVariant ? (
                  isInStock ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isLowStock
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>
                        {isLowStock
                          ? `Only ${availableStock} left in stock - order soon`
                          : `In Stock (${availableStock} units available)`}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <AlertCircle className="size-3.5" />
                      <span>Currently Out of Stock</span>
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    <AlertCircle className="size-3.5" />
                    <span>Variant combination unavailable</span>
                  </span>
                )}
              </div>

              {/* Variation Options Selectors */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                {Object.entries(attributeMap).map(([attrName, values]) => (
                  <div key={attrName} className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">
                      {attrName}: <span className="font-normal text-slate-500">{selectedAttrs[attrName] || "Select"}</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {values.map((val) => {
                        const isSelected = selectedAttrs[attrName] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleSelectOption(attrName, val)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              isSelected
                                ? "bg-[#004D38] text-white shadow-2xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Simulated Buy Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!selectedVariant || !isInStock}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs disabled:opacity-40 transition-colors"
                >
                  <ShoppingCart className="size-4" />
                  <span>
                    {!selectedVariant
                      ? "Unavailable Option"
                      : !isInStock
                      ? "Out of Stock"
                      : "Add to Cart (Simulated)"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 shrink-0">
          This preview reflects real-time customer variant selection and authoritative warehouse inventory levels.
        </div>
      </div>
    </div>
  );
}
