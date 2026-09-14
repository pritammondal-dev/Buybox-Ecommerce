"use client";

import React from "react";
import Link from "next/link";
import { Star, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatCurrency, calculateDiscountPercentage, parsePrice } from "../../../utils/formatCurrency.js";

export function ProductInfo({
  product,
  brand,
  category,
  onReviewsClick,
}) {
  const price = parsePrice(product?.price || 0);
  const compareAtPrice = parsePrice(product?.compareAtPrice);
  const discount = calculateDiscountPercentage(compareAtPrice, price);

  const brandName = brand?.name || product?.brand?.name || null;
  const brandId = brand?._id || product?.brandId;

  const ratingAvg = Number(product?.ratingAverage) || 0;
  const ratingCount = Number(product?.ratingCount) || 0;

  // Actual backend stockStatus enum
  const stockStatus = product?.stockStatus || "out_of_stock";
  const isOutOfStock = stockStatus === "out_of_stock";
  const isPreorder = stockStatus === "preorder";

  return (
    <div className="space-y-4">
      {/* Overline: Brand & SKU */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-slate-100 pb-3">
        {brandName ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Brand:
            </span>
            {brandId ? (
              <Link
                href={`/shop?brandId=${brandId}`}
                className="font-bold uppercase tracking-wider text-[#007A55] hover:underline"
              >
                {brandName}
              </Link>
            ) : (
              <span className="font-bold uppercase tracking-wider text-slate-700">
                {brandName}
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {product?.sku && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <span>SKU:</span>
            <span className="text-slate-600 font-bold">{product.sku}</span>
          </div>
        )}
      </div>

      {/* Product Title */}
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-950 leading-[1.2]">
        {product?.name}
      </h1>

      {/* Real Rating & Reviews Jump Link */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1 text-amber-400">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={`star-info-${i}`}
              className={`size-4 ${
                i < Math.floor(ratingAvg)
                  ? "fill-current"
                  : "stroke-current text-slate-200"
              }`}
            />
          ))}
        </div>

        {ratingAvg > 0 ? (
          <span className="font-bold text-slate-900">
            {ratingAvg.toFixed(1)}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onReviewsClick}
          className="text-xs text-muted-foreground hover:text-[#007A55] hover:underline transition-colors cursor-pointer"
        >
          {ratingCount > 0
            ? `(${ratingCount} verified customer ${ratingCount === 1 ? "review" : "reviews"})`
            : "No customer reviews yet"}
        </button>
      </div>

      {/* Price Box */}
      <div className="rounded-2xl bg-slate-50 p-4 sm:p-5 border border-slate-200/80 flex flex-wrap items-baseline gap-3 sm:gap-4">
        <span className="text-3xl sm:text-4xl font-black text-[#007A55]">
          {formatCurrency(price)}
        </span>

        {compareAtPrice > price && (
          <span className="text-base sm:text-lg text-slate-400 line-through font-normal">
            {formatCurrency(compareAtPrice)}
          </span>
        )}

        {discount > 0 && (
          <span className="rounded-full bg-red-100 text-[#E02424] font-extrabold text-xs px-3 py-1">
            Save {discount}% OFF
          </span>
        )}

        {product?.isTaxable && (
          <span className="text-[11px] font-medium text-slate-500 w-full">
            Inclusive of all taxes ({product.taxCategory || "Standard GST"})
          </span>
        )}
      </div>

      {/* Real Stock Status (Zero Manufactured Progress Bars) */}
      <div className="flex items-center gap-2 pt-1">
        {isOutOfStock ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 border border-red-200/60">
            <XCircle className="size-3.5" />
            <span>Out of Stock</span>
          </div>
        ) : isPreorder ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200/60">
            <Clock className="size-3.5" />
            <span>Available for Preorder</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#007A55] border border-emerald-200/60">
            <CheckCircle2 className="size-3.5" />
            <span>In Stock</span>
          </div>
        )}
      </div>

      {/* Short Description strictly from backend */}
      {product?.shortDescription && (
        <p className="text-sm text-slate-600 leading-relaxed pt-1">
          {product.shortDescription}
        </p>
      )}

      {/* Real Product Tags */}
      {Array.isArray(product?.tags) && product.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {product.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductInfo;
