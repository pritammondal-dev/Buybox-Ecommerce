"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  ArrowRight,
  Clock,
  AlertCircle,
  CreditCard,
  XCircle,
  ChevronRight,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/order.service.js";
import { useAuth } from "../../../hooks/useAuth.js";
import { formatCurrency, parsePrice } from "../../../utils/formatCurrency.js";
import { AccountNav } from "./AccountNav.jsx";
import { OrderStatusBadge } from "./OrderStatusBadge.jsx";
import { Skeleton } from "../../ui/Skeleton.jsx";
import { WriteReviewModal } from "../review/WriteReviewModal.jsx";

const STATUS_FILTERS = [
  { label: "All Orders", key: "all" },
  { label: "Pending", key: "pending" },
  { label: "Confirmed", key: "confirmed" },
  { label: "Processing", key: "processing" },
  { label: "Shipped", key: "shipped" },
  { label: "Delivered", key: "delivered" },
  { label: "Cancelled", key: "cancelled" },
];

export function OrdersPageView() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState(null);

  // Review Modal State
  const [reviewTarget, setReviewTarget] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refetchOrders = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      if (!isAuthenticated) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await orderService.getMyOrders();
        if (!isMounted) return;
        const list =
          res?.data?.orders || (Array.isArray(res?.data) ? res.data : []);
        setOrders(list);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load orders.");
        setOrders([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, refreshTrigger]);

  const handleOpenCancelModal = (order) => {
    setSelectedOrderToCancel(order);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrderToCancel) return;
    const orderId = selectedOrderToCancel._id || selectedOrderToCancel.id;
    setCancellingOrderId(orderId);

    try {
      await orderService.cancelOrder(orderId);
      toast.success("Order cancelled successfully", {
        description: `Order ${selectedOrderToCancel.orderNumber || ""} has been cancelled.`,
      });
      // Update locally
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === orderId ? { ...o, status: "cancelled" } : o
        )
      );
      setShowCancelModal(false);
      setSelectedOrderToCancel(null);
    } catch (err) {
      toast.error(err?.message || "Failed to cancel order.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    const status = (order.status || "").toLowerCase();
    if (activeTab === "delivered") {
      return status === "delivered" || status === "completed";
    }
    return status === activeTab;
  });

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
        <span className="font-semibold text-foreground">Orders</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Account Nav (4 cols) */}
        <div className="lg:col-span-4">
          <AccountNav />
        </div>

        {/* Right: Orders List (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-xs space-y-6">
            <div className="pb-4 border-b">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                My Orders
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Track delivery status, review past purchases, or retry pending payments
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b scrollbar-none">
              {STATUS_FILTERS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold shrink-0 transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#007A55] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content States */}
            {isLoading ? (
              <div className="space-y-4 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                ))}
              </div>
            ) : error ? (
              <div className="py-12 text-center space-y-3">
                <AlertCircle className="size-10 text-rose-500 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">Failed to Load Orders</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">{error}</p>
                <button
                  type="button"
                  onClick={refetchOrders}
                  className="rounded-full bg-[#007A55] text-white font-bold text-xs px-6 py-2 hover:bg-[#004D38] cursor-pointer"
                >
                  Retry Loading
                </button>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Package className="size-7 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeTab === "all" ? "No Orders Placed Yet" : `No ${activeTab} orders found`}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {activeTab === "all"
                    ? "When you place an order on Buybox, its receipt and status will be tracked here."
                    : `You currently have no orders matching the "${activeTab}" filter.`}
                </p>
                {activeTab === "all" ? (
                  <div className="pt-2">
                    <Link
                      href="/shop"
                      className="inline-flex items-center gap-2 rounded-full bg-[#007A55] hover:bg-[#004D38] text-white font-bold text-xs px-6 py-2.5 shadow-xs transition-colors"
                    >
                      Start Shopping
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("all")}
                      className="text-xs font-bold text-[#007A55] hover:underline cursor-pointer"
                    >
                      Show All Orders
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {filteredOrders.map((order) => {
                  const id = order._id || order.id;
                  const orderNumber = order.orderNumber || `BB-${id?.slice(-8)?.toUpperCase()}`;
                  const grandTotal = parsePrice(order.grandTotal || order.totalAmount || 0);
                  const isPendingPayment =
                    (order.status || "").toLowerCase() === "pending" &&
                    (order.paymentStatus || "").toLowerCase() !== "paid";
                  const isCancellable =
                    ["pending", "confirmed", "processing"].includes(
                      (order.status || "").toLowerCase()
                    );

                  return (
                    <div
                      key={id}
                      className="rounded-2xl border p-5 hover:border-slate-300 transition-all space-y-4 bg-white shadow-xs"
                    >
                      {/* Order Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Order Number
                          </span>
                          <p className="font-mono text-xs font-black text-slate-900">
                            {orderNumber}
                          </p>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Date Placed
                          </span>
                          <p className="text-xs font-medium text-slate-800">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Recent"}
                          </p>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Grand Total
                          </span>
                          <p className="text-xs font-black text-[#007A55]">
                            {formatCurrency(grandTotal)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <OrderStatusBadge status={order.status} type="order" />
                          <OrderStatusBadge status={order.paymentStatus} type="payment" />
                        </div>
                      </div>

                      {/* Items Preview */}
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                          {order.items.slice(0, 3).map((item, idx) => {
                            const isDelivered =
                              status === "delivered" || status === "completed";
                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-center gap-2"
                              >
                                <span className="truncate font-medium flex-1">
                                  • {item.quantity} ×{" "}
                                  {item.productName ||
                                    item.name ||
                                    "Product details unavailable"}
                                  {item.variantName && (
                                    <span className="text-muted-foreground ml-1.5">
                                      ({item.variantName})
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-semibold text-slate-800">
                                    {formatCurrency(
                                      parsePrice(
                                        item.lineTotal ||
                                          item.unitPrice * item.quantity ||
                                          0
                                      )
                                    )}
                                  </span>
                                  {isDelivered && item.productId && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewTarget({
                                          orderId: id,
                                          productId: item.productId,
                                          productVariantId:
                                            item.productVariantId || null,
                                          productName:
                                            item.productName ||
                                            item.name ||
                                            "Product",
                                          orderNumber:
                                            order.orderNumber || "BB-ORDER",
                                        });
                                        setIsReviewModalOpen(true);
                                      }}
                                      className="rounded-full border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 px-2 py-0.5 text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                    >
                                      <Star className="size-2.5 text-amber-500 fill-amber-500" />
                                      <span>Review</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {order.items.length > 3 && (
                            <p className="text-muted-foreground text-[11px] pt-1">
                              + {order.items.length - 3} more item(s) in this order
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Triggers */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {isPendingPayment && (
                            <Link
                              href={`/account/orders/${id}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 transition-colors shadow-xs"
                            >
                              <CreditCard className="size-3.5" />
                              Pay Now with Razorpay
                            </Link>
                          )}

                          {isCancellable && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(order)}
                              className="rounded-full border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs px-3.5 py-2 transition-colors cursor-pointer"
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>

                        <Link
                          href={`/account/orders/${id}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 transition-colors ml-auto"
                        >
                          View Order Details
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && selectedOrderToCancel && (
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
                Cancel Order {selectedOrderToCancel.orderNumber || ""}
              </h2>
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel this order? Warehouse inventory reserved for your order will be released. If your payment was already captured, an automatic refund will be processed to your original payment method. Refund processing time may vary depending on the payment provider.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={Boolean(cancellingOrderId)}
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedOrderToCancel(null);
                }}
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Keep Order
              </button>

              <button
                type="button"
                disabled={Boolean(cancellingOrderId)}
                onClick={handleConfirmCancel}
                className="w-full rounded-full bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {cancellingOrderId ? "Cancelling..." : "Yes, Cancel Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Review Modal */}
      {isReviewModalOpen && reviewTarget && (
        <WriteReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => {
            setIsReviewModalOpen(false);
            setReviewTarget(null);
          }}
          orderId={reviewTarget.orderId}
          productId={reviewTarget.productId}
          productVariantId={reviewTarget.productVariantId}
          productName={reviewTarget.productName}
          orderNumber={reviewTarget.orderNumber}
          onSuccess={() => {
            setIsReviewModalOpen(false);
            setReviewTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default OrdersPageView;
