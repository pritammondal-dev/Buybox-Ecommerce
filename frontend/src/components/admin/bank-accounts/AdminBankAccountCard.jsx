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
  Edit2,
  Trash2,
  KeyRound,
  Eye,
  Power,
  XCircle,
  Calendar,
  User,
} from "lucide-react";

export function AdminBankAccountCard({
  account,
  onApprove,
  onReject,
  onMarkUnderReview,
  onUnmask,
  onEdit,
  onToggleStatus,
  onDelete,
  canReview = true,
  canApprove = true,
  canReject = true,
  canManage = true,
  canUnmask = true,
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
          ? "border-rose-200 bg-rose-50/10"
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      {/* Top Banner for Active Payout Destination */}
      {isActive && (
        <div className="bg-[#004D38] text-white px-5 py-1.5 flex items-center justify-between text-xs font-bold tracking-tight">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-300" />
            <span>Active Settlement Destination</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-emerald-200/90 font-medium">
            Live Merchant Disbursements
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-4">
        {/* Header: Bank Name & Status Badges */}
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

            {isApproved && !isActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Standby
              </span>
            )}
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Account Holder
            </span>
            <span className="font-bold text-slate-900 truncate block">
              {account.accountHolderName}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Account Number
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-slate-900">
                {account.accountNumberMasked || "••••••••••••••••"}
              </span>
              {canUnmask && onUnmask && (
                <button
                  type="button"
                  onClick={() => onUnmask(account)}
                  title="Privileged Unmask Account Number"
                  className="p-1 rounded-md text-amber-700 hover:bg-amber-100/80 transition-colors"
                >
                  <KeyRound className="size-3.5" />
                </button>
              )}
            </div>
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
              Submitted Date
            </span>
            <span className="text-slate-700 font-medium block">
              {formatDate(account.submittedAt || account.createdAt)}
            </span>
          </div>
        </div>

        {/* Rejection Alert Box */}
        {isRejected && account.rejectionReason && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertCircle className="size-3.5 text-rose-600 shrink-0" />
              <span>Rejection Justification</span>
            </div>
            <p className="text-rose-800 leading-relaxed font-medium pl-5">
              {account.rejectionReason}
            </p>
          </div>
        )}

        {/* Audit / Reviewer Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
          {account.reviewedBy && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3 text-slate-400" />
              Reviewed by: <strong className="text-slate-700">{account.reviewedBy.name || account.reviewedBy.email || "Auditor"}</strong>
            </span>
          )}
          {account.reviewedAt && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 text-slate-400" />
              Reviewed on: {formatDate(account.reviewedAt)}
            </span>
          )}
          {account.activatedAt && (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3 text-emerald-600" />
              Activated: {formatDate(account.activatedAt)}
            </span>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Review actions: Approve / Reject / Under Review */}
            {canApprove && onApprove && !isApproved && (
              <button
                type="button"
                onClick={() => onApprove(account)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <CheckCircle2 className="size-3.5" />
                <span>Approve</span>
              </button>
            )}

            {canReject && onReject && !isRejected && (
              <button
                type="button"
                onClick={() => onReject(account)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <XCircle className="size-3.5" />
                <span>Reject</span>
              </button>
            )}

            {canReview && onMarkUnderReview && isPending && (
              <button
                type="button"
                onClick={() => onMarkUnderReview(account)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-xs transition-colors"
              >
                <ShieldAlert className="size-3.5 text-indigo-600" />
                <span>Mark Under Review</span>
              </button>
            )}

            {/* Set as Active Destination */}
            {canManage && onToggleStatus && isApproved && !isActive && (
              <button
                type="button"
                onClick={() => onToggleStatus(account, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <Power className="size-3.5 text-emerald-400" />
                <span>Set as Active Payout</span>
              </button>
            )}

            {/* Deactivate payout */}
            {canManage && onToggleStatus && isActive && (
              <button
                type="button"
                onClick={() => onToggleStatus(account, false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
              >
                <Power className="size-3.5 text-slate-400" />
                <span>Deactivate Destination</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canManage && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(account)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
              >
                <Edit2 className="size-3.5 text-slate-500" />
                <span>Edit</span>
              </button>
            )}

            {canManage && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(account)}
                title="Safely Archive Bank Account"
                className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminBankAccountCard;

