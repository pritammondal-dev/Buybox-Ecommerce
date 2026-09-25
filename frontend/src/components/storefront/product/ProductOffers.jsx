"use client";

import React, { useState } from "react";
import { Tag, CreditCard, Copy, Check, Sparkles, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { STOREFRONT_BUSINESS_POLICIES } from "../../../config/business-policies.config.js";

export function ProductOffers() {
  const [copiedCode, setCopiedCode] = useState(null);

  const bankOffers = STOREFRONT_BUSINESS_POLICIES.bankOffers || [];
  const coupons = STOREFRONT_BUSINESS_POLICIES.coupons || [];
  const emiPolicy = STOREFRONT_BUSINESS_POLICIES.payment?.emi;
  const shippingPolicy = STOREFRONT_BUSINESS_POLICIES.shipping;

  const handleCopyCode = async (code) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopiedCode(code);
      toast.success(`Coupon code ${code} copied!`, {
        description: "Apply this coupon code during checkout to claim your discount.",
      });
      setTimeout(() => {
        setCopiedCode(null);
      }, 2500);
    } catch {
      toast.error("Could not copy coupon code to clipboard.");
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
        <Sparkles className="size-4 text-[#004D38]" />
        <span>Available Offers & Promotions</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {/* Dynamic Bank Offer Cards */}
        {bankOffers.map((offer) => (
          <div
            key={offer.id}
            className="flex flex-col justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 transition-all hover:border-emerald-200 hover:bg-emerald-50/70"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-[#004D38]/10 p-1.5 text-[#004D38]">
                <CreditCard className="size-4" />
              </div>
              <div>
                <span className="inline-block rounded-md bg-[#004D38] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  {offer.badge}
                </span>
                <p className="mt-1 text-xs font-bold text-slate-900">
                  {offer.title}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  {offer.description}
                </p>
              </div>
            </div>
            {offer.termsText && (
              <span className="mt-2 text-[10px] font-semibold text-[#004D38]">
                {offer.termsText}
              </span>
            )}
          </div>
        ))}

        {/* Dynamic Special Coupon Cards */}
        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="flex flex-col justify-between rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 transition-all hover:border-amber-300 hover:bg-amber-50/70"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-lg bg-amber-500/10 p-1.5 text-amber-700">
                <Tag className="size-4" />
              </div>
              <div className="flex-1">
                <span className="inline-block rounded-md bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  {coupon.badge}
                </span>
                <p className="mt-1 text-xs font-bold text-slate-900">
                  {coupon.title}
                </p>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                  {coupon.description}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-amber-200/60 pt-2">
              <span className="font-mono text-xs font-extrabold tracking-wider text-amber-900">
                {coupon.code}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(coupon.code)}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs border border-amber-200 hover:bg-amber-100/50 active:scale-95 transition-all cursor-pointer"
              >
                {copiedCode === coupon.code ? (
                  <>
                    <Check className="size-3 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-slate-500" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Trust & Policy Micro-Pills */}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600">
        {emiPolicy?.isAvailable && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3.5 text-[#004D38]" />
            <span>{emiPolicy.description}</span>
          </span>
        )}
        {emiPolicy?.isAvailable && shippingPolicy?.freeShippingLabel && (
          <span className="text-slate-300">•</span>
        )}
        {shippingPolicy?.freeShippingLabel && (
          <span>{shippingPolicy.freeShippingLabel}</span>
        )}
      </div>
    </div>
  );
}

export default ProductOffers;
