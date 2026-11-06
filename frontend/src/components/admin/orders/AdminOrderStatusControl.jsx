"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  Package,
  Ban,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";

const ORDER_STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

const ALL_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
];

const STATUS_DESCRIPTIONS = {
  pending: "Order placed, awaiting confirmation & payment capture",
  confirmed: "Order verified and sent to merchants for preparation",
  processing: "Merchants are packing and preparing items for dispatch",
  shipped: "Parcels handed over to courier carriers with tracking",
  delivered: "Consignments successfully received by customer",
  completed: "Order lifecycle finished and settlement finalized",
  cancelled: "Order cancelled, inventory released & refunds queued",
};

export default function AdminOrderStatusControl({ order, onStatusUpdated }) {
  const currentStatus = order?.status || "pending";
  const validNextStatuses = ORDER_STATUS_TRANSITIONS[currentStatus] || [];

  const [selectedStatus, setSelectedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isTerminal = currentStatus === "completed" || currentStatus === "cancelled";

  const handleOpenTransition = (status) => {
    setSelectedStatus(status);
    setReason("");
    setNotes("");
    setErrorMessage("");
    setShowConfirmModal(true);
  };

  const handleExecuteStatusUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!order || !selectedStatus) return;

    if (isOverride && (!overrideReason || overrideReason.trim().length < 5)) {
      setErrorMessage("A detailed override reason (minimum 5 characters) is required for Superadmin override.");
      return;
    }

    if (selectedStatus === "cancelled" && !reason.trim() && !overrideReason.trim()) {
      setErrorMessage("Please provide a reason for cancelling this order.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        status: selectedStatus,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        expectedPreviousStatus: currentStatus,
        expectedVersion: typeof order.version === "number" ? order.version : 1,
        isOverride: Boolean(isOverride),
        overrideReason: isOverride ? overrideReason.trim() : undefined,
      };

      const orderIdentifier = order._id || order.secureId || order.id;
      const updated = await adminOrderService.updateOrderStatus(orderIdentifier, payload);

      toast.success(`Order status updated to ${selectedStatus.toUpperCase()}`, {
        description: isOverride
          ? `Exceptional override logged: ${overrideReason.trim()}`
          : `Transition from ${currentStatus} to ${selectedStatus} recorded.`,
      });

      setShowConfirmModal(false);
      setSelectedStatus("");
      setReason("");
      setNotes("");
      setIsOverride(false);
      setOverrideReason("");

      if (typeof onStatusUpdated === "function") {
        onStatusUpdated(updated);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to update order status";
      setErrorMessage(msg);
      toast.error("Status Update Failed", { description: msg });

      // If concurrency conflict, refresh order data
      if (err.response?.status === 409 && typeof onStatusUpdated === "function") {
        toast.info("Refreshing Order", {
          description: "Stale version detected. Reloading latest order details...",
        });
        setTimeout(() => onStatusUpdated(), 1200);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-900">
              Order Lifecycle &amp; Status Controls
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              Superadmin Authorized
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200">
              Order Version: v{order?.version ?? 1}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Current status:{" "}
            <strong className="text-slate-800 uppercase font-bold">
              {currentStatus}
            </strong>
            {" — "}
            {STATUS_DESCRIPTIONS[currentStatus] || "Active state"}
          </p>
        </div>

        {/* Quick Override Toggle */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
          <input
            id="superadmin-override-toggle"
            type="checkbox"
            checked={isOverride}
            onChange={(e) => {
              setIsOverride(e.target.checked);
              if (!e.target.checked) setOverrideReason("");
            }}
            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 size-3.5 cursor-pointer"
          />
          <label
            htmlFor="superadmin-override-toggle"
            className="text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center gap-1 select-none"
          >
            <ShieldAlert className="size-3 text-amber-600" />
            <span>Exceptional Override</span>
          </label>
        </div>
      </div>

      {/* Status Transition Action Buttons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>
            {isOverride
              ? "All System Statuses (Override Mode Active):"
              : "Allowed State Transitions:"}
          </span>
          {isTerminal && !isOverride && (
            <span className="text-[11px] text-slate-400 italic">
              Order is in a terminal state ({currentStatus}). Use override for exceptional corrections.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(!isOverride ? validNextStatuses : ALL_STATUSES).map((statusKey) => {
            const isCurrent = statusKey === currentStatus;
            const isCancel = statusKey === "cancelled";
            const isResurrectFromCancel = currentStatus === "cancelled" && statusKey !== "cancelled";

            return (
              <button
                key={statusKey}
                type="button"
                disabled={isCurrent || (isOverride && isResurrectFromCancel)}
                onClick={() => handleOpenTransition(statusKey)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-slate-100 text-slate-400 border-slate-200"
                    : isCancel
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300 shadow-2xs"
                    : statusKey === "delivered" || statusKey === "completed"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-2xs"
                }`}
                title={
                  isResurrectFromCancel
                    ? "Cancelled orders cannot be resurrected directly; place a new order"
                    : `Transition to ${statusKey}`
                }
              >
                {statusKey === "cancelled" ? (
                  <Ban className="size-3.5" />
                ) : statusKey === "delivered" || statusKey === "completed" ? (
                  <Check className="size-3.5" />
                ) : statusKey === "shipped" ? (
                  <Truck className="size-3.5" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                <span className="capitalize">{statusKey}</span>
              </button>
            );
          })}

          {!isOverride && validNextStatuses.length === 0 && (
            <div className="text-xs text-slate-500 py-1">
              No further automatic transitions available. Enable <strong>Exceptional Override</strong> if administrative correction is required.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation & Consequential Action Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  selectedStatus === "cancelled"
                    ? "bg-rose-100 text-rose-700"
                    : isOverride
                    ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {selectedStatus === "cancelled" ? (
                  <Ban className="size-5" />
                ) : isOverride ? (
                  <ShieldAlert className="size-5" />
                ) : (
                  <ArrowRight className="size-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isOverride ? "Superadmin Status Override" : "Confirm Status Transition"}
                </h3>
                <p className="text-xs text-slate-500">
                  Changing Order #{order.orderNumber || order.secureId} from{" "}
                  <span className="font-bold uppercase text-slate-700">{currentStatus}</span> to{" "}
                  <span className="font-bold uppercase text-emerald-700">{selectedStatus}</span>
                </p>
              </div>
            </div>

            {/* Warning alerts for consequential transitions */}
            {selectedStatus === "cancelled" && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-4 shrink-0 text-rose-600" />
                  <span>Consequential Inventory &amp; Refund Actions</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Cancelling will release reserved warehouse stocks, synchronize merchant dispatches, and trigger payment cancellation or refund eligibility.
                </p>
              </div>
            )}

            {isOverride && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="size-4 shrink-0 text-amber-600" />
                  <span>Administrative Audit Trail Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This status override bypasses normal progressive state machine rules. The event, your administrator ID, and justification notes will be permanently committed to the tamper-evident Audit Log.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleExecuteStatusUpdate} className="space-y-3 pt-1">
              {isOverride && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Superadmin Override Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows="2"
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Required: Detail why this exceptional status override is required..."
                    className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Status Change{" "}
                  {selectedStatus === "cancelled" && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  required={selectedStatus === "cancelled" && !isOverride}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    selectedStatus === "cancelled"
                      ? "e.g. Customer request, inventory defect, fraud prevention..."
                      : "Optional explanation for timeline records..."
                  }
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Operations Notes (Optional)
                </label>
                <textarea
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context or carrier/warehouse tracking details..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setShowConfirmModal(false);
                    setErrorMessage("");
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 ${
                    selectedStatus === "cancelled"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : isOverride
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-[#004D38] hover:bg-[#003828]"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Applying Update...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      <span>Confirm &amp; Update Status</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
