"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Package,
  ShieldCheck,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../../../services/order.service.js";
import { returnService } from "../../../../../services/return.service.js";
import { formatCurrency } from "../../../../../utils/formatCurrency.js";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

const RETURN_REASONS = [
  "Defective / Not functioning properly",
  "Physical damage in transit / Box crushed",
  "Item different from description or missing accessories",
  "Audio performance or sound signature not as expected",
  "Wrong model or color variant delivered",
  "Size or ergonomics fit issue",
  "Other issue (specify below)",
];

export function OrderReturnPageView({ orderId }) {
  const [order, setOrder] = useState(null);
  const [existingReturns, setExistingReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [selectedItems, setSelectedItems] = useState({});
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("refund"); // refund or replacement
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReturn, setSubmittedReturn] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [orderRes, returnsRes] = await Promise.allSettled([
          orderService.getOrderById(orderId),
          returnService.getMyReturns(),
        ]);

        if (!isMounted) return;

        if (orderRes.status === "fulfilled") {
          const ord = orderRes.value?.data?.order || orderRes.value?.data;
          setOrder(ord);
          // Initialize first item selected by default
          if (ord?.items?.[0]) {
            const firstId = ord.items[0].productId || ord.items[0]._id;
            setSelectedItems({ [firstId]: ord.items[0].quantity || 1 });
          }
        } else {
          setError("Could not retrieve order details.");
        }

        if (returnsRes.status === "fulfilled") {
          const list = Array.isArray(returnsRes.value?.data)
            ? returnsRes.value.data
            : returnsRes.value?.data?.returns || [];
          const matched = list.filter(
            (r) => (r.orderId?._id || r.orderId)?.toString() === orderId.toString()
          );
          setExistingReturns(matched);
        }
      } catch (err) {
        if (isMounted) setError("Failed to load return data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleToggleItem = (productId, maxQty) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = maxQty;
      }
      return next;
    });
  };

  const handleQtyChange = (productId, qty) => {
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: Number(qty),
    }));
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const itemKeys = Object.keys(selectedItems);
    if (itemKeys.length === 0) {
      toast.error("Please select at least one item to return.");
      return;
    }
    if (!reason) {
      toast.error("Please select a return reason.");
      return;
    }

    const payloadItems = itemKeys.map((pId) => ({
      productId: pId,
      quantity: selectedItems[pId],
      reason,
    }));

    setIsSubmitting(true);
    try {
      const res = await returnService.createReturnRequest({
        orderId,
        items: payloadItems,
        reason,
        resolution,
        description: description.trim(),
      });
      const created = res?.data?.data || res?.data;
      setSubmittedReturn(created);
      toast.success("Return request submitted successfully!");
    } catch (err) {
      toast.error(err?.message || "Failed to submit return request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <p className="font-bold text-slate-800">Order Not Found</p>
          <p className="text-xs text-slate-500">{error || "Could not retrieve order details."}</p>
          <Link href="/orders" className="text-xs font-bold text-[#004D38] hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // Already submitted in this session
  if (submittedReturn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Return Request Initiated</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your return request for Order #{order.orderNumber || orderId.slice(-8)} has been received. Our logistics team will inspect the details and coordinate a doorstep pickup within 2 business days.
          </p>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs text-slate-600">
            Resolution: <span className="font-bold uppercase text-[#004D38]">{resolution}</span>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              View Order Details
            </Link>
            <Link
              href="/account/orders"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check delivered status
  const isDelivered = order.status === "delivered" || order.status === "completed";
  if (!isDelivered) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Order Not Yet Delivered</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Returns and replacements can only be initiated after package delivery has been confirmed by our courier partner. Your order is currently{" "}
            <span className="font-bold uppercase text-slate-800">{order.status}</span>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}/tracking`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Track Shipment Status
            </Link>
            <Link
              href={`/orders/${orderId}`}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Order Details
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check 7-day return policy window
  const deliveredDate = new Date(order.updatedAt || order.createdAt);
  const now = new Date();
  const daysDiff = Math.floor((now - deliveredDate) / (1000 * 60 * 60 * 24));
  const isPastWindow = daysDiff > 7;

  if (isPastWindow) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Return Window Expired</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            The 7-day return and replacement window for this order has expired. If your product is experiencing technical defects, it remains covered under the manufacturer brand warranty.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}/invoice`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Download Warranty Invoice
            </Link>
            <Link
              href="/contact-support"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Contact Buybox Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-6">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Order #{order.orderNumber || orderId.slice(-8)}
        </Link>

        {/* Existing Active Returns if any */}
        {existingReturns.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <RotateCcw className="h-4 w-4 text-amber-700" />
              <span>Active Return Request On File</span>
            </div>
            <p className="text-[11px] text-amber-800">
              You have an existing return request for this order with status:{" "}
              <span className="font-bold uppercase">{existingReturns[0].status}</span>.
            </p>
          </div>
        )}

        {/* Return Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1 border-b border-slate-100 pb-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#004D38]">
              <ShieldCheck className="h-3.5 w-3.5" /> 7-Day Hassle-Free Guarantee
            </div>
            <h1 className="text-xl font-black text-slate-900 pt-1">Return or Replacement Request</h1>
            <p className="text-xs text-slate-500">
              Order #{order.orderNumber || orderId} • Delivered on {deliveredDate.toLocaleDateString()}
            </p>
          </div>

          <form onSubmit={handleSubmitReturn} className="space-y-6">
            {/* Step 1: Select Items */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                1. Select Items to Return
              </label>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                {(order.items || []).map((item) => {
                  const pId = item.productId || item._id;
                  const isChecked = Boolean(selectedItems[pId]);
                  const maxQty = item.quantity || 1;

                  return (
                    <div
                      key={pId}
                      className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                        isChecked ? "bg-emerald-50/20" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(pId, maxQty)}
                          className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] h-4 w-4"
                        />
                        {item.image && (
                          <div className="relative h-12 w-12 shrink-0 rounded-lg border border-slate-100 overflow-hidden bg-slate-50">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-contain p-1"
                              sizes="48px"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-xs text-slate-900">{item.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatCurrency(item.price)} each • Max Qty: {maxQty}
                          </p>
                        </div>
                      </div>

                      {isChecked && maxQty > 1 && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500 font-medium">Return Qty:</span>
                          <select
                            value={selectedItems[pId] || 1}
                            onChange={(e) => handleQtyChange(pId, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                          >
                            {Array.from({ length: maxQty }).map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                {idx + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Preferred Resolution */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                2. Preferred Resolution
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    resolution === "refund"
                      ? "border-[#004D38] bg-emerald-50/40"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value="refund"
                    checked={resolution === "refund"}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-0.5 text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-slate-900 block">Refund</span>
                    <span className="text-[11px] text-slate-500 leading-tight block">
                      Amount refunded to your original payment method after quality check.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-colors ${
                    resolution === "replacement"
                      ? "border-[#004D38] bg-emerald-50/40"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value="replacement"
                    checked={resolution === "replacement"}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-0.5 text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-xs text-slate-900 block">Replacement</span>
                    <span className="text-[11px] text-slate-500 leading-tight block">
                      A brand new identical unit dispatched upon doorstep pickup handover.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Step 3: Reason */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                3. Reason for Return / Exchange <span className="text-red-500">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
              >
                <option value="">-- Choose a Reason --</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                4. Additional Comments & Specific Symptoms
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe any defects, symptoms, or missing parts to speed up quality inspection..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
              />
            </div>

            {/* Step 5: Pickup Address note */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1">
              <span className="font-bold text-slate-800 block">Doorstep Pickup Address:</span>
              <p className="text-slate-600 text-[11px]">
                {order.shippingAddress?.street || order.shippingAddress?.addressLine1},{" "}
                {order.shippingAddress?.city}, {order.shippingAddress?.state} -{" "}
                {order.shippingAddress?.postalCode} (Contact: {order.shippingAddress?.phone})
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Link
                href={`/orders/${orderId}`}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(selectedItems).length === 0 || !reason}
                className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting Request...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" /> Submit Return Request
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
