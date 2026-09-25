"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  XCircle,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../../../services/order.service.js";
import { isOrderCancellable } from "../../../../../constants/order.constants.js";
import { formatCurrency } from "../../../../../utils/formatCurrency.js";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

const CANCELLATION_REASONS = [
  "Ordered by mistake or no longer needed",
  "Found a better price or alternative elsewhere",
  "Estimated delivery timeframe is too long",
  "Need to change delivery address or contact details",
  "Need to modify payment method or billing details",
  "Duplicate order placed unintentionally",
  "Other reason (please describe below)",
];

export function OrderCancelPageView({ orderId }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedReason, setSelectedReason] = useState("");
  const [customComment, setCustomComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await orderService.getOrderById(orderId);
        if (!isMounted) return;
        setOrder(res?.data?.order || res?.data);
      } catch (err) {
        if (isMounted) setError("Could not load order details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error("Please select a cancellation reason.");
      return;
    }

    setIsSubmitting(true);
    const finalReason =
      selectedReason === "Other reason (please describe below)" && customComment.trim()
        ? `Other: ${customComment.trim()}`
        : selectedReason;

    try {
      await orderService.cancelOrder(orderId, { reason: finalReason });
      setIsCancelled(true);
      toast.success("Order cancelled successfully.");
    } catch (err) {
      toast.error(err?.message || "Failed to cancel order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Order Not Found</h2>
          <p className="text-xs text-slate-500">{error || "Unable to find the requested order."}</p>
          <Link href="/orders" className="text-xs font-bold text-[#004D38] hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // Already cancelled state
  if (isCancelled || order.status === "cancelled") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Order Successfully Cancelled</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Order #{order.orderNumber || orderId.slice(-8)} has been cancelled. Any prepaid payment has been queued for immediate refund to your original payment method.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              View Order Details
            </Link>
            <Link
              href="/products"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not cancellable
  const canCancel = isOrderCancellable(order.status);
  if (!canCancel) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Order Cannot Be Cancelled</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Order #{order.orderNumber || orderId.slice(-8)} is currently{" "}
            <span className="font-bold text-slate-800 uppercase">{order.status}</span>. Once an order is processed or shipped, it can no longer be self-cancelled. You can request a return or replacement once delivered.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Return to Order Details
            </Link>
            <Link
              href="/help/returns"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Return Policy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 space-y-6">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Order #{order.orderNumber || orderId.slice(-8)}
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <h1 className="text-xl font-black text-slate-900">Cancel Order</h1>
            <p className="text-xs text-slate-500">
              Please tell us why you want to cancel Order #{order.orderNumber || orderId}
            </p>
          </div>

          {/* Order Summary snippet */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>{order.items?.length || 0} items in order</span>
              <span>Total: {formatCurrency(order.totalAmount || order.total)}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Placed on {new Date(order.createdAt).toLocaleDateString()} • Current Status:{" "}
              <span className="font-bold capitalize text-amber-700">{order.status}</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleCancelSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Select Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                      selectedReason === reason
                        ? "border-[#004D38] bg-emerald-50/40 text-slate-900 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancellationReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="mt-0.5 text-[#004D38] focus:ring-[#004D38]"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === "Other reason (please describe below)" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Additional Details
                </label>
                <textarea
                  value={customComment}
                  onChange={(e) => setCustomComment(e.target.value)}
                  placeholder="Provide brief details regarding your cancellation request..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                />
              </div>
            )}

            {/* Refund terms disclaimer */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                Refund Policy Notice
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                If payment was already charged, your refund will be automatically processed back to the original payment source within 2-5 business days. Reserved stock will be immediately released.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Link
                href={`/orders/${orderId}`}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Nevermind, keep order
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !selectedReason}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" /> Confirm Cancellation
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
