"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Tag, Copy, Check, Clock, AlertCircle, ShoppingBag, ArrowRight } from "lucide-react";

export function CouponsPageView({ coupons = [] }) {
  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] to-[#002B1F] p-8 sm:p-12 text-white shadow-xl">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
              <Tag className="h-4 w-4" /> Exclusive Store Vouchers
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              Coupons & Discounts
            </h1>
            <p className="text-base sm:text-lg text-emerald-100/90 leading-relaxed">
              Apply verified discount vouchers at checkout for instant savings on premium audio equipment, turntables, DACs, and studio gear.
            </p>
          </div>
        </div>

        {/* Coupons Grid */}
        {coupons.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Tag className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">No active vouchers right now</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Check back soon for seasonal promotional codes, flash sale discounts, and holiday vouchers.
            </p>
            <div className="mt-6">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003B2B] transition-colors"
              >
                <ShoppingBag className="h-4 w-4" /> Browse Catalog
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => {
              const isCopied = copiedCode === coupon.code;
              const isPercent = coupon.discountType === "percentage" || coupon.type === "percentage";
              const discountText = isPercent
                ? `${coupon.discountValue || coupon.value}% OFF`
                : `₹${coupon.discountValue || coupon.value} OFF`;

              return (
                <div
                  key={coupon._id || coupon.code}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="space-y-4">
                    {/* Top row: Badge & Expiry */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#FFF8D6] text-[#004D38] border border-amber-200">
                        {discountText}
                      </span>
                      {coupon.validUntil && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Expires {new Date(coupon.validUntil).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#004D38] transition-colors">
                        {coupon.title || coupon.code}
                      </h3>
                      {coupon.description && (
                        <p className="mt-1 text-xs sm:text-sm text-slate-600 line-clamp-2">
                          {coupon.description}
                        </p>
                      )}
                    </div>

                    {/* Conditions */}
                    <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-dashed border-slate-200">
                      {coupon.minOrderAmount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Min. Order: ₹{coupon.minOrderAmount.toLocaleString("en-IN")}
                        </div>
                      )}
                      {coupon.maxDiscount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Max. Discount: ₹{coupon.maxDiscount.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Copy Coupon Code Box */}
                  <div className="mt-6 pt-4 flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="font-mono text-sm font-extrabold tracking-wider text-slate-800 uppercase">
                      {coupon.code}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(coupon.code)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                        isCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-[#004D38] text-white hover:bg-[#003B2B]"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* How to use vouchers guide */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[#004D38]" /> How to Redeem Your Voucher
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-slate-600">
            <div className="space-y-1.5">
              <span className="inline-block w-6 h-6 text-center font-bold text-xs leading-6 rounded-full bg-[#004D38] text-white">1</span>
              <p className="font-semibold text-slate-800">Copy the Code</p>
              <p className="text-xs text-slate-500">Click the copy button on any coupon card above to copy it to your clipboard.</p>
            </div>
            <div className="space-y-1.5">
              <span className="inline-block w-6 h-6 text-center font-bold text-xs leading-6 rounded-full bg-[#004D38] text-white">2</span>
              <p className="font-semibold text-slate-800">Add Items to Cart</p>
              <p className="text-xs text-slate-500">Ensure your cart meets the minimum order amount for the voucher code selected.</p>
            </div>
            <div className="space-y-1.5">
              <span className="inline-block w-6 h-6 text-center font-bold text-xs leading-6 rounded-full bg-[#004D38] text-white">3</span>
              <p className="font-semibold text-slate-800">Apply at Checkout</p>
              <p className="text-xs text-slate-500">Paste your voucher into the Coupon field during checkout to enjoy immediate deductions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
