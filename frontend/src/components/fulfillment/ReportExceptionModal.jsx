"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  X,
  Package,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

const EXCEPTION_REASONS = [
  { id: "out_of_stock", label: "Insufficient / Out of Stock" },
  { id: "damaged_stock", label: "Damaged Stock Discovered" },
  { id: "incorrect_sku_or_variant", label: "Incorrect SKU / Variant Discrepancy" },
  { id: "cannot_pack_or_ship", label: "Item Cannot Be Packed or Shipped" },
  { id: "warehouse_discrepancy", label: "Warehouse Allocation Discrepancy" },
  { id: "other", label: "Other Operational Issue" },
];

const RESOLUTION_OPTIONS = [
  {
    id: "request_cancellation",
    label: "Request Item Cancellation",
    description: "Request admin approval to cancel this item and release reservations.",
  },
  {
    id: "retry_fulfillment",
    label: "Retry / Reallocation Assistance",
    description: "Request administrative assistance to reallocate or retry dispatch.",
  },
  {
    id: "request_admin_assistance",
    label: "General Admin Assistance",
    description: "Request operational review without immediate cancellation.",
  },
];

export default function ReportExceptionModal({
  isOpen,
  onClose,
  order,
  item,
  onExceptionCreated,
}) {
  const [reason, setReason] = useState("out_of_stock");
  const [requestedResolution, setRequestedResolution] = useState("request_cancellation");
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item || !order) return null;

  const maxQty = item.quantity || 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!explanation.trim()) {
      toast.error("Please provide an explanation for the fulfillment exception");
      return;
    }

    const numQty = Number(quantity);
    if (!Number.isInteger(numQty) || numQty < 1 || numQty > maxQty) {
      toast.error(`Please select a valid quantity between 1 and ${maxQty}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await vendorService.submitFulfillmentException({
        orderId: order._id || order.secureId,
        orderItemId: item._id,
        reason,
        requestedResolution,
        quantity: numQty,
        explanation: explanation.trim(),
      });

      toast.success("Fulfillment exception submitted successfully", {
        description: `Reference #${res.exceptionNumber || "EXC"} logged for administrator review.`,
      });

      if (onExceptionCreated) {
        onExceptionCreated(res);
      }
      onClose();
    } catch (err) {
      toast.error("Failed to report fulfillment exception", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Report Fulfillment Exception
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Order #{order.orderNumber || order.secureId} • Item: {item.sku}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Snapshot Summary */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Product Name</span>
            <span className="font-bold text-slate-900 truncate max-w-[280px]">
              {item.productName}
            </span>
          </div>
          {item.variantName && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Variant</span>
              <span className="text-slate-700">{item.variantName}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Allocated Quantity</span>
            <span className="font-bold text-slate-800">{item.quantity} unit(s)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Unit Price</span>
            <span className="font-mono text-slate-800">
              ₹{Number(item.unitPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Exception Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            >
              {EXCEPTION_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Affected Quantity (Max: {maxQty}) *
            </label>
            <input
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Requested Resolution *
            </label>
            <div className="space-y-2">
              {RESOLUTION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    requestedResolution === opt.id
                      ? "border-[#004D38] bg-emerald-50/40 text-slate-900"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="requestedResolution"
                    value={opt.id}
                    checked={requestedResolution === opt.id}
                    onChange={(e) => setRequestedResolution(e.target.value)}
                    className="mt-0.5 text-[#004D38] focus:ring-[#004D38]"
                  />
                  <div>
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detailed Explanation *
            </label>
            <textarea
              rows={3}
              required
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Describe the discrepancy, warehouse location, or reason why this item cannot be dispatched..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-800">
            <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Submitting this exception alerts marketplace administrators. Generating an exception does
              not mutate inventory reservations or payment records until administratively resolved.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              <span>Submit Exception</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
