"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PackageCheck,
  Truck,
  MapPin,
  CreditCard,
  ArrowLeft,
  XCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Star,
  Info,
  ExternalLink,
  FileText,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/order.service.js";
import { paymentService } from "../../../services/payment.service.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { AccountNav } from "./AccountNav.jsx";
import { OrderStatusBadge } from "./OrderStatusBadge.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import { WriteReviewModal } from "../review/WriteReviewModal.jsx";

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

const TIMELINE_STEPS = [
  { key: "pending", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

export function OrderDetailView({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  // Review Modal State
  const [selectedItemForReview, setSelectedItemForReview] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refetchOrder = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!orderId) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await orderService.getOrderById(orderId);
        if (!isMounted) return;
        const ord = res?.data?.order || res?.data;
        if (!ord) {
          setError("Order not found or inaccessible.");
          setOrder(null);
        } else {
          setOrder(ord);
        }
      } catch (err) {
        if (!isMounted) return;
        const status = err?.status || err?.statusCode;
        if (status === 403) {
          setError("You do not have permission to view this order.");
        } else if (status === 404) {
          setError("Order not found.");
        } else {
          setError(err?.message || "Failed to load order details.");
        }
        setOrder(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId, refreshTrigger]);

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      await orderService.cancelOrder(orderId);
      toast.success("Order cancelled successfully", {
        description: "Reserved warehouse stock has been released.",
      });
      setShowCancelModal(false);
      refetchOrder();
    } catch (err) {
      toast.error(err?.message || "Could not cancel order.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!order) return;
    setIsRetryingPayment(true);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error("Payment Gateway Unavailable", {
          description: "Could not load Razorpay SDK. Please check your internet connection.",
        });
        setIsRetryingPayment(false);
        return;
      }

      const res = await paymentService.createPaymentIntent(orderId);
      const paymentData = res?.data?.payment || res?.data || {};

      const gatewayOrderId =
        paymentData.gatewayOrderId ||
        paymentData.id ||
        res?.data?.gatewayOrderId;

      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        paymentData.keyId;

      if (!razorpayKey) {
        toast.error("Payment configuration error: Razorpay Key ID is not configured.");
        setIsPaying(false);
        return;
      }

      const rzpOptions = {
        key: razorpayKey,
        amount: paymentData.amount,
        currency: paymentData.currency || "INR",
        name: "Buybox Store",
        description: `Order Payment for ${order.orderNumber || orderId}`,
        order_id: gatewayOrderId,
        prefill: {
          name: order.shippingAddress?.fullName || "",
          contact: order.shippingAddress?.phone || "",
        },
        theme: {
          color: "#007A55",
        },
        handler: async (response) => {
          try {
            toast.loading("Verifying payment with bank...", { id: "payment-verify" });
            await paymentService.verifyPaymentSignature({
              orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            toast.success("Payment verified successfully!", {
              id: "payment-verify",
              description: "Your order is now confirmed and being prepared.",
            });
            refetchOrder();
          } catch (verifyErr) {
            toast.error("Payment verification failed", {
              id: "payment-verify",
              description: verifyErr?.message || "Please contact support if funds were deducted.",
            });
            refetchOrder();
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment window closed", {
              description: "Your order remains pending. You can retry anytime.",
            });
          },
        },
      };

      const razorpayInstance = new window.Razorpay(rzpOptions);
      razorpayInstance.on("payment.failed", (failResponse) => {
        toast.error("Payment Authorization Failed", {
          description: failResponse.error?.description || "Transaction declined by bank.",
        });
        refetchOrder();
      });
      razorpayInstance.open();
    } catch (err) {
      toast.error(err?.message || "Failed to initialize payment.");
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const currentStatus = (order?.status || "").toLowerCase();
  const currentPaymentStatus = (order?.paymentStatus || "").toLowerCase();

  const isCancellable =
    order && ["pending", "confirmed", "processing"].includes(currentStatus);

  const isPendingPayment =
    order && currentStatus === "pending" && currentPaymentStatus !== "paid";

  const isDeliveredOrCompleted =
    order && (currentStatus === "delivered" || currentStatus === "completed");

  const hasInvoice =
    order &&
    (currentPaymentStatus === "paid" ||
      ["confirmed", "processing", "shipped", "delivered", "completed"].includes(currentStatus));

  const orderNumber = order?.orderNumber || `BB-${orderId?.slice(-8)?.toUpperCase()}`;

  // Timeline active step calculation
  const getTimelineStepIndex = () => {
    if (currentStatus === "cancelled") return -1;
    if (currentStatus === "completed" || currentStatus === "delivered") return 4;
    const idx = TIMELINE_STEPS.findIndex((s) => s.key === currentStatus);
    return idx >= 0 ? idx : 0;
  };
  const activeTimelineIdx = getTimelineStepIndex();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-[#007A55] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/account" className="hover:text-[#007A55] transition-colors">
          My Account
        </Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:text-[#007A55] transition-colors">
          Orders
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{orderNumber}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Account Nav (4 cols) */}
        <div className="lg:col-span-4">
          <AccountNav />
        </div>

        {/* Right: Order Details (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
            {/* Header & Back Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
              <div>
                <Link
                  href="/account/orders"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:underline mb-1"
                >
                  <ArrowLeft className="size-3.5" />
                  Back to Orders
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                  Order {orderNumber}
                </h1>
                {order?.createdAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Placed on{" "}
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {order && (
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.customerDisplayStatus || order.status} type="order" size="md" />
                  <OrderStatusBadge status={order.paymentStatus} type="payment" size="md" />

                  {isCancellable && (
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="rounded-full border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs px-3.5 py-1.5 transition-colors cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  )}

                  {hasInvoice && (
                    <Link
                      href={`/orders/${order._id || orderId}/invoice`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="View & Print Tax Invoice"
                    >
                      <FileText className="size-3.5 text-slate-500" />
                      <span>Tax Invoice</span>
                    </Link>
                  )}

                  {isDeliveredOrCompleted && (
                    <Link
                      href={`/orders/${order._id || orderId}/return`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#007A55] font-bold text-xs px-3.5 py-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="Return or Exchange Delivered Items"
                    >
                      <RotateCcw className="size-3.5" />
                      <span>Return / Exchange</span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Pending Payment Recovery Banner */}
            {isPendingPayment && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black text-amber-950">
                      Payment Pending for this Order
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Your order is reserved for 30 minutes. Complete payment to initiate warehouse dispatch.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isRetryingPayment}
                  onClick={handleRetryPayment}
                  className="rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-5 py-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CreditCard className="size-4" />
                  {isRetryingPayment ? "Connecting Gateway..." : "Pay Now with Razorpay"}
                </button>
              </div>
            )}

            {/* Loading & Error States */}
            {isLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : error || !order ? (
              <div className="py-12 text-center space-y-3">
                <AlertTriangle className="size-10 text-rose-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">
                  {error || "Order Details Unavailable"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  We could not display this order. It may belong to a different account or has been removed.
                </p>
                <Link
                  href="/account/orders"
                  className="inline-block rounded-full bg-[#007A55] text-white font-bold text-xs px-6 py-2 hover:bg-[#004D38]"
                >
                  Return to Orders
                </Link>
              </div>
            ) : (
              <>
                {/* Status Timeline */}
                <div className="rounded-2xl border bg-slate-50/60 p-5 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Order Status Timeline
                  </h3>

                  {currentStatus === "cancelled" ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200">
                      <XCircle className="size-4 text-rose-600 shrink-0" />
                      <span>This order has been cancelled and warehouse stock has been returned.</span>
                    </div>
                  ) : (
                    <div className="relative pt-2 pb-1">
                      <div className="grid grid-cols-5 gap-2 text-center">
                        {TIMELINE_STEPS.map((step, idx) => {
                          const isPastOrCurrent = idx <= activeTimelineIdx;
                          const isCurrent = idx === activeTimelineIdx;
                          let stepLabel = step.label;
                          if (step.key === "confirmed") {
                            if (
                              order.isAwaitingVendorConfirmation ||
                              order.customerDisplayStatus === "awaiting_merchant_confirmation"
                            ) {
                              stepLabel = "Merchant Review";
                            } else if (order.customerDisplayStatus === "merchant_accepted") {
                              stepLabel = "Accepted";
                            }
                          }

                          return (
                            <div key={step.key} className="space-y-1.5">
                              <div
                                className={`mx-auto flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                  isCurrent
                                    ? "bg-[#007A55] text-white ring-4 ring-emerald-100"
                                    : isPastOrCurrent
                                    ? "bg-emerald-600 text-white"
                                    : "bg-slate-200 text-slate-500"
                                }`}
                              >
                                {isPastOrCurrent ? "✓" : idx + 1}
                              </div>
                              <p
                                className={`text-[11px] font-bold ${
                                  isCurrent
                                    ? "text-[#007A55]"
                                    : isPastOrCurrent
                                    ? "text-slate-900"
                                    : "text-slate-400"
                                }`}
                              >
                                {stepLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Estimated Delivery Information Section */}
                {order.status !== "cancelled" && (
                  <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50 p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-[#007A55]/10 text-[#007A55]">
                          <Truck className="size-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Estimated Delivery
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Authoritative fulfillment & shipment timeline
                          </p>
                        </div>
                      </div>

                      {order.estimatedDelivery?.source && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          {order.estimatedDelivery.source === "courier"
                            ? "Courier Confirmed"
                            : order.estimatedDelivery.source === "shipment"
                            ? "Shipment Dispatched"
                            : order.estimatedDelivery.source === "vendor_confirmed"
                            ? "Merchant Confirmed"
                            : order.estimatedDelivery.source === "actual_delivery"
                            ? "Delivered"
                            : order.estimatedDelivery.source === "awaiting_vendor_confirmation"
                            ? "Awaiting Merchant"
                            : order.estimatedDelivery.source === "awaiting_fulfillment_details"
                            ? "Preparing Order"
                            : order.estimatedDelivery.source === "vendor_rejected_triage"
                            ? "Under Review"
                            : order.estimatedDelivery.source === "multi_shipment"
                            ? "Multi-Shipment Order"
                            : "Standard Window"}
                        </span>
                      )}
                    </div>

                    {/* Delivery Date / Window Highlight */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        {order.estimatedDelivery?.estimatedDateRange ? (
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-slate-500">
                              Expected Arrival Date:
                            </span>
                            <p className="text-lg sm:text-xl font-black text-[#007A55] tracking-tight">
                              {order.estimatedDelivery.estimatedDateRange}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              <Clock className="size-4 text-amber-600 shrink-0" />
                              <span>
                                {order.estimatedDelivery?.message ||
                                  "Expected delivery date will be confirmed once the merchant processes your order."}
                              </span>
                            </div>
                            {order.estimatedDelivery?.provisionalEstimate?.window && (
                              <p className="text-[11px] text-slate-400 italic">
                                Standard checkout estimate: {order.estimatedDelivery.provisionalEstimate.window} ({order.estimatedDelivery.provisionalEstimate.disclaimer || "Subject to merchant confirmation"})
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {order.estimatedDelivery?.isDelivered && (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#007A55]">
                          <CheckCircle2 className="size-3.5" />
                          <span>Delivered</span>
                        </div>
                      )}
                    </div>

                    {/* Multi-Shipment Details (when order has separate shipments) */}
                    {Array.isArray(order.shipments) && order.shipments.length > 0 && (
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Shipments ({order.shipments.length})
                        </h4>

                        <div className="space-y-2.5">
                          {order.shipments.map((shp, sIdx) => {
                            const shpEst = shp.estimatedDelivery?.estimatedDateRange;
                            const shpFallback = shp.estimatedDelivery?.message;

                            return (
                              <div
                                key={shp._id || shp.shipmentNumber || sIdx}
                                className="rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-2 text-xs shadow-2xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Package className="size-3.5 text-slate-500" />
                                    <span className="font-bold text-slate-900">
                                      Shipment {shp.shipmentNumber || `#${sIdx + 1}`}
                                    </span>
                                  </div>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#007A55] uppercase tracking-wider border border-emerald-100">
                                    {shp.status?.replace(/_/g, " ")}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                                  <div>
                                    <span className="text-slate-400">Estimate: </span>
                                    {shpEst ? (
                                      <strong className="text-[#007A55] font-bold">{shpEst}</strong>
                                    ) : (
                                      <span className="text-slate-500 italic">
                                        {shpFallback || "Delivery estimate will be available after shipment confirmation."}
                                      </span>
                                    )}
                                  </div>

                                  {(shp.carrier || shp.trackingNumber) && (
                                    <div className="flex items-center gap-2 text-slate-500">
                                      {shp.carrier && <span>Carrier: <strong className="text-slate-700">{shp.carrier}</strong></span>}
                                      {shp.trackingNumber && (
                                        <span>
                                          Tracking:{" "}
                                          {shp.trackingUrl ? (
                                            <a
                                              href={shp.trackingUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[#007A55] hover:underline inline-flex items-center gap-0.5 font-mono"
                                            >
                                              {shp.trackingNumber}
                                              <ExternalLink className="size-2.5" />
                                            </a>
                                          ) : (
                                            <span className="font-mono text-slate-700">{shp.trackingNumber}</span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {Array.isArray(shp.items) && shp.items.length > 0 && (
                                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-50 flex flex-wrap gap-2">
                                    <span>Contains:</span>
                                    {shp.items.map((it, iIdx) => (
                                      <span key={iIdx} className="font-medium text-slate-600">
                                        {it.quantity}× {it.name || "Item"}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-Vendor Package Grouping (Phase VD-05) */}
                {Array.isArray(order.vendorPackages) && order.vendorPackages.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Truck className="size-4 text-[#007A55]" />
                      <span>Fulfillment Packages ({order.vendorPackages.length} {order.vendorPackages.length > 1 ? "Dispatches" : "Dispatch"})</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {order.vendorPackages.map((pkg, idx) => (
                        <div
                          key={pkg.vendorId || idx}
                          className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              Package {idx + 1}: {pkg.vendorName || "Merchant Partner"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                pkg.acceptanceStatus === "accepted"
                                  ? "bg-emerald-50 text-[#007A55] border border-emerald-200"
                                  : pkg.acceptanceStatus === "rejected"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {pkg.acceptanceStatus === "accepted"
                                ? pkg.isFulfillmentConfirmed
                                  ? "Confirmed"
                                  : "Merchant Accepted"
                                : pkg.acceptanceStatus === "rejected"
                                ? "Rejected / In Triage"
                                : "Awaiting Merchant"}
                            </span>
                          </div>

                          <div className="space-y-1 text-slate-600 text-[11px]">
                            <div>
                              Merchant: <strong className="text-slate-800">{pkg.vendorName || "Merchant Partner"}</strong>
                            </div>
                            <div>
                              Expected Delivery:{" "}
                              {pkg.expectedDeliveryDate ? (
                                <strong className="text-[#007A55]">
                                  {new Date(pkg.expectedDeliveryDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </strong>
                              ) : pkg.acceptanceStatus === "accepted" ? (
                                <span className="text-slate-500 italic">To be confirmed with shipping details</span>
                              ) : (
                                <span className="text-slate-500 italic">Awaiting merchant confirmation</span>
                              )}
                            </div>
                            <div>
                              Courier:{" "}
                              {pkg.assignedShipmentPartner?.partnerName ? (
                                <strong className="text-slate-800">{pkg.assignedShipmentPartner.partnerName}</strong>
                              ) : (
                                <span className="text-slate-500 italic">To be assigned by merchant</span>
                              )}
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                            <span>Contains: </span>
                            {pkg.items?.map((it, i) => (
                              <span key={i} className="font-medium text-slate-700">
                                {it.quantity}× {it.productName || it.name || "Item"}{i < pkg.items.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ordered Items Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Ordered Products ({order.items?.length || 0})
                  </h3>

                  <div className="divide-y rounded-2xl border overflow-hidden">
                    {order.items?.map((item, idx) => {
                      const unit = parsePrice(item.unitPrice || 0);
                      const lineTotal = parsePrice(item.lineTotal || (unit * item.quantity));

                      return (
                        <div
                          key={item._id || idx}
                          className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white hover:bg-slate-50/50 transition-colors text-xs"
                        >
                          <div className="space-y-1 min-w-0 max-w-md">
                            <p className="font-bold text-slate-900 truncate text-sm">
                              {item.productName || "Product details unavailable"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              {item.variantName && (
                                <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-700 font-semibold">
                                  {item.variantName}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                Qty: {item.quantity} × {formatCurrency(unit)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-slate-950">
                              {formatCurrency(lineTotal)}
                            </span>

                            {/* Return or Exchange Action */}
                            {isDeliveredOrCompleted && (
                              item.returnStatus && item.returnStatus !== "none" ? (
                                <Link
                                  href={`/orders/${order._id || orderId}/return`}
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 font-bold text-[11px] px-3 py-1 transition-colors shadow-2xs"
                                >
                                  <RefreshCw className="size-3 text-amber-600" />
                                  <span>Return: {item.returnStatus.toUpperCase()}</span>
                                </Link>
                              ) : (
                                <Link
                                  href={`/orders/${order._id || orderId}/return`}
                                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 text-[#007A55] hover:bg-emerald-100 font-bold text-[11px] px-3 py-1 transition-colors shadow-2xs"
                                >
                                  <RotateCcw className="size-3" />
                                  <span>Return / Exchange</span>
                                </Link>
                              )
                            )}

                            {/* Write Review Button - ONLY if delivered/completed */}
                            {isDeliveredOrCompleted && item.productId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemForReview(item);
                                  setIsReviewModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-[11px] px-3 py-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Star className="size-3 text-amber-500 fill-amber-500" />
                                <span>Write Review</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Delivery Address & Payment Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Shipping Address Snapshot */}
                  {order.shippingAddress && (
                    <div className="rounded-2xl border p-5 space-y-2 text-xs bg-white shadow-xs">
                      <div className="flex items-center gap-1.5 font-extrabold text-slate-900 pb-1 border-b">
                        <MapPin className="size-4 text-[#007A55]" />
                        <span>Delivery Address Snapshot</span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">
                        {order.shippingAddress.fullName}
                      </p>
                      <p className="text-slate-600">
                        {order.shippingAddress.addressLine1}
                        {order.shippingAddress.addressLine2 && `, ${order.shippingAddress.addressLine2}`}
                      </p>
                      <p className="text-slate-600">
                        {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.postalCode}
                      </p>
                      <p className="text-slate-500 pt-1">
                        Contact Phone: {order.shippingAddress.phone}
                      </p>
                    </div>
                  )}

                  {/* Payment Overview */}
                  <div className="rounded-2xl border p-5 space-y-2 text-xs bg-white shadow-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 pb-1 border-b">
                      <CreditCard className="size-4 text-[#007A55]" />
                      <span>Payment Method & Status</span>
                    </div>
                    <div className="space-y-1.5 pt-1 text-slate-600">
                      <div className="flex justify-between items-center">
                        <span>Payment Method:</span>
                        <strong className="text-slate-900 uppercase">Razorpay Secure</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Payment Status:</span>
                        <OrderStatusBadge status={order.paymentStatus} type="payment" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Currency:</span>
                        <strong className="text-slate-900">{order.currency || "INR"}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authoritative Price Breakdown */}
                <div className="rounded-2xl border bg-slate-50/70 p-5 space-y-2.5 text-xs text-slate-700">
                  <h3 className="font-extrabold uppercase tracking-wider text-slate-900 pb-1 border-b">
                    Order Price Summary
                  </h3>

                  <div className="flex justify-between">
                    <span>Items Subtotal:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(parsePrice(order.subtotal || 0))}
                    </span>
                  </div>

                  {parsePrice(order.discountTotal || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>
                        Promotional Discount {order.couponCode ? `(${order.couponCode})` : ""}:
                      </span>
                      <span className="font-bold">
                        - {formatCurrency(parsePrice(order.discountTotal))}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Estimated Taxes (GST):</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(parsePrice(order.taxTotal || 0))}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Shipping & Delivery:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(parsePrice(order.shippingTotal || 0))}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-black text-slate-950">
                    <span>Grand Total:</span>
                    <span className="text-base text-[#007A55]">
                      {formatCurrency(parsePrice(order.grandTotal || 0))}
                    </span>
                  </div>
                </div>

                {/* 7-Day Flipkart Returns Guarantee Info */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="size-4 text-[#007A55] mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">7-Day Hassle-Free Returns & Exchange Guarantee</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Delivered items are eligible for self-service return or exchange within 7 calendar days of delivery. Our courier partner handles doorstep reverse pickup directly from your address.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border space-y-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 mx-auto">
              <XCircle className="size-6 stroke-[1.5]" />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-black text-slate-950">
                Cancel Order {orderNumber}
              </h2>
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel this order? Warehouse inventory reserved for your order will be released. If your payment was captured, an automatic refund will be credited back. Refund processing time may vary depending on the payment provider.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setShowCancelModal(false)}
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Keep Order
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelOrder}
                className="w-full rounded-full bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {isReviewModalOpen && selectedItemForReview && order && (
        <WriteReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setSelectedItemForReview(null);
          }}
          orderId={order._id || orderId}
          productId={selectedItemForReview.productId}
          productVariantId={selectedItemForReview.productVariantId || null}
          productName={
            selectedItemForReview.productName ||
            selectedItemForReview.name ||
            "Product"
          }
          orderNumber={orderNumber}
          onSuccess={() => {
            setIsReviewModalOpen(false);
            setSelectedItemForReview(null);
          }}
        />
      )}
    </div>
  );
}

export default OrderDetailView;
