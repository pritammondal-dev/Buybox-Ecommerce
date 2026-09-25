"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle, X, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { orderService } from "../../../services/order.service.js";

export function CancelOrderModal({ order, isOpen, onClose, onCancelled }) {
  const [isCancelling, setIsCancelling] = useState(false);

  if (!isOpen || !order) return null;

  const orderId = order._id || order.id;
  const orderNumber = order.orderNumber || orderId;

  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      // Authoritatively enforced by backend orderService.cancelOrder
      await orderService.cancelOrder(orderId);
      toast.success(`Order #${orderNumber} has been successfully cancelled.`);
      onCancelled();
      onClose();
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to cancel order. Please check current order status.";
      toast.error(errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h2 id="cancel-order-title" className="text-base font-black text-slate-900">
                Cancel Order #{orderNumber}
              </h2>
              <p className="text-xs text-slate-500">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-800 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <ShieldAlert className="size-4 shrink-0 text-rose-600" />
            Cancellation Terms
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-700">
            <li>Reserved items will be immediately returned to warehouse stock.</li>
            <li>If already paid, a full refund will be automatically triggered via your original payment method.</li>
            <li>Once processing begins beyond dispatch, cancellation is no longer possible.</li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Keep Order
          </button>
          <button
            type="button"
            onClick={handleConfirmCancel}
            disabled={isCancelling}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isCancelling ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

CancelOrderModal.propTypes = {
  order: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCancelled: PropTypes.func.isRequired,
};

export default CancelOrderModal;
