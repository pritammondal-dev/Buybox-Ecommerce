"use client";

import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import Image from "next/image";
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
  FileText,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  ImageOff,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/order.service.js";
import { paymentService } from "../../../services/payment.service.js";
import { shipmentService } from "../../../services/shipment.service.js";
import { productService } from "../../../services/product.service.js";
import { useCart } from "../../../hooks/useCart.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { OrderStatusBadge } from "../account/OrderStatusBadge.jsx";
import { OrderStatusTimeline } from "./OrderStatusTimeline.jsx";
import { OrderPriceSummary } from "./OrderPriceSummary.jsx";
import { OrderTrackingCard } from "./OrderTrackingCard.jsx";
import { CancelOrderModal } from "./CancelOrderModal.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import {
  isOrderCancellable,
  getOrderDeliveryEstimate,
} from "../../../constants/order.constants.js";
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

export function OrderDetailsPageView({ orderId }) {
  const router = useRouter();
  const { addItem: addCartItem } = useCart();

  const [order, setOrder] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [buyingAgainItemIdx, setBuyingAgainItemIdx] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refetchOrder = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!orderId) return;

    let isCancelled = false;

    async function loadData() {
      try {
        // 1. Fetch Order details authoritatively from backend
        const orderRes = await orderService.getOrderById(orderId);
        if (isCancelled) return;
        const ord = orderRes?.data?.order || orderRes?.data;

        if (!ord) {
          setError("Order could not be located in your account.");
          setOrder(null);
        } else {
          setOrder(ord);
          setError(null);

          // 2. Fetch authenticated customer shipments to find matching shipment for this order
          try {
            const shipRes = await shipmentService.getMyShipments();
            if (isCancelled) return;
            const shipments =
              shipRes?.data?.shipments ||
              (Array.isArray(shipRes?.data) ? shipRes.data : []);
            const matchedShipment = shipments.find(
              (s) =>
                String(s.orderId?._id || s.orderId) === String(ord._id || orderId)
            );
            setShipment(matchedShipment || null);
          } catch {
            if (!isCancelled) setShipment(null);
          }
        }
      } catch (err) {
        if (isCancelled) return;
        const status = err?.status || err?.statusCode || err?.response?.status;
        if (status === 403) {
          setError("You do not have permission to view this order.");
        } else if (status === 404) {
          setError("Order not found.");
        } else {
          setError(err?.message || "Failed to load order details.");
        }
        setOrder(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [orderId, refreshKey]);

  // Payment retry for pending orders (idempotent, uses existing order)
  const handleRetryPayment = async () => {
    if (!order) return;
    setIsRetryingPayment(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || typeof window === "undefined" || !window.Razorpay) {
        toast.error("Payment gateway could not be loaded. Please try again later.");
        return;
      }

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
            toast.success("Payment confirmed! Your order is being processed.");
            refetchOrder();
          } catch (verifyErr) {
            toast.error(verifyErr?.message || "Payment verification failed.");
          }
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err?.message || "Could not start payment.");
    } finally {
      setIsRetryingPayment(false);
    }
  };

  // Buy Again: Checks live catalog stock and pricing before adding to active cart
  const handleBuyAgain = async (item, itemIdx) => {
    const rawProductId = item.productId?._id || item.productId;
    const rawVariantId = item.productVariantId?._id || item.productVariantId;

    if (!rawProductId) {
      toast.error("Product information is no longer active in the catalog.");
      return;
    }

    setBuyingAgainItemIdx(itemIdx);
    try {
      // 1. Fetch live product from catalog
      const productRes = await productService.getProductById(rawProductId);
      const liveProduct = productRes?.data?.product || productRes?.data;

      if (!liveProduct || liveProduct.isActive === false) {
        toast.error("This product is currently inactive or archived.");
        return;
      }

      if (liveProduct.stockStatus === "out_of_stock") {
        toast.error("This product is currently out of stock.");
        return;
      }

      // 2. Use live current price (NEVER recalculate or reuse historical prices)
      const currentPrice = parsePrice(liveProduct.price || liveProduct.salePrice || 0);

      await addCartItem({
        ...(rawVariantId ? { productVariantId: rawVariantId } : {}),
        productId: rawProductId,
        quantity: 1,
        itemSnapshot: {
          name: liveProduct.name || item.productName,
          price: currentPrice,
          image: liveProduct.images?.[0]?.url || item.image || null,
          sku: liveProduct.sku || item.sku,
        },
      });

      toast.success(`"${item.productName}" added to your cart at current price ${formatCurrency(currentPrice)}`);
    } catch (err) {
      toast.error(err?.message || "Could not add item to cart. Please check catalog availability.");
    } finally {
      setBuyingAgainItemIdx(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 mb-4">
          <AlertTriangle className="size-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {error || "Order Unavailable"}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          We could not load the requested order details. Please verify your account permissions.
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
              Back to My Orders
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const orderNumber = order.orderNumber || order._id || orderId;
  const isPaid = order.paymentStatus === "paid";
  const cancellable = isOrderCancellable(order);
  const orderDate = order.createdAt ? new Date(order.createdAt) : null;
  const formattedDate =
    orderDate && !isNaN(orderDate.getTime())
      ? orderDate.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Recorded";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="hover:text-[#004D38] transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3.5 text-slate-400" />
        <Link href="/account/orders" className="hover:text-[#004D38] transition-colors">
          Orders
        </Link>
        <ChevronRight className="size-3.5 text-slate-400" />
        <span className="font-bold text-slate-900 truncate">
          #{orderNumber}
        </span>
      </nav>

      {/* Order Header Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                Order #{orderNumber}
              </h1>
              <OrderStatusBadge status={order.status} type="order" size="md" />
              <OrderStatusBadge status={order.paymentStatus} type="payment" size="md" />
            </div>
            <p className="text-xs text-slate-500">
              Placed on <strong className="font-semibold text-slate-800">{formattedDate}</strong>
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {cancellable && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold px-4 py-2.5 transition-colors cursor-pointer"
              >
                <XCircle className="size-4" />
                Cancel Order
              </button>
            )}

            {!isPaid && order.status === "pending" && (
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={isRetryingPayment}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#004D38] hover:bg-[#003D2C] text-white text-xs font-bold px-4 py-2.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="size-4" />
                {isRetryingPayment ? "Processing..." : "Complete Payment"}
              </button>
            )}

            {/* Truthful Invoice Action */}
            <button
              type="button"
              onClick={() => {
                toast.info(
                  order.status === "delivered" || order.status === "completed"
                    ? "Official GST tax invoice has been dispatched to your registered billing email."
                    : "Official GST tax invoice will be generated and emailed upon delivery completion."
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FileText className="size-4 text-slate-500" />
              Invoice Info
            </button>
          </div>
        </div>
      </div>

      {/* Fulfillment Status Timeline */}
      <OrderStatusTimeline
        status={order.status}
        cancellationReason={order.cancellationReason}
      />

      {/* Main Grid: Order Items vs Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Package className="size-4 text-slate-400" />
                Purchased Items ({order.items?.length || 0})
              </h2>
              <span className="text-[11px] text-slate-400">
                Authoritative Order Snapshot
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {order.items &&
                order.items.map((item, idx) => {
                  const name = item.productName || item.name || "Product Item";
                  const unitPrice = parsePrice(item.unitPrice);
                  const lineTotal = parsePrice(
                    item.lineTotal || unitPrice * item.quantity
                  );
                  const slug =
                    item.productId?.slug ||
                    item.productSlug ||
                    (typeof item.productId === "string" ? item.productId : null);
                  const imageUrl =
                    item.image ||
                    item.productId?.images?.[0]?.url ||
                    item.productId?.image ||
                    null;

                  const isItemAdding = buyingAgainItemIdx === idx;

                  return (
                    <div key={item._id || idx} className="py-4 first:pt-1 last:pb-1">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="size-16 sm:size-20 shrink-0 rounded-xl border border-slate-200/80 bg-slate-50 overflow-hidden flex items-center justify-center relative">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={name}
                              width={80}
                              height={80}
                              className="size-full object-contain p-1"
                              unoptimized
                            />
                          ) : (
                            <ImageOff className="size-6 text-slate-400" />
                          )}
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {slug ? (
                            <Link
                              href={`/product/${slug}`}
                              className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#004D38] transition-colors line-clamp-2"
                            >
                              {name}
                            </Link>
                          ) : (
                            <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                              {name}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            {item.variantName && (
                              <span>Variant: <strong className="text-slate-700">{item.variantName}</strong></span>
                            )}
                            {item.sku && (
                              <span className="font-mono">SKU: {item.sku}</span>
                            )}
                          </div>

                          <div className="pt-1 flex flex-wrap items-center gap-4 text-xs">
                            <span className="text-slate-600">
                              Unit Price:{" "}
                              <strong className="font-semibold text-slate-900">
                                {formatCurrency(unitPrice, order.currency)}
                              </strong>
                            </span>
                            <span className="text-slate-600">
                              Qty:{" "}
                              <strong className="font-semibold text-slate-900">
                                {item.quantity}
                              </strong>
                            </span>
                            <span className="text-slate-900 font-bold ml-auto">
                              Total: {formatCurrency(lineTotal, order.currency)}
                            </span>
                          </div>

                          {/* Buy Again Action */}
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => handleBuyAgain(item, idx)}
                              disabled={isItemAdding}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold px-3 py-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              {isItemAdding ? (
                                <>
                                  <Loader2 className="size-3 animate-spin" />
                                  Checking Catalog...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="size-3 text-[#004D38]" />
                                  Buy Again
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Column: Summaries, Address, Payment, Tracking */}
        <div className="space-y-6">
          {/* Price Summary */}
          <OrderPriceSummary order={order} />

          {/* Tracking Card */}
          <OrderTrackingCard order={order} shipment={shipment} />

          {/* Shipping Address Snapshot */}
          {order.shippingAddress && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <MapPin className="size-4 text-slate-400" />
                  Delivery Address Snapshot
                </h3>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900 text-sm">
                  {order.shippingAddress.fullName}
                </p>
                <p>{order.shippingAddress.phone}</p>
                <p className="text-slate-700 leading-relaxed pt-1">
                  {order.shippingAddress.addressLine1}
                  {order.shippingAddress.addressLine2
                    ? `, ${order.shippingAddress.addressLine2}`
                    : ""}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} —{" "}
                  {order.shippingAddress.postalCode}
                </p>
                <p className="text-[10px] text-slate-400 pt-2 italic">
                  Preserved from the time of order placement.
                </p>
              </div>
            </div>
          )}

          {/* Payment Information */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <CreditCard className="size-4 text-slate-400" />
                Payment Details
              </h3>
              <OrderStatusBadge
                status={order.paymentStatus}
                type="payment"
                size="sm"
              />
            </div>
            <div className="text-xs text-slate-600 space-y-2">
              <div className="flex justify-between">
                <span>Method</span>
                <span className="font-bold text-slate-900">
                  Razorpay Secure Gateway
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payment State</span>
                <span className="font-bold uppercase text-slate-900">
                  {order.paymentStatus || "PENDING"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Currency</span>
                <span className="font-bold text-slate-900">
                  {order.currency || "INR"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-2.5 flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="size-4 text-[#004D38] shrink-0" />
                <span>PCI-DSS compliant transaction. Credentials remain confidential.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Order Modal */}
      <CancelOrderModal
        order={order}
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onCancelled={() => refetchOrder()}
      />
    </div>
  );
}

OrderDetailsPageView.propTypes = {
  orderId: PropTypes.string.isRequired,
};

export default OrderDetailsPageView;
