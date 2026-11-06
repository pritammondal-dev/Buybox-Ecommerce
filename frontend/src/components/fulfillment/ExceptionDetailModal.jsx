"use client";

import React, { useState } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Loader2,
  Trash2,
  ShieldCheck,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

const STATUS_BADGES = {
  open: { label: "Open", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  under_review: { label: "Under Review", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  awaiting_vendor: { label: "Clarification Needed", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  resolved: { label: "Resolved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected: { label: "Rejected", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  withdrawn: { label: "Withdrawn", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

export default function ExceptionDetailModal({
  isOpen,
  onClose,
  exception,
  onUpdated,
}) {
  const [clarificationNotes, setClarificationNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  if (!isOpen || !exception) return null;

  const badge = STATUS_BADGES[exception.status] || STATUS_BADGES.open;
  const isAwaitingVendor = exception.status === "awaiting_vendor";
  const canWithdraw = ["open", "awaiting_vendor"].includes(exception.status);

  const handleSendClarification = async (e) => {
    e.preventDefault();
    if (!clarificationNotes.trim()) {
      toast.error("Please enter clarification notes");
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await vendorService.clarifyFulfillmentException(
        exception._id,
        { notes: clarificationNotes.trim() }
      );
      toast.success("Clarification submitted to administrators");
      setClarificationNotes("");
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      toast.error("Failed to submit clarification", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setIsSubmitting(true);
      const updated = await vendorService.withdrawFulfillmentException(exception._id, {
        reason: "Withdrawn by vendor via portal",
      });
      toast.success("Fulfillment exception withdrawn");
      setShowWithdrawConfirm(false);
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      toast.error("Failed to withdraw exception", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
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

        {/* Snapshot Dossier */}
        <div className="my-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">SKU</span>
            <span className="font-mono font-bold text-slate-900">{exception.itemSnapshot?.sku}</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Affected Qty</span>
            <span className="font-bold text-slate-900">{exception.quantity} unit(s)</span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Reason</span>
            <span className="font-semibold text-slate-800 capitalize">
              {exception.reason?.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">Resolution</span>
            <span className="font-semibold text-slate-800 capitalize">
              {exception.requestedResolution?.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200/60 mb-5">
          <h4 className="text-xs font-bold text-slate-700 mb-1">Report Explanation</h4>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
            {exception.explanation}
          </p>
        </div>

        {/* Cancellation / Resolution Details */}
        {exception.cancellationDetails?.cancelledAt && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-950">
            <h4 className="font-bold flex items-center gap-1.5 text-emerald-900 mb-1">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>Resolution Completed</span>
            </h4>
            <p>
              Item cancellation was approved by marketplace administration. {exception.cancellationDetails.quantityReleased} unit(s) released from warehouse reservations.
            </p>
            {exception.cancellationDetails.refundIssued && (
              <p className="mt-1 font-semibold text-emerald-800">
                Customer refund of ₹{Number(exception.cancellationDetails.refundAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} successfully credited.
              </p>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
            Activity Timeline & Actor Log
          </h4>
          <div className="space-y-3">
            {(exception.timeline || []).map((t, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-start gap-3 text-xs">
                <div className="mt-0.5">
                  <div className="size-2 rounded-full bg-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 capitalize">
                      {t.status?.replace(/_/g, " ")} ({t.actorType})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(t.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {t.notes && <p className="text-slate-600 mt-1 leading-snug">{t.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clarification Form (when admin requested info) */}
        {isAwaitingVendor && (
          <form onSubmit={handleSendClarification} className="mb-5 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-3">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <HelpCircle className="size-4 text-amber-600" />
              <span>Administrator Clarification Requested</span>
            </h4>
            <p className="text-xs text-amber-800 leading-snug">
              Marketplace administrators require additional information to proceed with this exception.
            </p>
            <textarea
              rows={2}
              required
              value={clarificationNotes}
              onChange={(e) => setClarificationNotes(e.target.value)}
              placeholder="Provide answer or updated inventory/dispatch details..."
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                <span>Send Clarification</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div>
            {canWithdraw && !showWithdrawConfirm && (
              <button
                type="button"
                onClick={() => setShowWithdrawConfirm(true)}
                disabled={isSubmitting}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
              >
                Withdraw Exception
              </button>
            )}

            {showWithdrawConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Confirm withdrawal?</span>
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={isSubmitting}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
                >
                  Yes, Withdraw
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithdrawConfirm(false)}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

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
