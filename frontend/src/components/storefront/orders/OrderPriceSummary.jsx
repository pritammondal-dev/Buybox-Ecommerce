"use client";

import React from "react";
import PropTypes from "prop-types";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { Tag, ShieldCheck, Receipt } from "lucide-react";

export function OrderPriceSummary({ order }) {
  if (!order) return null;

  const subtotal = parsePrice(order.subtotal);
  const discountTotal = parsePrice(order.discountTotal);
  const shippingTotal = parsePrice(order.shippingTotal);
  const taxTotal = parsePrice(order.taxTotal);
  const grandTotal = parsePrice(order.grandTotal);
  const couponCode = order.couponCode;
  const currency = order.currency || "INR";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Receipt className="size-4 text-slate-400" />
          Price Summary
        </h3>
        <span className="text-[11px] font-semibold text-slate-400">
          Historical Stored Snapshot
        </span>
      </div>

      <div className="space-y-2.5 text-xs sm:text-sm">
        {/* Items Subtotal */}
        <div className="flex justify-between text-slate-600">
          <span>Items Subtotal</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(subtotal, currency)}
          </span>
        </div>

        {/* Applied Coupon / Promotion Discount */}
        {discountTotal > 0 && (
          <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/60 rounded-lg px-2.5 py-1.5 -mx-1">
            <span className="flex items-center gap-1.5 font-bold">
              <Tag className="size-3.5" />
              Promotion Discount {couponCode ? `(${couponCode})` : ""}
            </span>
            <span className="font-black">
              -{formatCurrency(discountTotal, currency)}
            </span>
          </div>
        )}

        {/* Shipping & Delivery */}
        <div className="flex justify-between text-slate-600">
          <span>Shipping & Handling</span>
          <span className="font-semibold text-slate-900">
            {shippingTotal === 0 ? (
              <span className="font-bold text-[#004D38]">FREE</span>
            ) : (
              formatCurrency(shippingTotal, currency)
            )}
          </span>
        </div>

        {/* Taxes */}
        <div className="flex justify-between text-slate-600">
          <span className="flex items-center gap-1">
            Estimated Tax (GST)
            {order.taxSnapshot?.pricingMode === "inclusive" && (
              <span className="text-[10px] text-slate-400 font-normal">
                (Inclusive)
              </span>
            )}
          </span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(taxTotal, currency)}
          </span>
        </div>

        {/* Grand Total */}
        <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
          <div>
            <span className="text-sm font-black text-slate-950">Grand Total</span>
            <p className="text-[11px] text-slate-400">Inclusive of applicable taxes</p>
          </div>
          <span className="text-xl font-black text-[#004D38] tracking-tight">
            {formatCurrency(grandTotal, currency)}
          </span>
        </div>
      </div>

      <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5">
        <ShieldCheck className="size-4 text-[#004D38] shrink-0" />
        <span>Price guarantee: These values are locked from your original order confirmation.</span>
      </div>
    </div>
  );
}

OrderPriceSummary.propTypes = {
  order: PropTypes.object,
};

export default OrderPriceSummary;
