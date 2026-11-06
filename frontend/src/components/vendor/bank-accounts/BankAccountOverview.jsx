"use client";

import React from "react";
import {
  Landmark,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Building2,
} from "lucide-react";

export function BankAccountOverview({
  accounts = [],
  onOpenAddModal,
  maxAccounts = 3,
}) {
  const registeredCount = accounts.length;
  const remainingSlots = Math.max(0, maxAccounts - registeredCount);
  const isLimitReached = registeredCount >= maxAccounts;

  const approvedAccounts = accounts.filter((a) => a.status === "approved");
  const pendingAccounts = accounts.filter(
    (a) => a.status === "pending" || a.status === "under_review"
  );
  const rejectedAccounts = accounts.filter((a) => a.status === "rejected");
  const activeAccount = accounts.find((a) => a.isActive);

  return (
    <div className="space-y-4">
      {/* Primary KPI & Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                <ShieldCheck className="size-3.5" /> Marketplace Payout Destination
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Max {maxAccounts} Bank Accounts
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Bank Account Overview
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Marketplace settlements are automatically transferred to your designated active bank account.
              You may register up to {maxAccounts} verified bank accounts and switch your active destination anytime.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              onClick={onOpenAddModal}
              disabled={isLimitReached}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs ${
                isLimitReached
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-[#004D38] hover:bg-[#003d2c] text-white shadow-emerald-950/20 active:scale-[0.98]"
              }`}
              title={
                isLimitReached
                  ? "Maximum limit of 3 bank accounts reached"
                  : "Submit new bank account"
              }
            >
              <Plus className="size-4" />
              <span>Add Bank Account</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Registered Accounts
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">
                {registeredCount}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                / {maxAccounts}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {remainingSlots === 0
                ? "No slots remaining"
                : `${remainingSlots} slot${remainingSlots > 1 ? "s" : ""} available`}
            </span>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Approved Accounts
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-700">
                {approvedAccounts.length}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                ready
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Eligible for payouts
            </span>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Pending Verification
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-600">
                {pendingAccounts.length}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                under review
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Awaiting admin approval
            </span>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Active Destination
            </span>
            {activeAccount ? (
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900 truncate block">
                  {activeAccount.bankName}
                </span>
                <span className="text-[11px] font-mono text-emerald-700 font-semibold block truncate">
                  {activeAccount.accountNumberMasked}
                </span>
              </div>
            ) : (
              <div className="min-w-0">
                <span className="text-xs font-bold text-rose-600 block">
                  None Active
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Payouts paused
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Warning Banner if No Active Account */}
        {!activeAccount && accounts.length > 0 && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">No active bank account configured: </span>
              Your sales and settlement calculations will continue normally, but scheduled payouts
              cannot be transferred until you have an approved bank account set as your active payout destination.
            </div>
          </div>
        )}

        {/* Informational Guidance for Limit Reached */}
        {isLimitReached && (
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
            <Building2 className="size-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">Three-Account Maximum Reached: </span>
              You have registered all 3 allowed bank accounts. If you need to replace an account,
              please contact partner support or request administrative decommission of an unused account.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BankAccountOverview;

