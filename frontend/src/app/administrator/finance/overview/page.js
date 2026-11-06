"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Wallet,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Percent,
  Calendar,
  Layers,
  Building2,
  Landmark,
  CreditCard,
  FileSpreadsheet,
  ShieldCheck,
  FileText,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminFinancialOverviewPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [datePreset, setDatePreset] = useState("all_time");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const formatCurrency = (val, currency = "INR") => {
    if (val === undefined || val === null || val === "" || isNaN(Number(val))) {
      return "——";
    }
    const num = Number(val);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const calculateDateRange = (preset) => {
    const now = new Date();
    if (preset === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start: today.toISOString(), end: now.toISOString() };
    }
    if (preset === "last_7_days") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: past7.toISOString(), end: now.toISOString() };
    }
    if (preset === "last_30_days") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: past30.toISOString(), end: now.toISOString() };
    }
    if (preset === "this_month") {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: firstOfMonth.toISOString(), end: now.toISOString() };
    }
    return { start: undefined, end: undefined };
  };

  const loadOverview = async (preset = datePreset, customStart = startDate, customEnd = endDate) => {
    setIsLoading(true);
    setError(null);
    try {
      let params = { currency: "INR" };
      if (preset === "custom") {
        if (customStart) params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      } else {
        const { start, end } = calculateDateRange(preset);
        if (start) params.startDate = start;
        if (end) params.endDate = end;
      }

      const res = await adminFinanceService.getFinancialOverview(params);
      setData(res?.data || res);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to load financial overview";
      setError(errMsg);
      toast.error("Failed to load financial overview", {
        description: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview(datePreset);
  }, [datePreset]);

  const handleCustomFilterSubmit = (e) => {
    e.preventDefault();
    if (!startDate && !endDate) {
      toast.error("Please select a start or end date");
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Invalid Date Range", {
        description: "Start date cannot be greater than end date.",
      });
      return;
    }
    setDatePreset("custom");
    loadOverview("custom", startDate, endDate);
  };

  const currency = data?.currency || "INR";
  const sales = data?.salesAndRevenue || {};
  const commission = data?.platformCommission || {};
  const vendor = data?.vendorLiabilities || {};
  const disbursements = data?.cashDisbursements || {};
  const queues = data?.operationalQueues || {};
  const reconciliation = data?.reconciliationHealth || {};
  const flatMetrics = data?.metrics || {};

  // Dual-contract field resolutions with defensive fallbacks
  const grossOrderValue = sales.grossOrderValue ?? flatMetrics.grossOrderValue;
  const capturedPaymentValue = sales.capturedPaymentValue ?? flatMetrics.capturedPaymentValue;
  const grossCommission = commission.grossCommission ?? commission.grossCommissionEarned ?? flatMetrics.platformCommissionEarned;
  const commissionReversals = commission.commissionReversals ?? flatMetrics.commissionReversals;
  const netCommission = commission.netCommission ?? flatMetrics.netPlatformCommission;

  const totalLiabilities = vendor.totalLiability ?? vendor.totalLiabilities ?? flatMetrics.vendorTotalLiabilities;
  const availableBalance = vendor.availableEarnings ?? vendor.availableBalance ?? flatMetrics.vendorAvailableBalance;
  const reservedBalance = vendor.reservedPayouts ?? vendor.reservedBalance ?? flatMetrics.vendorReservedBalance;
  const pendingBalance = vendor.pendingEarnings ?? vendor.pendingSettlementBalance ?? flatMetrics.vendorPendingBalance;
  const lifetimeEarned = vendor.totalGrossEarned ?? vendor.lifetimeGrossEarned ?? flatMetrics.vendorLifetimeEarned;

  const totalOutflows = disbursements.netCashOutflow ?? disbursements.totalCashOutflows ?? flatMetrics.totalCashOutflows;
  const totalPaidOut = disbursements.totalPaidOut ?? disbursements.totalDisbursements ?? flatMetrics.totalDisbursements;
  const totalRefunded = disbursements.totalRefunded ?? disbursements.totalCustomerRefunds ?? flatMetrics.totalCustomerRefunds;

  const withdrawalsPendingReview = queues.pendingReviewCount ?? queues.withdrawalsPendingReview ?? 0;
  const withdrawalsProcessing = queues.processingCount ?? queues.withdrawalsProcessing ?? 0;
  const withdrawalsFailed = queues.failedCount ?? queues.withdrawalsFailed ?? 0;
  const ambiguousTransfers = queues.ambiguousCount ?? queues.ambiguousTransfers ?? queues.staleOrAmbiguousCount ?? 0;

  // Authoritative reconciliation and operational trial balance derivation
  const operationalTrialBalance = data?.operationalTrialBalance || reconciliation?.operationalTrialBalance || {};
  const legacyExceptions = data?.legacyExceptions || { count: 0, totalAmount: 0, items: [] };

  const auditedWallets = reconciliation.totalWalletsAudited ?? reconciliation.totalWallets ?? 0;
  const discrepantWallets = reconciliation.discrepantWalletsCount ?? reconciliation.discrepancyWallets ?? 0;
  const clearingBalance = reconciliation.clearingBalance;
  const unallocatedVariance = reconciliation.unallocatedVariance ?? 0;

  const operationalDebits = operationalTrialBalance.totalDebits;
  const operationalCredits = operationalTrialBalance.totalCredits;
  const operationalVariance = operationalTrialBalance.unallocatedVariance ?? 0;
  const isOperationalBalanced = Boolean(operationalTrialBalance.isBalanced ?? (operationalVariance < 0.01));
  const hasVariance = Number(operationalVariance || 0) > 0.009;

  const getReconBadge = () => {
    if (reconciliation.hasError) {
      return {
        badgeClass: "text-rose-400 bg-rose-950/60 border border-rose-800",
        label: "Reconciliation Error",
        subtext: reconciliation.errorMessage || "Failed to verify ledger integrity",
      };
    }
    if (reconciliation.status === "empty" || (auditedWallets === 0 && operationalTrialBalance.includedEntriesCount === 0)) {
      return {
        badgeClass: "text-blue-300 bg-blue-950/60 border border-blue-800",
        label: "No Records Available",
        subtext: "0 active vendor wallets and operational journals to reconcile",
      };
    }
    if (reconciliation.status === "discrepancies_found" || discrepantWallets > 0) {
      return {
        badgeClass: "text-amber-400 bg-amber-950/60 border border-amber-800",
        label: `${discrepantWallets} Discrepanc${discrepantWallets === 1 ? "y" : "ies"} Detected`,
        subtext: "Wallet projections diverge from authoritative ledger entries",
      };
    }
    if (!isOperationalBalanced) {
      return {
        badgeClass: "text-rose-400 bg-rose-950/60 border border-rose-800",
        label: "Operational GL Unbalanced",
        subtext: `Debits vs credits variance of ${formatCurrency(operationalVariance, currency)}`,
      };
    }
    if (reconciliation.status === "passed_with_legacy_exceptions" || (legacyExceptions.count > 0 && isOperationalBalanced)) {
      return {
        badgeClass: "text-indigo-300 bg-indigo-950/70 border border-indigo-700",
        label: "Balanced with Legacy Exceptions",
        subtext: `Operational journals 100% balanced; ${legacyExceptions.count} pre-engine test exception disclosed`,
      };
    }
    if (reconciliation.status === "passed" || (auditedWallets > 0 && discrepantWallets === 0 && isOperationalBalanced && legacyExceptions.count === 0)) {
      return {
        badgeClass: "text-emerald-400 bg-emerald-950/60 border border-emerald-800",
        label: "100% Balanced & Reconciled",
        subtext: `${auditedWallets} wallet(s) strictly match General Ledger journals`,
      };
    }
    return {
      badgeClass: "text-gray-400 bg-gray-900 border border-gray-700",
      label: "Reconciliation Status Unknown",
      subtext: "Run reconciliation to evaluate ledger integrity",
    };
  };

  const reconBadge = getReconBadge();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Superadmin Financial Overview
            </h1>
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {currency} Authority
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Server-authoritative platform liquidity, vendor liabilities, marketplace commission earnings, and reconciliation integrity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadOverview(datePreset, startDate, endDate)}
            disabled={isLoading}
            className="p-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Refresh Financial Overview"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/administrator/finance/commission-policies"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <Percent className="w-4 h-4 text-emerald-600" />
            Policies
          </Link>

          <Link
            href="/administrator/finance/wallets"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm"
          >
            <Wallet className="w-4 h-4 text-blue-600" />
            Wallets
          </Link>

          <Link
            href="/administrator/finance/reconciliation"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          >
            <Scale className="w-4 h-4" />
            Reconciliation
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-center justify-between text-rose-700 dark:text-rose-300 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <div className="font-semibold text-sm">Failed to retrieve financial metrics</div>
              <div className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{error}</div>
            </div>
          </div>
          <button
            onClick={() => loadOverview(datePreset, startDate, endDate)}
            className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all_time", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "last_7_days", label: "Last 7 Days" },
            { id: "last_30_days", label: "Last 30 Days" },
            { id: "this_month", label: "This Month" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDatePreset(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                datePreset === tab.id
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCustomFilterSubmit} className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 transition"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Top Marketplace Inflows & Outflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Gross Order Value */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Gross Order Value (GOV)
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? "..." : formatCurrency(grossOrderValue, currency)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Captured: <span className="font-medium text-emerald-600">{formatCurrency(capturedPaymentValue, currency)}</span>
            </p>
          </div>
        </div>

        {/* Platform Commission Earned */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Platform Commission
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {isLoading ? "..." : formatCurrency(grossCommission, currency)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Reversals: <span className="font-medium text-rose-500">{formatCurrency(commissionReversals, currency)}</span>
            </p>
          </div>
        </div>

        {/* Total Vendor Liabilities */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Vendor Liabilities
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? "..." : formatCurrency(totalLiabilities, currency)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Available: <span className="font-medium text-blue-600">{formatCurrency(availableBalance, currency)}</span> | Reserved: {formatCurrency(reservedBalance, currency)}
            </p>
          </div>
        </div>

        {/* Total Cash Outflows */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Cash Outflows
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-purple-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? "..." : formatCurrency(totalOutflows, currency)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Payouts: {formatCurrency(totalPaidOut, currency)} | Refunds: {formatCurrency(totalRefunded, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown Rows: Platform Commission Economics & Vendor Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marketplace Commission Economics */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Commission Economics
              </h3>
            </div>
            <Link
              href="/administrator/finance/commission-policies"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
            >
              Policies <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Gross Commission Earned:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(grossCommission, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Commission Reversals (Refunds):</span>
              <span className="font-semibold text-rose-600">
                - {formatCurrency(commissionReversals, currency)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Net Platform Commission:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                {formatCurrency(netCommission, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor Wallet Balances Breakdown */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Vendor Wallet Liability
              </h3>
            </div>
            <Link
              href="/administrator/finance/wallets"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Available for Payout:</span>
              <span className="font-semibold text-emerald-600">
                {formatCurrency(availableBalance, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Reserved in Withdrawals:</span>
              <span className="font-semibold text-amber-600">
                {formatCurrency(reservedBalance, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Pending Settlement:</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {formatCurrency(pendingBalance, currency)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900 dark:text-white">Lifetime Vendor Earnings:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                {formatCurrency(lifetimeEarned, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Queues & Exceptions */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Operational Queues
              </h3>
            </div>
            <Link
              href="/administrator/finance/withdrawals"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
            >
              Queue <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Withdrawals in Review:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                withdrawalsPendingReview > 0
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}>
                {withdrawalsPendingReview}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Processing Disbursements:</span>
              <span className="font-semibold text-blue-600">
                {withdrawalsProcessing}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Failed Payouts:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                withdrawalsFailed > 0
                  ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}>
                {withdrawalsFailed}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Ambiguous / Stale Transfers:</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {ambiguousTransfers}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Reconciliation Health Banner */}
      <div className="bg-gradient-to-r from-gray-900 to-indigo-950 text-white rounded-xl p-6 shadow-md border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold">Platform Financial Integrity & Double-Entry Health</h3>
            </div>
            <p className="text-xs text-gray-300">
              Continuous reconciliation guarantees that General Ledger debits match credits and all vendor wallet projections match authoritative posted journals.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Health Status</div>
              <div className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold mt-1 ${reconBadge.badgeClass}`}>
                {reconBadge.label}
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">{reconBadge.subtext}</div>
            </div>

            <Link
              href="/administrator/finance/reconciliation"
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition shadow flex items-center gap-1.5 flex-shrink-0"
            >
              Reconciliation Console <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-800">
          <div>
            <div className="text-xs text-gray-400">Wallets Audited</div>
            <div className="text-lg font-semibold text-white mt-0.5">
              {isLoading ? "..." : auditedWallets}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {discrepantWallets === 0 ? "0 discrepancies" : `${discrepantWallets} discrepant`}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Operational GL State</div>
            <div className={`text-lg font-semibold mt-0.5 ${isOperationalBalanced ? "text-emerald-400" : "text-rose-400"}`}>
              {isLoading ? "..." : isOperationalBalanced ? "100% Balanced" : "Unbalanced"}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Variance: {formatCurrency(operationalVariance, currency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Operational Clearing</div>
            <div className="text-lg font-semibold text-white mt-0.5">
              {isLoading ? "..." : formatCurrency(clearingBalance, currency)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Escrow Liability
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Legacy Exceptions</div>
            <div className={`text-lg font-semibold mt-0.5 ${legacyExceptions.count > 0 ? "text-indigo-300" : "text-emerald-400"}`}>
              {isLoading ? "..." : `${legacyExceptions.count} Item${legacyExceptions.count === 1 ? "" : "s"}`}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              {legacyExceptions.count > 0 ? formatCurrency(legacyExceptions.totalAmount, currency) : "None"} (Audited)
            </div>
          </div>
        </div>
      </div>

      {/* Dual-Tier Reconciliation & Legacy Ledger Exception Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier 1: Operational Commerce Journals (Scope B) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Tier 1: Operational Commerce Journals (Scope B)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Authoritative posted double-entry journals for live marketplace transactions
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isOperationalBalanced
                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
            }`}>
              {isOperationalBalanced ? "100% Balanced" : "Variance Detected"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Operational Debits</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(operationalDebits, currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Operational Credits</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(operationalCredits, currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Unallocated Variance</div>
              <div className={`text-sm font-bold mt-1 ${operationalVariance > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                {formatCurrency(operationalVariance, currency)}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Audited Entries Count:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {operationalTrialBalance.includedEntriesCount ?? "——"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Accounting Equilibrium:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Debits = Credits (ΣD - ΣC = ₹0.00)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Excluded Legacy Exceptions:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {operationalTrialBalance.excludedExceptionEntriesCount ?? 0} entry
              </span>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
            <strong>Audit Confirmation:</strong> Modern commerce transactions strictly follow double-entry principles where every financial event creates equal debits and credits across platform escrow, vendor pending earnings, and platform commission.
          </p>
        </div>

        {/* Tier 2: Historical Legacy Ledger Exception Governance (Scope A - Scope B) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-indigo-200 dark:border-indigo-900/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Tier 2: Legacy Exception Governance (Scope A - Scope B)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pre-engine test artifacts & unclassified historical entries preserved unmutated
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
              {legacyExceptions.count} Exception Disclosed
            </span>
          </div>

          {legacyExceptions.count > 0 ? (
            <div className="space-y-3">
              {legacyExceptions.items.map((exc) => (
                <div
                  key={exc.id || exc.ledgerEntryId}
                  className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between font-mono font-medium">
                    <span className="text-indigo-900 dark:text-indigo-200 truncate max-w-[200px]" title={exc.journalId}>
                      {exc.journalId}
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {exc.direction?.toUpperCase()} {formatCurrency(exc.amount, exc.currency || currency)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300 pt-1 border-t border-indigo-100/60 dark:border-indigo-900/30">
                    <div>
                      <span className="text-gray-400">Entry ID:</span>{" "}
                      <span className="font-mono text-gray-700 dark:text-gray-300">{String(exc.ledgerEntryId).slice(-12)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Category:</span>{" "}
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">PRE_DOUBLE_ENTRY_TEST</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">Disposition:</span>{" "}
                      <span>{exc.reason || "Manual test artifact created before double-entry engine git commit ce2067b."}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                      Preserved Unmutated (Audit Trail)
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                      {exc.evidenceReportReference}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
              No historical ledger exceptions recorded.
            </div>
          )}

          <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800">
            <strong>Accounting Governance Rule:</strong> Historical test records must not be retroactively deleted or balanced with artificial offset entries ($d=c$). Instead, they are explicitly categorized, audited, and isolated from live operational settlement scope.
          </p>
        </div>
      </div>
    </div>
  );
}

