"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Tag, Copy, Check, Clock, ShoppingBag } from "lucide-react";
import { campaignService } from "../../../../services/campaign.service.js";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export function MyCouponsPageView() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await campaignService.getActiveCoupons();
        if (!isMounted) return;
        setCoupons(res?.data || []);
      } catch {
        if (!isMounted) setCoupons([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4">
            <AccountNav />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">My Coupons & Vouchers</h1>
              <p className="text-xs text-slate-500">
                Browse available promotional vouchers eligible for use on your account during checkout.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : coupons.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm space-y-3">
                <Tag className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="text-base font-bold text-slate-800">No active coupons available</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Check back for seasonal promotional discount vouchers and festival sales.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coupons.map((coupon) => {
                  const isCopied = copiedCode === coupon.code;
                  const isPercent =
                    coupon.discountType === "percentage" || coupon.type === "percentage";
                  const discountText = isPercent
                    ? `${coupon.discountValue || coupon.value}% OFF`
                    : `₹${coupon.discountValue || coupon.value} OFF`;

                  return (
                    <div
                      key={coupon._id || coupon.code}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-[#FFF8D6] px-3 py-0.5 text-xs font-bold text-[#004D38] border border-amber-200">
                            {discountText}
                          </span>
                          {coupon.validUntil && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(coupon.validUntil).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-sm text-slate-900">{coupon.title || coupon.code}</h3>
                        {coupon.description && (
                          <p className="text-xs text-slate-500 line-clamp-2">{coupon.description}</p>
                        )}

                        {coupon.minOrderAmount > 0 && (
                          <p className="text-[11px] text-slate-400">
                            Min. purchase: ₹{coupon.minOrderAmount.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                        <span className="font-mono text-xs font-bold text-slate-800 uppercase">
                          {coupon.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(coupon.code)}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-[#004D38] text-white hover:bg-[#003B2B]"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
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
