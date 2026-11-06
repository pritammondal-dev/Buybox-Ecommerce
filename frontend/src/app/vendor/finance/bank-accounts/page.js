"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Landmark,
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Building,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { BankAccountOverview } from "@/components/vendor/bank-accounts/BankAccountOverview";
import { BankAccountCard } from "@/components/vendor/bank-accounts/BankAccountCard";
import { AddBankAccountModal } from "@/components/vendor/bank-accounts/AddBankAccountModal";
import { SwitchActiveConfirmModal } from "@/components/vendor/bank-accounts/SwitchActiveConfirmModal";
import { ResubmitBankAccountModal } from "@/components/vendor/bank-accounts/ResubmitBankAccountModal";

export default function VendorBankAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const [switchingAccount, setSwitchingAccount] = useState(null);
  const [isSubmittingSwitch, setIsSubmittingSwitch] = useState(false);

  const [resubmittingAccount, setResubmittingAccount] = useState(null);
  const [isSubmittingResubmit, setIsSubmittingResubmit] = useState(false);

  // Load bank accounts
  const fetchAccounts = useCallback(async (showToast = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await vendorService.getMyBankAccounts();
      const accountsList =
        res?.data?.data?.accounts ||
        res?.data?.accounts ||
        (Array.isArray(res?.data) ? res.data : []);
      setAccounts(Array.isArray(accountsList) ? accountsList : []);
      if (showToast) {
        toast.success("Bank accounts refreshed");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load bank accounts";
      setError(msg);
      toast.error("Failed to load bank accounts", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Derived statistics
  const maxAccounts = 3;
  const totalAccounts = accounts.length;
  const remainingSlots = Math.max(0, maxAccounts - totalAccounts);
  const activeAccount = accounts.find((a) => a.isActive);
  const approvedCount = accounts.filter((a) => a.status === "approved").length;
  const pendingCount = accounts.filter(
    (a) => a.status === "pending" || a.status === "under_review"
  ).length;
  const rejectedCount = accounts.filter((a) => a.status === "rejected").length;

  // Sorted list: active first, then approved, then pending, then rejected
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      const statusOrder = { approved: 1, under_review: 2, pending: 3, rejected: 4 };
      const orderA = statusOrder[a.status] || 5;
      const orderB = statusOrder[b.status] || 5;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [accounts]);

  // Handle Add Bank Account
  const handleAddAccount = async (payload) => {
    setIsSubmittingAdd(true);
    try {
      await vendorService.submitBankAccount(payload);
      toast.success("Bank account submitted for review", {
        description: "Platform operations will verify the credentials shortly.",
      });
      setIsAddModalOpen(false);
      await fetchAccounts();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit bank account";
      toast.error("Submission failed", { description: msg });
      throw err;
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Handle Switch Active Account
  const handleConfirmSwitch = async (account) => {
    setIsSubmittingSwitch(true);
    try {
      await vendorService.switchActiveBankAccount(account.id || account._id);
      toast.success("Active payout destination updated", {
        description: `${account.bankName} is now your active payout account.`,
      });
      setSwitchingAccount(null);
      await fetchAccounts();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to switch active payout account";
      toast.error("Switch failed", { description: msg });
    } finally {
      setIsSubmittingSwitch(false);
    }
  };

  // Handle Resubmit Account
  const handleConfirmResubmit = async (accountId, payload) => {
    setIsSubmittingResubmit(true);
    try {
      await vendorService.resubmitBankAccount(accountId, payload);
      toast.success("Application resubmitted successfully", {
        description: "Your corrected details are now in the review queue.",
      });
      setResubmittingAccount(null);
      await fetchAccounts();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resubmit bank account";
      toast.error("Resubmission failed", { description: msg });
      throw err;
    } finally {
      setIsSubmittingResubmit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/vendor/finance"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="size-3" />
              <span>Back to Finance</span>
            </Link>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Landmark className="size-6 text-[#004D38]" />
            <span>Bank Account Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Register and manage up to 3 bank accounts for automated settlement disbursements and merchant payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => fetchAccounts(true)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            title="Refresh bank accounts"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            disabled={totalAccounts >= maxAccounts}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all ${
              totalAccounts >= maxAccounts
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-[#004D38] hover:bg-[#003829] text-white shadow-emerald-950/10"
            }`}
          >
            <Plus className="size-3.5" />
            <span>
              {totalAccounts >= maxAccounts
                ? "Slot Limit Reached (3/3)"
                : `Add Bank Account (${totalAccounts}/3)`}
            </span>
          </button>
        </div>
      </div>

      {/* Summary KPI Overview */}
      <BankAccountOverview
        totalAccounts={totalAccounts}
        maxAccounts={maxAccounts}
        activeAccount={activeAccount}
        approvedCount={approvedCount}
        pendingCount={pendingCount}
        rejectedCount={rejectedCount}
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error loading bank accounts</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchAccounts()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Accounts List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Registered Bank Accounts</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {totalAccounts} / {maxAccounts}
            </span>
          </h3>
          {remainingSlots > 0 && (
            <span className="text-xs text-slate-500 font-medium">
              {remainingSlots} {remainingSlots === 1 ? "slot" : "slots"} remaining
            </span>
          )}
        </div>

        {/* Loading Skeletons */}
        {isLoading && accounts.length === 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl">
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 sm:p-14 text-center space-y-4">
            <div className="size-16 rounded-3xl bg-emerald-50 text-[#004D38] flex items-center justify-center mx-auto shadow-xs">
              <Landmark className="size-8 text-[#004D38]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">
                No Bank Accounts Registered
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                To receive automated settlement payouts and initiate withdrawal requests, you must register at least one verified Indian bank account.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003829] text-white text-xs font-bold shadow-md shadow-emerald-950/10 transition-colors"
              >
                <Plus className="size-4" />
                <span>Add Your First Bank Account</span>
              </button>
            </div>
          </div>
        ) : (
          /* List of Cards */
          <div className="grid grid-cols-1 gap-4">
            {sortedAccounts.map((account) => (
              <BankAccountCard
                key={account.id || account._id}
                account={account}
                onSwitchActive={(acc) => setSwitchingAccount(acc)}
                onResubmit={(acc) => setResubmittingAccount(acc)}
                isSwitching={
                  isSubmittingSwitch &&
                  (switchingAccount?.id === account.id ||
                    switchingAccount?._id === account._id)
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Security and Compliance Footer Notice */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-500 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <ShieldCheck className="size-4 text-[#004D38]" />
          <span>Banking Security & Compliance Standards</span>
        </div>
        <p className="font-medium text-slate-600 leading-relaxed">
          All financial credentials submitted through this portal are encrypted at rest using industry-grade AES-256-GCM cryptography. Full account numbers are never displayed on screen or logged into browser cache. Payout destinations are independently reviewed by platform compliance prior to activation.
        </p>
      </div>

      {/* Add Bank Account Modal */}
      <AddBankAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddAccount}
        isSubmitting={isSubmittingAdd}
        remainingSlots={remainingSlots}
      />

      {/* Switch Active Destination Confirmation Modal */}
      <SwitchActiveConfirmModal
        isOpen={!!switchingAccount}
        account={switchingAccount}
        onClose={() => setSwitchingAccount(null)}
        onConfirm={handleConfirmSwitch}
        isSwitching={isSubmittingSwitch}
      />

      {/* Resubmit / Correct Bank Account Modal */}
      <ResubmitBankAccountModal
        isOpen={!!resubmittingAccount}
        account={resubmittingAccount}
        onClose={() => setResubmittingAccount(null)}
        onSubmit={handleConfirmResubmit}
        isSubmitting={isSubmittingResubmit}
      />
    </div>
  );
}

