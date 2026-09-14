"use client";

import React from "react";
import PropTypes from "prop-types";
import Image from "next/image";
import { Lock, ShieldCheck, ImageOff, Loader2 } from "lucide-react";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";

export function CheckoutOrderSummary({
  items = [],
  subtotal = 0,
  discountTotal = 0,
  shippingTotal = 0,
  taxTotal = 0,
  grandTotal = null,
  isSubmitting = false,
  selectedAddressId = null,
  onPlaceOrder,
}) {
  const numericSubtotal = parsePrice(subtotal);
  const numericDiscount = parsePrice(discountTotal);
  const numericShipping = parsePrice(shippingTotal);
  const numericTax = parsePrice(taxTotal);

  const finalAmount =
    grandTotal !== null && grandTotal !== undefined
      ? parsePrice(grandTotal)
      : Math.max(0, numericSubtotal - numericDiscount + numericShipping + numericTax);

  const totalQuantity = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 1),
    0
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6 lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-base font-black text-slate-950 uppercase tracking-wider">
          Order Summary
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {totalQuantity} {totalQuantity === 1 ? "Item" : "Items"}
        </span>
      </div>

      {/* Cart Items List */}
      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const itemKey = item.productVariantId || item.id || item._id || idx;
          const itemPrice = parsePrice(item.priceSnapshot || item.price || 0);
          const itemQty = Number(item.quantity) || 1;
          const lineTotal = itemPrice * itemQty;
          const displayName = item.name || item.title || "Product details unavailable";

          return (
            <div key={itemKey} className="flex items-center gap-3 text-xs">
              <div className="relative size-12 shrink-0 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={displayName}
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <ImageOff className="size-4 stroke-[1.5]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-bold text-slate-900 truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500">
                  Qty: <span className="font-semibold text-slate-700">{itemQty}</span> × {formatCurrency(itemPrice)}
                </p>
              </div>

              <span className="font-bold text-slate-900 shrink-0">
                {formatCurrency(lineTotal)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Financial Line Items */}
      <div className="space-y-2.5 border-t border-slate-100 pt-4 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Items Subtotal</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(numericSubtotal)}
          </span>
        </div>

        {numericDiscount > 0 && (
          <div className="flex justify-between text-emerald-700 font-medium">
            <span>Coupon Discount</span>
            <span>-{formatCurrency(numericDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-slate-600">
          <span>Shipping & Delivery</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(numericShipping)}
          </span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>Estimated Taxes (GST)</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(numericTax)}
          </span>
        </div>

        <div className="flex items-baseline justify-between border-t border-slate-200 pt-3 text-sm">
          <span className="font-black text-slate-950">Payable Amount</span>
          <span className="text-xl font-black text-[#007A55] tracking-tight">
            {formatCurrency(finalAmount)}
          </span>
        </div>
      </div>

      {/* Place Order CTA */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          onClick={onPlaceOrder}
          disabled={isSubmitting || !selectedAddressId || items.length === 0}
          className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-sm py-3.5 shadow-md active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Processing Order...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Lock className="size-4" />
              Place Order & Pay
            </span>
          )}
        </Button>

        {!selectedAddressId && items.length > 0 && (
          <p className="text-center text-[11px] font-semibold text-amber-600">
            * Please select or add a delivery address to proceed.
          </p>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
          <ShieldCheck className="size-4 text-[#007A55]" />
          <span>Safe 256-Bit SSL Encrypted Checkout</span>
        </div>
      </div>
    </div>
  );
}

CheckoutOrderSummary.propTypes = {
  items: PropTypes.array,
  subtotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  discountTotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  shippingTotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  taxTotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  grandTotal: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isSubmitting: PropTypes.bool,
  selectedAddressId: PropTypes.string,
  onPlaceOrder: PropTypes.func.isRequired,
};

export default CheckoutOrderSummary;
