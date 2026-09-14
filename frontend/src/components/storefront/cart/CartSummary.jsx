"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { Button } from "../../ui/Button.jsx";

export function CartSummary({
  subtotal = 0,
  discountTotal = 0,
  taxTotal = 0,
  shippingTotal = 0,
  grandTotal = null,
  itemCount = 0,
  isDisabled = false,
}) {
  const router = useRouter();

  const parsedSubtotal = parsePrice(subtotal);
  const parsedDiscount = parsePrice(discountTotal);
  const parsedTax = parsePrice(taxTotal);
  const parsedShipping = parsePrice(shippingTotal);
  const parsedGrandTotal =
    grandTotal !== null && grandTotal !== undefined
      ? parsePrice(grandTotal)
      : Math.max(0, parsedSubtotal - parsedDiscount + parsedShipping + parsedTax);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider">
          Order Summary
        </h2>
        <span className="text-xs text-muted-foreground font-medium">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Authoritative Totals Breakdown */}
      <div className="space-y-3 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Items Subtotal</span>
          <span className="font-bold text-slate-900">
            {formatCurrency(parsedSubtotal)}
          </span>
        </div>

        {parsedDiscount > 0 && (
          <div className="flex justify-between text-[#007A55]">
            <span>Applied Discount</span>
            <span className="font-bold">-{formatCurrency(parsedDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-slate-600">
          <span>Shipping & Delivery</span>
          <span className="font-medium text-slate-700">
            {parsedShipping > 0
              ? formatCurrency(parsedShipping)
              : "Calculated at checkout"}
          </span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>Estimated Taxes (GST)</span>
          <span className="font-bold text-slate-900">
            {formatCurrency(parsedTax)}
          </span>
        </div>

        <div className="flex justify-between text-sm font-black text-slate-950 pt-3 border-t border-slate-200">
          <span>Payable Amount</span>
          <span className="text-base text-[#007A55]">
            {formatCurrency(parsedGrandTotal)}
          </span>
        </div>
      </div>

      {/* Primary CTA */}
      <Button
        type="button"
        disabled={isDisabled || itemCount === 0}
        onClick={() => router.push("/checkout")}
        className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-sm py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShoppingBag className="size-4" />
        <span>Proceed to Checkout</span>
        <ArrowRight className="size-4" />
      </Button>

      {/* Security & Guarantee Note */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-slate-200/60">
        <ShieldCheck className="size-4 text-[#007A55] shrink-0" />
        <span>Safe 256-Bit SSL Encrypted Checkout</span>
      </div>
    </div>
  );
}

export default CartSummary;
