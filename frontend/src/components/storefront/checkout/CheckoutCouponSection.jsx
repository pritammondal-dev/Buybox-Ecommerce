"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import { Tag, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/Button.jsx";

export function CheckoutCouponSection({
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  isLoading = false,
}) {
  const [inputCode, setInputCode] = useState("");

  const handleApply = async (e) => {
    e.preventDefault();
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="size-4 text-[#007A55]" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
          Have a Promotional Coupon?
        </h3>
      </div>

      {appliedCoupon ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-full bg-[#007A55] text-white">
              <Check className="size-3.5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-mono text-xs font-black text-[#007A55] tracking-wide">
                {appliedCoupon.code}
              </span>
              <p className="text-[11px] text-slate-600">
                Coupon applied for checkout order creation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveCoupon}
            disabled={isLoading}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors"
          >
            <X className="size-3.5" />
            Remove
          </button>
        </div>
      ) : (
        <form onSubmit={handleApply} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              disabled={isLoading}
              maxLength={50}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-[#007A55] focus:outline-none focus:ring-1 focus:ring-[#007A55] disabled:bg-slate-50"
            />
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !inputCode.trim()}
            className="rounded-xl bg-[#007A55] hover:bg-[#006346] text-white text-xs font-bold px-4"
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
};

export default CheckoutCouponSection;
