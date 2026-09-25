"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  PackageCheck,
  Home,
  MapPin,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  Clock,
} from "lucide-react";
import { orderService } from "../../../services/order.service.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { Skeleton } from "../../ui/Skeleton.jsx";

export function CheckoutSuccessView() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(orderId));

  useEffect(() => {
    if (!orderId) return;

    orderService
      .getOrderById(orderId)
      .then((res) => {
        const ord = res?.data?.order || res?.data;
        setOrder(ord);
      })
      .catch(() => {
        setOrder(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-4">
        <Skeleton className="size-16 rounded-full mx-auto" />
        <Skeleton className="h-6 w-56 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
        <Skeleton className="h-48 w-full rounded-2xl mt-8" />
      </div>
    );
  }

  const isPaid = order?.paymentStatus === "paid";
  const orderDisplayNumber = order?.orderNumber || order?._id || orderId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      {/* Success Icon */}
      <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 text-[#004D38] mb-6 shadow-xs">
        <CheckCircle2 className="size-12 stroke-[2]" />
      </div>

      <span className="text-xs font-black uppercase tracking-widest text-[#004D38]">
        {isPaid ? "Payment Verified & Order Placed" : "Order Placed Successfully"}
      </span>

      <h1 className="mt-1 text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
        Thank You for Your Order!
      </h1>

      <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        Your order confirmation and invoice details have been recorded. You can track your order status and shipment directly in your account.
      </p>

      {/* Order Summary Card */}
      {order && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xs space-y-5">
          {/* Order Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Order Number
              </span>
              <p className="font-mono text-sm font-black text-slate-900">
                #{orderDisplayNumber}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-full text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 ${
                  order.status === "cancelled"
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-[#004D38]"
                }`}
              >
                Order: {order.status || "PENDING"}
              </span>

              <span
                className={`inline-block rounded-full text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 ${
                  isPaid ? "bg-emerald-100 text-[#004D38]" : "bg-amber-100 text-amber-800"
                }`}
              >
                Payment: {order.paymentStatus || "PENDING"}
              </span>
            </div>
          </div>

          {/* Items Preview */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Items Purchased ({order.items.length})
              </span>

              <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {order.items.map((item, idx) => {
                  const lineTotal = parsePrice(item.lineTotal || (parsePrice(item.unitPrice) * item.quantity));
                  const name = item.productName || item.name || "Product details unavailable";

                  return (
                    <div key={idx} className="flex items-center justify-between pt-2 text-xs">
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="font-bold text-slate-800 truncate">{name}</p>
                        {item.sku && (
                          <p className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-slate-500 mr-2">×{item.quantity}</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Financial Totals */}
          <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(parsePrice(order.subtotal))}
              </span>
            </div>

            {parsePrice(order.discountTotal) > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Coupon Discount ({order.couponCode || "PROMO"})</span>
                <span>-{formatCurrency(parsePrice(order.discountTotal))}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Shipping & Delivery</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(parsePrice(order.shippingTotal))}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Estimated Taxes (GST)</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(parsePrice(order.taxTotal))}
              </span>
            </div>

            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2 text-sm">
              <span className="font-black text-slate-950">Grand Total</span>
              <span className="text-lg font-black text-[#004D38]">
                {formatCurrency(parsePrice(order.grandTotal))}
              </span>
            </div>
          </div>

          {/* Shipping Address Summary */}
          {order.shippingAddress && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 flex items-start gap-2.5 text-xs text-slate-600">
              <MapPin className="size-4 text-[#004D38] shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900">Delivering to: </strong>
                {order.shippingAddress.fullName},{" "}
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 && `, ${order.shippingAddress.addressLine2}`},{" "}
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.postalCode}
              </div>
            </div>
          )}

          {/* Retry Payment Notice & CTA if Payment is Pending */}
          {!isPaid && order.status === "pending" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <Clock className="size-4 text-amber-600" />
                Payment Pending for this Order
              </p>
              <p className="text-[11px] text-amber-700">
                Your order is reserved in pending status. You can complete the payment now or visit your order history to settle it within 30 minutes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link href="/account/orders">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-xs sm:text-sm px-6 py-3 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <PackageCheck className="size-4" />
            View My Orders
          </button>
        </Link>
        <Link href="/shop">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-xs sm:text-sm px-6 py-3 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <ShoppingBag className="size-4" />
            Continue Shopping
          </button>
        </Link>
      </div>
    </div>
  );
}

export default CheckoutSuccessView;
