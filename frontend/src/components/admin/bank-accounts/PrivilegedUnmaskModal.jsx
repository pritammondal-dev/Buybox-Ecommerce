"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Eye,
  ShieldAlert,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Building,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { adminBankAccountService } from "../../../services/admin/bank-account.service.js";

export function PrivilegedUnmaskModal({
  isOpen,
  onClose,
  account,
  vendorId = null,
}) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedData, setRevealedData] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Clear sensitive revealed data on open or close
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setIsSubmitting(false);
      setRevealedData(null);
      setServerError(null);
      setCopied(false);
    } else {
      setRevealedData(null);
      setReason("");
    }
  }, [isOpen]);

  // Clean up state on unmount
  useEffect(() => {
    return () => {
      setRevealedData(null);
      setReason("");
    };
  }, []);

  if (!isOpen || !account) return null;

  const trimmedReason = reason.trim();
  const isValidReason = trimmedReason.length >= 10 && trimmedReason.length <= 500;

  const handleUnmask = async (e) => {
    e.preventDefault();
    if (!isValidReason) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const targetVendorId = vendorId || account.vendorId?._id || account.vendorId;
      const accountId = account.id || account._id;

      const data = await adminBankAccountService.unmaskAccountNumber(
        accountId,
        trimmedReason,
        targetVendorId
      );

      setRevealedData(data);
      toast.success("Account number unmasked successfully", {
        description: "This privileged access has been recorded in the immutable audit log.",
      });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to unmask bank account number";
      setServerError(msg);
      toast.error("Unmasking failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (revealedData?.accountNumber) {
      navigator.clipboard.writeText(revealedData.accountNumber);
      setCopied(true);
      toast.info("Account number copied to clipboard", {
        description: "Clipboard contents contain sensitive financial data.",
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    // Purge revealed data immediately
    setRevealedData(null);
    setReason("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unmask-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-100/90 text-amber-800 flex items-center justify-center shrink-0">
              <KeyRound className="size-5 text-amber-700" />
            </div>
            <div>
              <h3
                id="unmask-modal-title"
                className="text-lg font-black text-slate-900 tracking-tight"
              >
                Privileged Account Unmasking
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                High-security operational access to raw bank credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close unmask dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Audit Warning Banner */}
        <div className="px-6 pt-5">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <ShieldAlert className="size-4 text-amber-700 shrink-0" />
              <span>Immutable Audit & Compliance Logging</span>
            </div>
            <p className="text-amber-800 leading-relaxed font-medium">
              Every request to reveal encrypted banking credentials is permanently recorded with your employee ID, timestamp, and justification. Access is granted solely for compliance investigations or settlement verification.
            </p>
          </div>
        </div>

        {/* Account Summary Target */}
        <div className="px-6 pt-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="font-bold text-slate-900">{account.bankName}</span>
              <span className="text-[11px] font-mono uppercase font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded-md">
                IFSC: {account.ifscCode}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Account Holder
                </span>
                <span className="font-semibold text-slate-800">
                  {account.accountHolderName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Current Masked ID
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {account.accountNumberMasked || "••••••••••••••••"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="px-6 pt-3">
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 font-medium">
              <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Revealed Data Display OR Reason Collection Form */}
        {revealedData ? (
          <div className="p-6 space-y-5">
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                  Decrypted Account Number
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Verified Session
                </span>
              </div>

              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                <span className="font-mono text-lg font-black tracking-widest text-slate-900 select-all">
                  {revealedData.accountNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-emerald-800 font-medium">
                Plaintext digits are strictly ephemeral and will be cleared from memory immediately upon closing this dialog.
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
              >
                Close & Clear Data
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUnmask} className="p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="unmask-reason"
                  className="block text-xs font-bold text-slate-700"
                >
                  Mandatory Audit Justification <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono ${
                    trimmedReason.length < 10
                      ? "text-slate-400"
                      : trimmedReason.length > 500
                      ? "text-rose-600 font-bold"
                      : "text-emerald-700 font-semibold"
                  }`}
                >
                  {trimmedReason.length} / 500 (min 10)
                </span>
              </div>
              <textarea
                id="unmask-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the regulatory, fraud inspection, or payment reconciliation reason for decrypting this account number..."
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all ${
                  trimmedReason.length > 0 && trimmedReason.length < 10
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500"
                    : "border-slate-200 focus:border-amber-600"
                }`}
              />
              {trimmedReason.length > 0 && trimmedReason.length < 10 && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600">
                  Justification must be at least 10 characters long.
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValidReason || isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-900/10 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Decrypting Credentials...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    <span>Authorize & Decrypt Number</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PrivilegedUnmaskModal;

