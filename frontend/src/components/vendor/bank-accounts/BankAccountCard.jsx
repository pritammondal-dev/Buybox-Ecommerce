"use client";

import React from "react";
import {
  Landmark,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  RotateCw,
  Building,
  Check,
  FileEdit,
} from "lucide-react";

export function BankAccountCard({
  account,
  onSwitchActive,
  onResubmit,
  isSwitching = false,
}) {
  const isApproved = account.status === "approved";
  const isPending = account.status === "pending";
  const isUnderReview = account.status === "under_review";
  const isRejected = account.status === "rejected";
  const isActive = account.isActive === true;

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div
      className={`relative bg-white rounded-3xl border transition-all shadow-xs overflow-hidden ${
        isActive
          ? "border-emerald-500/80 ring-2 ring-emerald-500/10"
          : isRejected
          ? "border-rose-200/90 bg-rose-50/10"
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      {/* Top Banner for Active Status */}
      {isActive && (
        <div className="bg-[#004D38] text-white px-5 py-1.5 flex items-center justify-between text-xs font-bold tracking-tight">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-300" />
            <span>Active Payout Destination</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-emerald-200/90 font-medium">
            Live Transfers
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-5">
        {/* Card Header: Bank Name & Statuses */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`size-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isActive
                  ? "bg-emerald-100/80 text-emerald-800"
                  : isRejected
                  ? "bg-rose-100/80 text-rose-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Landmark className="size-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-black text-slate-900 tracking-tight truncate">
                {account.bankName}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-medium capitalize">
                  {account.accountType || "Current"} Account
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 truncate">
                  Branch: {account.branchName || "Not provided"}
                </span>
                {account.country && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500 truncate font-semibold">
                      {account.country}{account.state ? ` (${account.state})` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
            {/* Verification Status Badge */}
            {isApproved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                <CheckCircle2 className="size-3 text-emerald-600" /> Approved
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                <Clock className="size-3 text-amber-600" /> Pending Review
              </span>
            )}
            {isUnderReview && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/70">
                <ShieldAlert className="size-3 text-indigo-600" /> Under Review
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200/70">
                <AlertCircle className="size-3 text-rose-600" /> Changes Required
              </span>
            )}

            {/* Standby indicator if approved but not active */}
            {isApproved && !isActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Standby
              </span>
            )}
          </div>
        </div>

        {/* Bank Credentials Display */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Account Holder Name
            </span>
            <span className="font-bold text-slate-900 truncate block">
              {account.accountHolderName}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Account Number
            </span>
            <span className="font-mono font-bold text-slate-900 tracking-wider block">
              {account.accountNumberMasked || "••••••••••••••••"}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              IFSC Code
            </span>
            <span className="font-mono font-bold text-slate-800 uppercase block">
              {account.ifscCode}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Submission Date
            </span>
            <span className="text-slate-700 font-medium block">
              {formatDate(account.submittedAt || account.createdAt)}
            </span>
          </div>
        </div>

        {/* Rejection Alert Box */}
        {isRejected && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertCircle className="size-4 text-rose-600 shrink-0" />
              <span>Reviewer Feedback & Changes Required</span>
            </div>
            <p className="text-rose-800 leading-relaxed font-medium pl-6">
              {account.rejectionReason ||
                "Application rejected during administrator verification. Please verify your account number and IFSC details."}
            </p>
            <div className="pl-6 pt-1">
              <button
                type="button"
                onClick={() => onResubmit(account)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <FileEdit className="size-3.5" />
                <span>Resubmit / Correct Details</span>
              </button>
            </div>
          </div>
        )}

        {/* Card Footer: Status explanations & Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border-t border-slate-100">
          <div className="text-slate-500">
            {isApproved && isActive && (
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1.5">
                <Check className="size-3.5" /> Receiving marketplace settlement payouts
              </span>
            )}
            {isApproved && !isActive && (
              <span className="text-slate-500">
                Approved and ready. Click to switch payouts to this destination.
              </span>
            )}
            {isPending && (
              <span className="text-amber-700 font-medium inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> Verification in progress by platform operations
              </span>
            )}
            {isUnderReview && (
              <span className="text-indigo-700 font-medium inline-flex items-center gap-1.5">
                <ShieldAlert className="size-3.5" /> Reviewer currently examining bank credentials
              </span>
            )}
            {isRejected && (
              <span className="text-rose-600 font-medium">
                Resubmit corrected account details to initiate re-verification.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Action to Switch Active Account */}
            {isApproved && !isActive && (
              <button
                type="button"
                onClick={() => onSwitchActive(account)}
                disabled={isSwitching}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                <span>Set as Active Payout Account</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}

            {/* Resubmit button if rejected and not in alert */}
            {isRejected && (
              <button
                type="button"
                onClick={() => onResubmit(account)}
                className="w-full sm:w-auto sm:hidden inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
              >
                <RotateCw className="size-3.5" />
                <span>Resubmit Application</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BankAccountCard;

