"use client";

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  PackageCheck,
  ShoppingBag,
  MapPin,
  Calendar,
  CreditCard,
  Clock,
  ArrowRight,
  Truck,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/order.service.js";
import { paymentService } from "../../../services/payment.service.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { OrderStatusBadge } from "../account/OrderStatusBadge.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import { getOrderDeliveryEstimate } from "../../../constants/order.constants.js";
import { STOREFRONT_BUSINESS_POLICIES } from "../../../config/business-policies.config.js";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function OrderSuccessPageView({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const refetchOrder = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!orderId) return;

    let isCancelled = false;

    async function fetchOrderData() {
      try {
        const res = await orderService.getOrderById(orderId);
        if (isCancelled) return;
        const ord = res?.data?.order || res?.data;
        if (!ord) {
          setError("Order not found or inaccessible.");
          setOrder(null);
        } else {
          setOrder(ord);
          setError(null);
        }
      } catch (err) {
        if (isCancelled) return;
        const status = err?.status || err?.statusCode || err?.response?.status;
        if (status === 403) {
          setError("You do not have permission to view this order.");
        } else if (status === 404) {
          setError("Order could not be located in our records.");
        } else {
          setError(err?.message || "Failed to load order confirmation.");
        }
        setOrder(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchOrderData();

    return () => {
      isCancelled = true;
    };
  }, [orderId, refreshKey]);

  const handleRetryPayment = async () => {
    if (!order) return;
    setIsRetryingPayment(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        toast.error("Payment gateway could not be loaded. Please try again later.");
        return;
      }

      // Idempotently reuse existing order without creating duplicate orders
      const payRes = await paymentService.createPaymentIntent(order._id || orderId);
      const payment = payRes?.data?.payment || payRes?.data;
      const gatewayOrderId = payment?.gatewayOrderId;
      const keyId = payment?.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!gatewayOrderId || !keyId) {
        toast.error("Payment initiation failed. Please try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: keyId,
        amount: Math.round(parsePrice(order.grandTotal) * 100),
        currency: order.currency || "INR",
        name: "Buybox Store",
        description: `Order #${order.orderNumber || orderId}`,
        order_id: gatewayOrderId,
        prefill: {
          name: order.shippingAddress?.fullName || "",
          contact: order.shippingAddress?.phone || "",
        },
        theme: {
          color: "#004D38",
        },
        handler: async function (response) {
          try {
            await paymentService.verifyPaymentSignature({
              orderId: order._id || orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment verified! Your order is now confirmed.");
            refetchOrder();
          } catch (verifyErr) {
            toast.error(verifyErr?.message || "Payment verification failed.");
          }
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err?.message || "Could not start payment. Please try again.");
    } finally {
      setIsRetryingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-4">
        <Skeleton className="size-16 rounded-full mx-auto" />
        <Skeleton className="h-6 w-56 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
        <Skeleton className="h-64 w-full rounded-2xl mt-8" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
          <AlertCircle className="size-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {error || "Order Not Found"}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          We could not load details for this order. Please verify that you are logged into the account used during checkout.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={refetchOrder}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            Retry
          </button>
          <Link href="/account/orders">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003D2C] transition-colors cursor-pointer"
            >
              Go to My Orders
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === "paid";
  const orderNumber = order.orderNumber || order._id || orderId;
  const grandTotal = parsePrice(order.grandTotal);
  const currency = order.currency || "INR";

  // Delivery estimate derived from strict 3-tier hierarchy
  const estimate = getOrderDeliveryEstimate({
    order,
    policy: STOREFRONT_BUSINESS_POLICIES,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/* Top Success Badge & Heading */}
      <div className="text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-emerald-50 text-[#004D38] mb-5 shadow-xs">
          <CheckCircle2 className="size-12 stroke-[2.2]" />
        </div>

        <span className="text-xs font-black uppercase tracking-widest text-[#004D38]">
          {isPaid ? "Payment Verified & Order Confirmed" : "Order Placed Successfully"}
        </span>

        <h1 className="mt-1 text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
          Thank You for Your Order!
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Your order has been safely registered in our fulfillment system. We have sent full confirmation and invoice details to your registered email.
        </p>
      </div>

      {/* Main Order Confirmation Card */}
      <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header with Order ID & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Order Reference
            </span>
            <p className="font-mono text-base sm:text-lg font-black text-slate-950 mt-0.5">
              #{orderNumber}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} type="order" size="sm" />
            <OrderStatusBadge status={order.paymentStatus} type="payment" size="sm" />
          </div>
        </div>

        {/* Financial & Delivery Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-50/80 p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">
              Total Amount
            </span>
            <p className="text-xl font-black text-[#004D38]">
              {formatCurrency(grandTotal, currency)}
            </p>
            <p className="text-[11px] text-slate-500">
              {isPaid ? "Paid in full via Razorpay" : "Payment Pending"}
            </p>
          </div>

          {/* Delivery Information (Strict 3-tier hierarchy) */}
          <div
            className={`rounded-xl p-4 space-y-1 border ${
              estimate.isGenericPolicy
                ? "bg-slate-50/80 border-slate-200/70"
                : "bg-emerald-50/70 border-emerald-200/70"
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
              <Calendar className="size-3.5" />
              <span>{estimate.label}</span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-900">
              {estimate.formatted}
            </p>
            {estimate.isGenericPolicy && (
              <p className="text-[10px] text-slate-500">
                General policy guideline. Confirmed date will be provided once dispatched.
              </p>
            )}
          </div>
        </div>

        {/* Delivery Address Summary (Stored historical snapshot) */}
        {order.shippingAddress && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <MapPin className="size-4 text-[#004D38] shrink-0" />
              <span>Delivery Address Snapshot</span>
            </div>
            <p className="pl-6 text-slate-700">
              <strong className="font-semibold text-slate-900">{order.shippingAddress.fullName}</strong> — {order.shippingAddress.phone}
            </p>
            <p className="pl-6 text-slate-600">
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ""}
              , {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.postalCode}
            </p>
          </div>
        )}

        {/* Order Items Snapshot Preview */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Items in this Order ({order.items.length})
            </span>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {order.items.slice(0, 3).map((item, idx) => {
                const name = item.productName || item.name || "Product";
                const lineTotal = parsePrice(item.lineTotal || (parsePrice(item.unitPrice) * item.quantity));
                return (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-bold text-slate-800 truncate">{name}</p>
                      <p className="text-[11px] text-slate-400">
                        Qty: {item.quantity} {item.variantName ? `• ${item.variantName}` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      {formatCurrency(lineTotal, currency)}
                    </span>
                  </div>
                );
              })}
              {order.items.length > 3 && (
                <p className="text-[11px] text-slate-500 pt-2 italic">
                  + {order.items.length - 3} more item(s) in this order.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Unpaid Warning & Retry Payment CTA */}
        {!isPaid && order.status === "pending" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-2.5">
            <div className="flex items-center gap-2 font-bold">
              <Clock className="size-4 text-amber-700" />
              <span>Action Required: Complete Payment</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your order is registered in our system, but digital payment is pending. You can complete the payment right now to avoid auto-cancellation.
            </p>
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={isRetryingPayment}
              className="inline-flex items-center gap-2 rounded-lg bg-[#004D38] px-4 py-2 text-xs font-bold text-white hover:bg-[#003D2C] transition-colors cursor-pointer disabled:opacity-50"
            >
              <CreditCard className="size-3.5" />
              {isRetryingPayment ? "Connecting to Gateway..." : "Pay Now with Razorpay"}
            </button>
          </div>
        )}
      </div>

      {/* Primary & Secondary Action CTAs */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
        <Link href={`/orders/${order._id || orderId}`} className="w-full sm:w-auto">
          <button
            type="button"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#004D38] hover:bg-[#003D2C] text-white font-bold text-xs sm:text-sm px-6 py-3.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <PackageCheck className="size-4" />
            Track Order / View Details
          </button>
        </Link>

        <Link href="/shop" className="w-full sm:w-auto">
          <button
            type="button"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm px-6 py-3.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingBag className="size-4" />
            Continue Shopping
          </button>
        </Link>
      </div>
    </div>
  );
}

OrderSuccessPageView.propTypes = {
  orderId: PropTypes.string.isRequired,
};

export default OrderSuccessPageView;
