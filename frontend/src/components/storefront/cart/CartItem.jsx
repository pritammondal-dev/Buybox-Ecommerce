"use client";

import React from "react";
import Link from "next/link";
import { Trash2, ImageOff, Loader2 } from "lucide-react";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { QuantitySelector } from "../QuantitySelector.jsx";
import { cn } from "../../../utils/cn.js";

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  isUpdating = false,
  isRemoving = false,
}) {
  const variantId = item.productVariantId;
  const title = item.name || item.title || item.product?.name || "Product details unavailable";
  const image =
    item.image ||
    item.product?.images?.[0]?.url ||
    item.product?.image ||
    null;
  const sku = item.sku || item.product?.sku || null;
  const slug = item.slug || item.product?.slug || null;

  const unitPrice = parsePrice(item.unitPrice || item.price || 0);
  const lineTotal = unitPrice * item.quantity;
  const productHref = slug ? `/product/${slug}` : `/shop`;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:border-[#007A55]/30",
        (isUpdating || isRemoving) && "opacity-60 pointer-events-none"
      )}
    >
      {/* Product Thumbnail & Meta */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Link
          href={productHref}
          className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 group block"
          tabIndex={-1}
        >
          {image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={image}
              alt={title}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-slate-400 bg-slate-50 select-none">
              <ImageOff className="size-6 stroke-[1.5]" aria-hidden="true" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                No Image
              </span>
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <Link
            href={productHref}
            className="block text-sm font-bold text-slate-900 hover:text-[#007A55] transition-colors truncate"
          >
            {title}
          </Link>

          {sku && (
            <p className="text-[11px] font-mono text-slate-400">
              SKU: <span className="font-semibold text-slate-600">{sku}</span>
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Unit Price:{" "}
            <span className="font-bold text-slate-800">
              {formatCurrency(unitPrice)}
            </span>
          </p>
        </div>
      </div>

      {/* Quantity Selector, Line Total & Remove Action */}
      <div className="flex items-center justify-between w-full sm:w-auto sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div className="flex items-center gap-2">
          <QuantitySelector
            value={item.quantity}
            onChange={(qty) => onQuantityChange?.(variantId, qty)}
            min={1}
            max={99}
            size="sm"
            disabled={isUpdating || isRemoving}
            className="rounded-full"
          />
          {isUpdating && (
            <Loader2 className="size-3.5 animate-spin text-[#007A55]" />
          )}
        </div>

        <div className="text-right min-w-24">
          <span className="text-sm font-black text-[#007A55]">
            {formatCurrency(lineTotal)}
          </span>
        </div>

        <button
          type="button"
          disabled={isRemoving}
          onClick={() => onRemove?.(variantId, title)}
          aria-label={`Remove ${title} from cart`}
          className="size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isRemoving ? (
            <Loader2 className="size-4 animate-spin text-red-500" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default CartItem;
