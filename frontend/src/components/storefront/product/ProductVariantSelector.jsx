"use client";

import React, { useMemo, useCallback } from "react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "../../../utils/cn.js";

import { normalizeVariantAttributes } from "../../../utils/variantAttributes.js";

export { normalizeVariantAttributes };

// Well-known color palette map for accessible visual swatches
const COLOR_HEX_MAP = {
  black: "#0F172A",
  white: "#FFFFFF",
  red: "#DC2626",
  blue: "#2563EB",
  navy: "#1E3A8A",
  green: "#16A34A",
  emerald: "#004D38",
  yellow: "#EAB308",
  orange: "#EA580C",
  purple: "#9333EA",
  pink: "#EC4899",
  rose: "#F43F5E",
  gray: "#64748B",
  grey: "#64748B",
  silver: "#CBD5E1",
  gold: "#D97706",
  beige: "#F5F5DC",
  brown: "#78350F",
  teal: "#0D9488",
  cyan: "#06B6D4",
};

function getSwatchColor(val) {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (COLOR_HEX_MAP[str]) return COLOR_HEX_MAP[str];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(str)) return str;
  return null;
}

export function ProductVariantSelector({
  variants = [],
  selectedAttributes = {},
  onSelectAttribute,
  selectedVariant = null,
  isSelectionComplete = false,
  className,
}) {
  const activeVariants = useMemo(() => {
    return (variants || []).filter((v) => v.isActive && !v.deletedAt);
  }, [variants]);

  // Extract all attribute names and their unique options in preserved catalog order
  const attributeGroups = useMemo(() => {
    const groups = new Map(); // Map<name, Set<value>>
    for (const variant of activeVariants) {
      const attrs = normalizeVariantAttributes(variant.attributes);
      for (const [rawName, rawVal] of Object.entries(attrs)) {
        const name = String(rawName).trim();
        const val = String(rawVal).trim();
        if (!name || !val) continue;

        if (!groups.has(name)) {
          groups.set(name, new Set());
        }
        groups.get(name).add(val);
      }
    }

    return Array.from(groups.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet),
    }));
  }, [activeVariants]);

  // Check if an option is theoretically combinable with other selected attributes
  const isOptionCombinable = useCallback(
    (attrName, optionValue) => {
      const prospective = { ...selectedAttributes, [attrName]: optionValue };
      return activeVariants.some((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        return Object.entries(prospective).every(([k, v]) => {
          const actualVal = vAttrs[k];
          return actualVal && actualVal.toLowerCase() === v.toLowerCase();
        });
      });
    },
    [activeVariants, selectedAttributes]
  );

  // Check if an option leads to an in-stock variant
  const isOptionInStock = useCallback(
    (attrName, optionValue) => {
      const prospective = { ...selectedAttributes, [attrName]: optionValue };
      return activeVariants.some((v) => {
        const vAttrs = normalizeVariantAttributes(v.attributes);
        const matches = Object.entries(prospective).every(([k, v]) => {
          const actualVal = vAttrs[k];
          return actualVal && actualVal.toLowerCase() === v.toLowerCase();
        });
        const stockQty = Number(v.availableQuantity);
        const hasStock = !isNaN(stockQty) ? stockQty > 0 : v.inStock || v.stockStatus === "in_stock";
        return matches && hasStock;
      });
    },
    [activeVariants, selectedAttributes]
  );

  if (activeVariants.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
        <div className="flex items-center gap-2 font-bold">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>Currently Unavailable</span>
        </div>
        <p className="mt-1 text-[11px] text-amber-700">
          No purchasable variations are currently available for this product.
        </p>
      </div>
    );
  }

  if (attributeGroups.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4 pt-2", className)}>
      {attributeGroups.map((group) => {
        const isColorAttr =
          group.name.toLowerCase() === "color" || group.name.toLowerCase() === "colour";
        const selectedValue = selectedAttributes[group.name] || "";

        return (
          <div key={group.name} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 tracking-wide uppercase text-[11px]">
                {group.name}:
                {selectedValue ? (
                  <span className="ml-1.5 font-normal text-slate-600 normal-case">
                    {selectedValue}
                  </span>
                ) : (
                  <span className="ml-1.5 font-medium text-amber-700 normal-case">
                    (Select an option)
                  </span>
                )}
              </span>
            </div>

            {/* Option Pills / Swatches */}
            <div
              role="radiogroup"
              aria-label={`Select ${group.name}`}
              className="flex flex-wrap items-center gap-2"
            >
              {group.values.map((val) => {
                const isSelected = selectedValue.toLowerCase() === val.toLowerCase();
                const isCombinable = isOptionCombinable(group.name, val);
                const inStock = isCombinable && isOptionInStock(group.name, val);
                const swatchHex = isColorAttr ? getSwatchColor(val) : null;

                const isLightColor = swatchHex && ["#ffffff", "#f5f5dc", "#cbd5e1"].includes(swatchHex.toLowerCase());

                return (
                  <button
                    key={val}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelectAttribute(group.name, val)}
                    className={cn(
                      "group relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D38] active:scale-95",
                      isSelected
                        ? "border-[#004D38] bg-[#004D38] text-white shadow-xs ring-2 ring-[#004D38]/20"
                        : isCombinable
                        ? "border-slate-200 bg-white text-slate-800 hover:border-[#004D38] hover:bg-emerald-50/20"
                        : "border-dashed border-slate-300 bg-slate-50/70 text-slate-600 hover:border-[#004D38] hover:bg-emerald-50/20"
                    )}
                  >
                    {/* Visual Color Swatch indicator if color attribute */}
                    {swatchHex && (
                      <span
                        className={cn(
                          "size-3.5 rounded-full border shadow-2xs shrink-0 flex items-center justify-center",
                          isLightColor ? "border-slate-300" : "border-transparent"
                        )}
                        style={{ backgroundColor: swatchHex }}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <Check
                            className={cn(
                              "size-2.5",
                              isLightColor ? "text-slate-900 stroke-[3]" : "text-white stroke-[3]"
                            )}
                          />
                        )}
                      </span>
                    )}

                    <span>{val}</span>

                    {/* Out of stock strike tag for combinable but unstocked options */}
                    {isCombinable && !inStock && (
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded",
                          isSelected ? "bg-white/20 text-white" : "bg-red-50 text-red-600"
                        )}
                      >
                        Out of stock
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Incomplete Selection or Incompatible Combination Warning */}
      {!isSelectionComplete && (
        <p className="text-[11px] text-slate-500 font-medium pt-1">
          Please select options above to view availability and pricing.
        </p>
      )}

      {isSelectionComplete && !selectedVariant && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-red-500" />
          <span>This specific combination of options is currently unavailable. Please select another variant.</span>
        </div>
      )}
    </div>
  );
}

export default ProductVariantSelector;
