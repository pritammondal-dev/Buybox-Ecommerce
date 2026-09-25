"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Tag, Check, X, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { STOREFRONT_BUSINESS_POLICIES } from "../../../config/business-policies.config.js";
import { formatCurrency } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";

export function CheckoutCouponSection({
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  isLoading = false,
  onContinue,
}) {
  const [inputCode, setInputCode] = useState("");
  const availableCoupons = STOREFRONT_BUSINESS_POLICIES.coupons || [];

  const handleApply = async (e) => {
    if (e) e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) {
      toast.error("Please enter a coupon code.");
      return;
    }
    if (clean.length < 3 || clean.length > 50) {
      toast.error("Coupon codes must be between 3 and 50 characters.");
      return;
    }

    const success = await onApplyCoupon(clean);
    if (success) {
      setInputCode("");
    }
  };

  const handleApplySuggested = async (code) => {
    setInputCode(code);
    await onApplyCoupon(code);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#004D38] text-white text-xs font-black">
            3
          </span>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">
            Offers & Coupons
          </h2>
        </div>

        <span className="text-[11px] font-semibold text-slate-500">
          Step 3 of 5
        </span>
      </div>

      {appliedCoupon ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/50 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-full bg-[#004D38] text-white">
              <Check className="size-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-[#004D38] tracking-wider">
                  {appliedCoupon.code}
                </span>
                {appliedCoupon.discountAmount > 0 && (
                  <span className="inline-block rounded-md bg-[#004D38]/10 px-2 py-0.5 text-[10px] font-black text-[#004D38]">
                    Saved {formatCurrency(appliedCoupon.discountAmount)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Authoritatively verified and applied for order creation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveCoupon}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <form onSubmit={handleApply} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                disabled={isLoading}
                maxLength={50}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-[#004D38] focus:outline-none focus:ring-1 focus:ring-[#004D38] disabled:bg-slate-50"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !inputCode.trim()}
              className="rounded-xl bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-5 active:scale-95 transition-all"
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  Applying...
                </span>
              ) : (
                "Apply"
              )}
            </Button>
          </form>

          {/* Platform Suggested Coupons */}
          {availableCoupons.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <Sparkles className="size-3 text-[#004D38]" />
                <span>Available Promotional Coupons</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {availableCoupons.map((coupon) => (
                  <div
                    key={coupon.id || coupon.code}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs transition-colors hover:border-[#004D38]/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 tracking-wider">
                          {coupon.code}
                        </span>
                        {coupon.badge && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#004D38]">
                            {coupon.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {coupon.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplySuggested(coupon.code)}
                      disabled={isLoading}
                      className="text-xs font-bold text-[#004D38] hover:text-[#003D2C] transition-colors cursor-pointer shrink-0 ml-3"
                    >
                      Apply Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue CTA */}
      {onContinue && (
        <div className="pt-2 flex justify-end border-t border-slate-100">
          <Button
            type="button"
            onClick={onContinue}
            className="rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-6 py-2.5 shadow-sm active:scale-95 transition-all"
          >
            Continue to Payment
          </Button>
        </div>
      )}
    </div>
  );
}

CheckoutCouponSection.propTypes = {
  appliedCoupon: PropTypes.shape({
    code: PropTypes.string,
    discountAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  onApplyCoupon: PropTypes.func.isRequired,
  onRemoveCoupon: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  onContinue: PropTypes.func,
};

export default CheckoutCouponSection;
