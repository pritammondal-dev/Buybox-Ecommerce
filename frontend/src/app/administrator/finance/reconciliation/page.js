"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Scale,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Loader2,
  X,
  FileSpreadsheet,
  TrendingUp,
  Building2,
  Plus,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminReconciliationPage() {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Correction Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    vendorId: "",
    amount: "",
    direction: "CREDIT",
    accountCode: "2100",
    contraAccountCode: "1200",
    reason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (val, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
    }).format(Number(val || 0));
  };

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const res = await adminFinanceService.getReconciliationSummary({ currency: "INR" });
      setSummary(res?.data || res);
    } catch (err) {
      toast.error("Failed to load reconciliation summary", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleOpenAdjust = (vendorId = "") => {
    setAdjustForm({
      vendorId: vendorId || "",
      amount: "",
      direction: "CREDIT",
      accountCode: "2100",
      contraAccountCode: "1200",
      reason: "",
    });
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!adjustForm.vendorId.trim()) {
      toast.error("Vendor ID is required");
      return;
    }
    const amt = Number(adjustForm.amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid positive correction amount");
      return;
    }
    if (!adjustForm.reason.trim() || adjustForm.reason.trim().length < 10) {
      toast.error("Mandatory justification must be at least 10 characters for compliance audit trail");
      return;
    }

    const idempotencyKey = `reconcile_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setIsSubmitting(true);
    try {
      await adminFinanceService.postReconciliationCorrection(
        {
          vendorId: adjustForm.vendorId.trim(),
          amount: amt,
          direction: adjustForm.direction,
          accountCode: adjustForm.accountCode,
          contraAccountCode: adjustForm.contraAccountCode,
          reason: adjustForm.reason.trim(),
          currency: "INR",
        },
        {
          "Idempotency-Key": idempotencyKey,
        }
      );

      toast.success("Balanced financial correction posted successfully");
      setAdjustModalOpen(false);
      loadSummary();
    } catch (err) {
      toast.error("Correction failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = summary?.currency || "INR";
  const discrepancies = summary?.discrepantWallets || [];
  const isHealthy = summary?.overallHealth === "HEALTHY" && discrepancies.length === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Financial Reconciliation & Integrity Console
            </h1>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isHealthy
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            }`}>
              {isHealthy ? "100% Balanced" : `${discrepancies.length} Discrepant Wallets`}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Continuous double-entry ledger verification, clearing account balances, and balanced administrative corrections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadSummary}
            disabled={isLoading}
            className="p-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
            title="Refresh Reconciliation"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => handleOpenAdjust()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Post Balanced Correction
          </button>
        </div>
      </div>

      {/* Aggregate Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Wallets Audited
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {isLoading ? "..." : summary?.totalWalletsAudited || 0}
          </div>
          <p className="text-xs text-gray-400 mt-1">Active registered merchant accounts</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Discrepant Wallets
          </span>
          <div className={`text-2xl font-bold mt-1 ${isHealthy ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {isLoading ? "..." : discrepancies.length}
          </div>
          <p className="text-xs text-gray-400 mt-1">Requiring ledger adjustment or sync</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Platform Clearing Balance
          </span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {isLoading ? "..." : formatCurrency(summary?.clearingBalance, currency)}
          </div>
          <p className="text-xs text-gray-400 mt-1">Account 1200 - Clearing & In-Transit</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Unallocated Variance
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {isLoading ? "..." : formatCurrency(summary?.unallocatedVariance || 0, currency)}
          </div>
          <p className="text-xs text-gray-400 mt-1">General ledger debits equal credits</p>
        </div>
      </div>

      {/* Discrepant Accounts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${isHealthy ? "text-emerald-600" : "text-rose-600"}`} />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              Wallet-to-Ledger Integrity Audit
            </h3>
          </div>
          <span className="text-xs text-gray-400">
            Audit Date: {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString() : new Date().toLocaleString()}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm">Auditing vendor wallets against general ledger...</span>
          </div>
        ) : isHealthy ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
            <h4 className="font-bold text-gray-900 dark:text-white text-base">All Vendor Wallets Balanced</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
              Every vendor wallet projection matches authoritative double-entry general ledger journals exactly. Zero unallocated variance detected.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Wallet Balance</th>
                  <th className="px-5 py-3.5">Ledger Computed Balance</th>
                  <th className="px-5 py-3.5">Discrepancy (Variance)</th>
                  <th className="px-5 py-3.5 text-right">Correction Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {discrepancies.map((d) => (
                  <tr key={d.vendorId} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/20">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {d.vendorName || "Vendor"}
                      </div>
                      <div className="text-xs font-mono text-gray-500">{d.vendorId}</div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {formatCurrency(d.walletBalance, currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                      {formatCurrency(d.ledgerBalance, currency)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded text-xs">
                        {formatCurrency(d.variance, currency)}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right space-x-2">
                      <Link
                        href={`/administrator/finance/wallets/${d.vendorId}`}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition"
                      >
                        Drill-Down
                      </Link>
                      <button
                        onClick={() => handleOpenAdjust(d.vendorId)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition"
                      >
                        Correct Balance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Balanced Correction Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 dark:text-white">Post Balanced Financial Correction</h3>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Double-Entry Guarantees Enforced:
              </div>
              <p>
                Every correction journal automatically posts two balanced entries (`DEBIT = CREDIT`). The vendor wallet balance is updated atomically, and an immutable audit log record is preserved.
              </p>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor ObjectId *</label>
                <input
                  type="text"
                  required
                  placeholder="24-char hex Vendor ID"
                  value={adjustForm.vendorId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, vendorId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Adjustment Amount (INR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="e.g. 150.00"
                    value={adjustForm.amount}
                    onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor Balance Effect *</label>
                  <select
                    value={adjustForm.direction}
                    onChange={(e) => setAdjustForm({ ...adjustForm, direction: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold"
                  >
                    <option value="CREDIT">CREDIT (Increase Vendor Balance)</option>
                    <option value="DEBIT">DEBIT (Decrease Vendor Balance)</option>
                  </select>
                </div>
              </div>

              {/* Journal Preview */}
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] space-y-1">
                <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Journal Preview (Debit = Credit):
                </span>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Entry 1: Account {adjustForm.accountCode} (Vendor Payable)</span>
                  <span className="font-bold font-mono">{adjustForm.direction}: ₹{adjustForm.amount || "0.00"}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Entry 2: Account {adjustForm.contraAccountCode} (Platform Clearing)</span>
                  <span className="font-bold font-mono">{adjustForm.direction === "CREDIT" ? "DEBIT" : "CREDIT"}: ₹{adjustForm.amount || "0.00"}</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mandatory Justification (Audit Trail, min 10 chars) *
                </label>
                <textarea
                  rows="3"
                  required
                  minLength={10}
                  placeholder="Detailed justification for manual balance reconciliation..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Post Balanced Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

