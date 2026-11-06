"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, ArrowRight, Check, ShoppingBag, X, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "../../ui/Button.jsx";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";

/**
 * PriceChangeConfirmationModal
 * 
 * Accessible, robust confirmation dialog rendered when order creation returns 409 PRICE_CHANGED
 * or when an expired quote reveals a material price change upon refresh.
 * 
 * Displays clear side-by-side comparison of previous quoted totals vs current server-calculated
 * prices, including line items, discounts, shipping, and taxes.
 */
export function PriceChangeConfirmationModal({
  isOpen,
  previousQuote,
  currentQuote,
  isRefreshing = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Keyboard accessibility: Escape to cancel, trap focus initial entry
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus confirmation button when modal opens
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const currency = currentQuote?.currency || previousQuote?.currency || "INR";

  const prevGrandTotal = parsePrice(previousQuote?.grandTotal || previousQuote?.quotedGrandTotal || 0);
  const currGrandTotal = parsePrice(currentQuote?.grandTotal || currentQuote?.currentGrandTotal || 0);
  const priceDiff = currGrandTotal - prevGrandTotal;

  const prevSubtotal = previousQuote?.subtotal ? parsePrice(previousQuote.subtotal) : null;
  const currSubtotal = currentQuote?.subtotal ? parsePrice(currentQuote.subtotal) : null;

  const prevShipping = previousQuote?.shippingTotal !== undefined ? parsePrice(previousQuote.shippingTotal) : null;
  const currShipping = currentQuote?.shippingTotal !== undefined ? parsePrice(currentQuote.shippingTotal) : null;

  const prevTax = previousQuote?.taxTotal !== undefined ? parsePrice(previousQuote.taxTotal) : null;
  const currTax = currentQuote?.taxTotal !== undefined ? parsePrice(currentQuote.taxTotal) : null;

  const prevDiscount = previousQuote?.discountTotal !== undefined ? parsePrice(previousQuote.discountTotal) : null;
  const currDiscount = currentQuote?.discountTotal !== undefined ? parsePrice(currentQuote.discountTotal) : null;

  // Build item comparison map
  const previousItems = previousQuote?.items || [];
  const currentItems = currentQuote?.items || [];

  const itemMap = new Map();
  previousItems.forEach((it) => {
    const key = String(it.productVariantId || it.pvid || it.productId || it.id);
    itemMap.set(key, {
      name: it.productName || it.name || "Product Item",
      variant: it.variantName || "",
      oldPrice: parsePrice(it.unitPrice),
      oldLineTotal: parsePrice(it.lineTotal),
      oldQty: it.quantity || it.qty || 1,
      newPrice: null,
      newLineTotal: null,
      newQty: null,
    });
  });

  currentItems.forEach((it) => {
    const key = String(it.productVariantId || it.pvid || it.productId || it.id);
    const existing = itemMap.get(key);
    if (existing) {
      existing.newPrice = parsePrice(it.unitPrice);
      existing.newLineTotal = parsePrice(it.lineTotal);
      existing.newQty = it.quantity || it.qty || 1;
      if (it.productName) existing.name = it.productName;
      if (it.variantName) existing.variant = it.variantName;
    } else {
      itemMap.set(key, {
        name: it.productName || it.name || "Product Item",
        variant: it.variantName || "",
        oldPrice: null,
        oldLineTotal: null,
        oldQty: null,
        newPrice: parsePrice(it.unitPrice),
        newLineTotal: parsePrice(it.lineTotal),
        newQty: it.quantity || it.qty || 1,
      });
    }
  });

  const comparisonItems = Array.from(itemMap.values());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-change-modal-title"
      ref={modalRef}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="price-change-modal-title"
                className="text-lg font-bold text-slate-900"
              >
                Checkout Price Update Notice
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Pricing components have changed since your checkout quote. Please review and confirm.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog and return"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Total Price Comparison Callout */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 border border-slate-200 p-4 items-center">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Previously Quoted
              </span>
              <p className="text-xl font-bold text-slate-500 line-through">
                {formatCurrency(prevGrandTotal, currency)}
              </p>
            </div>

            <div className="space-y-1 text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Updated Total
              </span>
              <div className="flex items-center justify-end gap-2">
                <p className="text-2xl font-black text-slate-900">
                  {formatCurrency(currGrandTotal, currency)}
                </p>
                {priceDiff !== 0 && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      priceDiff > 0
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {priceDiff > 0 ? `+${formatCurrency(priceDiff, currency)}` : `-${formatCurrency(Math.abs(priceDiff), currency)}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Comparison */}
          {comparisonItems.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Item Price Details
              </h3>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
                {comparisonItems.map((item, idx) => {
                  const hasPriceChange = item.oldPrice !== null && item.newPrice !== null && item.oldPrice !== item.newPrice;
                  const hasQtyChange = item.oldQty !== null && item.newQty !== null && item.oldQty !== item.newQty;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 flex items-center justify-between text-sm ${
                        hasPriceChange || hasQtyChange ? "bg-amber-50/50" : ""
                      }`}
                    >
                      <div className="min-w-0 pr-4">
                        <p className="font-semibold text-slate-800 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {item.variant && <span>{item.variant}</span>}
                          <span>Qty: {item.newQty || item.oldQty}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {hasPriceChange ? (
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-400 line-through block">
                              {formatCurrency(item.oldPrice, currency)}
                            </span>
                            <span className="font-bold text-slate-900 block">
                              {formatCurrency(item.newPrice, currency)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-700">
                            {formatCurrency(item.newPrice || item.oldPrice, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pricing Components Breakdown Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Summary Breakdown
            </h3>

            {prevSubtotal !== null && currSubtotal !== null && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-600">Items Subtotal</span>
                <div className="flex items-center gap-2">
                  {prevSubtotal !== currSubtotal && (
                    <span className="text-slate-400 line-through text-xs">
                      {formatCurrency(prevSubtotal, currency)}
                    </span>
                  )}
                  <span className="font-medium text-slate-800">
                    {formatCurrency(currSubtotal, currency)}
                  </span>
                </div>
              </div>
            )}

            {currDiscount > 0 && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-emerald-700">Discounts & Coupons</span>
                <span className="font-medium text-emerald-700">
                  -{formatCurrency(currDiscount, currency)}
                </span>
              </div>
            )}

            {currShipping !== null && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-600">Shipping & Delivery</span>
                <div className="flex items-center gap-2">
                  {prevShipping !== null && prevShipping !== currShipping && (
                    <span className="text-slate-400 line-through text-xs">
                      {prevShipping === 0 ? "FREE" : formatCurrency(prevShipping, currency)}
                    </span>
                  )}
                  <span className="font-medium text-slate-800">
                    {currShipping === 0 ? "FREE" : formatCurrency(currShipping, currency)}
                  </span>
                </div>
              </div>
            )}

            {currTax !== null && (
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-600">Taxes</span>
                <div className="flex items-center gap-2">
                  {prevTax !== null && prevTax !== currTax && (
                    <span className="text-slate-400 line-through text-xs">
                      {formatCurrency(prevTax, currency)}
                    </span>
                  )}
                  <span className="font-medium text-slate-800">
                    {formatCurrency(currTax, currency)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Error Notice if Refresh Failed */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Pricing refresh encountered an error</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isRefreshing}
            className="w-full sm:w-auto text-slate-700 hover:bg-slate-200"
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            Return to Cart
          </Button>

          <Button
            type="button"
            ref={confirmButtonRef}
            onClick={onConfirm}
            disabled={isRefreshing}
            className="w-full sm:w-auto bg-[#004D38] hover:bg-[#003829] text-white font-semibold shadow-md shadow-emerald-950/10"
          >
            {isRefreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating Quote...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Review & Confirm Updated Price
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PriceChangeConfirmationModal;
