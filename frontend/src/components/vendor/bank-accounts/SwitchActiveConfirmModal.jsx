"use client";

import React, { useEffect } from "react";
import {
  X,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export function SwitchActiveConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  account,
  isSwitching = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSwitching) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSwitching, onClose]);

  if (!isOpen || !account) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => !isSwitching && onClose()}
      />

      {/* Modal Dialog Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-50/70 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6 text-emerald-700" />
            </div>
            <div>
              <h3
                id="switch-modal-title"
                className="text-lg font-black text-slate-900 tracking-tight"
              >
                Switch Active Payout Destination
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Set primary bank destination for upcoming merchant disbursements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSwitching}
            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
            aria-label="Close switch modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Account Details Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100/80 pb-2">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-emerald-800" />
                <span className="font-bold text-slate-900 text-sm">
                  {account.bankName}
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                {account.accountType || "Current"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Account Number
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {account.accountNumberMasked || "••••••••••••••••"}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  IFSC Code
                </span>
                <span className="font-mono font-bold text-slate-800 uppercase">
                  {account.ifscCode}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Account Holder
                </span>
                <span className="font-semibold text-slate-900">
                  {account.accountHolderName}
                </span>
              </div>
            </div>
          </div>

          {/* Policy Information Notice */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ShieldCheck className="size-4 text-[#004D38] shrink-0" />
              <span>Payout Routing & Continuity Policy</span>
            </div>
            <ul className="text-slate-600 space-y-1.5 list-disc list-inside font-medium leading-relaxed">
              <li>
                Future automated settlement batches and manual payout requests will route directly to this account.
              </li>
              <li>
                Only one approved bank account can be active at any given moment. The previously active account will transition to standby.
              </li>
              <li>
                Any settlements or payouts currently in-flight or processing will remain frozen to their originally snapshotted bank credentials.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSwitching}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(account)}
            disabled={isSwitching}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-md shadow-emerald-900/10 transition-colors disabled:opacity-50"
          >
            {isSwitching ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Switching Destination...</span>
              </>
            ) : (
              <>
                <span>Confirm & Activate Destination</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SwitchActiveConfirmModal;

