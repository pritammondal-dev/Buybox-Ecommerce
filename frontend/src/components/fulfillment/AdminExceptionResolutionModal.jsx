"use client";

import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  Loader2,
  Trash2,
  RefreshCw,
  Building2,
  Package,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { adminExceptionService } from "@/services/admin/order.service";

const STATUS_BADGES = {
  open: { label: "Open", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  under_review: { label: "Under Review", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  awaiting_vendor: { label: "Awaiting Vendor", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  resolved: { label: "Resolved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected: { label: "Rejected", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  withdrawn: { label: "Withdrawn", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

export default function AdminExceptionResolutionModal({
  isOpen,
  onClose,
  exception,
  onResolved,
}) {
  const [actionNotes, setActionNotes] = useState("");
  const [activeAction, setActiveAction] = useState(null); // 'clarify' | 'review' | 'resolve' | 'reject' | 'cancel'
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !exception) return null;

  const isTerminal = ["resolved", "rejected", "withdrawn"].includes(exception.status);
  const badge = STATUS_BADGES[exception.status] || STATUS_BADGES.open;

  const handleTransition = async (targetStatus) => {
    try {
      setIsProcessing(true);
      const res = await adminExceptionService.transitionException(exception._id, {
        status: targetStatus,
        notes: actionNotes.trim() || undefined,
      });

      toast.success(`Exception status updated to '${targetStatus}'`);
      setActiveAction(null);
      setActionNotes("");
      if (onResolved) onResolved(res);
      onClose();
    } catch (err) {
      toast.error("Failed to update exception status", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveCancellation = async () => {
    try {
      setIsProcessing(true);
      const res = await adminExceptionService.approveCancellation(exception._id, {
        notes: actionNotes.trim() || "Item cancellation approved by administrator",
      });

      toast.success("Item cancellation approved and processed successfully", {
        description: res.refundIssued ? "Customer refund credited and stock reservations released." : "Stock reservations released.",
      });
      setActiveAction(null);
      setActionNotes("");
      if (onResolved) onResolved(res.exception);
      onClose();
    } catch (err) {
      toast.error("Failed to approve item cancellation", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900">
                Exception #{exception.exceptionNumber}
              </h3>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}
              >
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Order #{exception.orderNumber} • Reported {new Date(exception.createdAt).toLocaleString("en-IN")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Vendor & Order Dossier */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Vendor Store</span>
            <span className="font-bold text-slate-900 truncate block">
              {exception.vendorId?.storeName || exception.vendorId?.businessName || "Vendor"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">SKU / Item</span>
            <span className="font-mono font-bold text-slate-900 truncate block">
              {exception.itemSnapshot?.sku}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Affected Qty</span>
            <span className="font-bold text-slate-900">{exception.quantity} unit(s)</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Requested Resolution</span>
            <span className="font-semibold text-slate-800 capitalize">
              {exception.requestedResolution?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/60 mb-5">
          <h4 className="text-xs font-bold text-slate-700 mb-1">Vendor's Reported Explanation</h4>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
            {exception.explanation}
          </p>
        </div>

        {/* Resolution Details if resolved */}
        {exception.cancellationDetails?.cancelledAt && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950">
            <h4 className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Resolution Completed</span>
            </h4>
            <p>
              Cancellation processed for {exception.cancellationDetails.quantityReleased} unit(s). Warehouse reservations released.
            </p>
            {exception.cancellationDetails.refundIssued && (
              <p className="mt-1 font-semibold text-emerald-800">
                Customer refund of ₹{Number(exception.cancellationDetails.refundAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} issued.
              </p>
            )}
          </div>
        )}

        {/* Timeline Log */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
            Audit Trail & Timeline
          </h4>
          <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
            {(exception.timeline || []).map((t, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span className="capitalize">{t.status?.replace(/_/g, " ")} by {t.actorName || t.actorType}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {new Date(t.timestamp).toLocaleString("en-IN")}
                  </span>
                </div>
                {t.notes && <p className="text-slate-600 text-[11px] mt-1">{t.notes}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Action Panel for Active Exceptions */}
        {!isTerminal && (
          <div className="mb-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Administrator Resolution Controls
            </h4>

            {activeAction ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 capitalize">
                    Confirm Action: {activeAction.replace(/_/g, " ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAction(null);
                      setActionNotes("");
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                {activeAction === "cancel" && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-rose-600" />
                      <span>Consequential Action Notice</span>
                    </p>
                    <p>
                      Approving this cancellation will release {exception.quantity} reserved unit(s) back to available stock, compute an authoritative refund for this specific item, and mark the order item cancelled. Unaffected vendors' items and shipments remain intact.
                    </p>
                  </div>
                )}

                <textarea
                  rows={2}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={
                    activeAction === "clarify"
                      ? "Enter question or clarification request for the vendor..."
                      : "Enter resolution or decision rationale notes..."
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAction(null);
                      setActionNotes("");
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (activeAction === "cancel") handleApproveCancellation();
                      else if (activeAction === "clarify") handleTransition("awaiting_vendor");
                      else if (activeAction === "review") handleTransition("under_review");
                      else if (activeAction === "resolve") handleTransition("resolved");
                      else if (activeAction === "reject") handleTransition("rejected");
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white text-xs font-semibold shadow-xs disabled:opacity-50 ${
                      activeAction === "cancel" || activeAction === "reject"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-[#004D38] hover:bg-[#003828]"
                    }`}
                  >
                    {isProcessing && <Loader2 className="size-3.5 animate-spin" />}
                    <span>Confirm {activeAction}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {exception.status === "open" && (
                  <button
                    type="button"
                    onClick={() => setActiveAction("review")}
                    className="px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition-colors"
                  >
                    Mark Under Review
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveAction("clarify")}
                  className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-colors"
                >
                  Request Clarification
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction("resolve")}
                  className="px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-colors"
                >
                  Mark Resolved (Reallocated)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction("reject")}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Reject Exception
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAction("cancel")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <AlertTriangle className="size-3.5" />
                  <span>Approve Cancellation & Refund</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
