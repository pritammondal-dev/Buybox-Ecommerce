"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Landmark,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Package,
  Layers,
  HelpCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorFinancePage() {
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [clearanceData, setClearanceData] = useState({ summary: {}, items: [] });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [activeBankAccount, setActiveBankAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const loadFinanceData = useCallback(async (showToast = false) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [settlementsRes, summaryRes, clearanceRes, bankRes] = await Promise.allSettled([
        vendorService.getMySettlements(),
        vendorService.getFinanceSummary(),
        vendorService.getMyClearanceTimeline(),
        vendorService.getMyBankAccounts(),
      ]);

      if (settlementsRes.status === "fulfilled") {
        const data =
          settlementsRes.value?.data?.data ||
          settlementsRes.value?.data?.settlements ||
          settlementsRes.value?.data ||
          [];
        const items = Array.isArray(data) ? data : data.items || [];
        setSettlements(items);
      }

      if (summaryRes.status === "fulfilled") {
        const sumData = summaryRes.value?.data?.data || summaryRes.value?.data || null;
        setSummary(sumData);
      } else {
        setApiError(summaryRes.reason?.message || "Failed to load financial summary");
      }

      if (clearanceRes.status === "fulfilled") {
        const clrData =
          clearanceRes.value?.data?.data ||
          clearanceRes.value?.data ||
          { summary: {}, items: [] };
        setClearanceData(clrData);
      }

      if (bankRes.status === "fulfilled") {
        const bankData =
          bankRes.value?.data?.data?.accounts ||
          bankRes.value?.data?.accounts ||
          (Array.isArray(bankRes.value?.data) ? bankRes.value?.data : []);
        const list = Array.isArray(bankData) ? bankData : [];
        setBankAccounts(list);
        setActiveBankAccount(list.find((a) => a.isActive) || null);
      }

      if (showToast) {
        toast.success("Financial metrics updated successfully");
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || err?.message || "Error loading finance data");
      if (err.status !== 403 && err.status !== 404 && err.response?.status !== 403 && err.response?.status !== 404) {
        toast.error("Failed to load financial overview", {
          description: err.response?.data?.message || err.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleRefresh = () => {
    loadFinanceData(true);
  };

  // Authoritative metrics derived from live backend services
  const wallet = summary?.wallet;

  // 1. Gross Vendor Earnings (totalEarned + totalCommission or computed from order items)
  const grossVendorEarnings = useMemo(() => {
    if (wallet?.totalEarned != null && wallet?.totalCommission != null) {
      return Number(wallet.totalEarned) + Number(wallet.totalCommission);
    }
    return 0;
  }, [wallet]);

  // 2. Platform Commission
  const platformCommission = useMemo(() => {
    return Number(wallet?.totalCommission || 0);
  }, [wallet]);

  // 3. Vendor Pending Clearing (funds held in escrow or transit)
  const pendingClearing = useMemo(() => {
    return Number(wallet?.pendingBalance || 0);
  }, [wallet]);

  // 4. Eligible for Next Settlement (past return window, ready for statement generation)
  const eligibleForSettlement = useMemo(() => {
    return Number(summary?.eligibleForSettlement || 0);
  }, [summary]);

  // 5. Generated Settlement Statement Amount
  const generatedStatementAmount = useMemo(() => {
    return settlements.reduce((sum, s) => sum + Number(s.netPayable || 0), 0);
  }, [settlements]);

  // 6. Pending Payout Amount (statements generated, awaiting disbursement)
  const pendingPayoutAmount = useMemo(() => {
    return Number(
      summary?.pendingSettlement ||
        settlements.filter((s) => s.status !== "paid").reduce((sum, s) => sum + Number(s.netPayable || 0), 0)
    );
  }, [summary, settlements]);

  // 7. Successfully Disbursed Amount
  const disbursedAmount = useMemo(() => {
    return Number(
      summary?.totalEarnings ||
        settlements.filter((s) => s.status === "paid").reduce((sum, s) => sum + Number(s.netPayable || 0), 0)
    );
  }, [summary, settlements]);

  // 8. Available Wallet Balance (available for withdrawal request)
  const availableWalletBalance = useMemo(() => {
    return Number(wallet?.availableBalance || 0);
  }, [wallet]);

  // 9. Reserved Wallet Balance (locked in active withdrawal requests)
  const reservedWalletBalance = useMemo(() => {
    return Number(wallet?.reservedBalance || 0);
  }, [wallet]);

  // Timeline items
  const timelineItems = clearanceData.items || [];
  const awaitingDeliveryItems = timelineItems.filter((i) => i.status === "awaiting_delivery");
  const returnWindowActiveItems = timelineItems.filter((i) => i.status === "return_window_active");
  const maturedItems = timelineItems.filter((i) => i.status === "matured");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Settlements & Finance
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Authoritative marketplace financial ledgers, return-window escrow maturity, and payout logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Overview</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-xs">
            <p className="font-bold">Financial telemetry notice</p>
            <p className="text-amber-700">{apiError}</p>
          </div>
        </div>
      )}

      {/* Active Payout Account Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${
              activeBankAccount
                ? "bg-emerald-100/80 text-emerald-800"
                : "bg-amber-100/80 text-amber-800"
            }`}
          >
            <Landmark className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Primary Settlement Account
              </span>
              {activeBankAccount ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Active Destination
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="size-3 text-amber-600" /> Not Configured
                </span>
              )}
            </div>
            {activeBankAccount ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base font-black text-slate-900">
                  {activeBankAccount.bankName}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  {activeBankAccount.accountNumberMasked || "••••••••••••••••"}
                </span>
                <span className="text-xs text-slate-300">•</span>
                <span className="text-xs font-mono font-semibold text-slate-500 uppercase">
                  IFSC: {activeBankAccount.ifscCode}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-medium">
                No active payout destination is set. Register an approved bank account to receive automated settlement disbursements.
              </p>
            )}
          </div>
        </div>

        <Link
          href="/vendor/finance/bank-accounts"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors shrink-0 shadow-xs w-full sm:w-auto justify-center"
        >
          <span>Manage Bank Accounts ({bankAccounts.length}/3)</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* 9 Authoritative Financial Metric KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Authoritative Ledger Financial Overview
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">Double-Entry Synchronized</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Gross Vendor Earnings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Gross Sales Volume</span>
              <TrendingUp className="size-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              ₹{grossVendorEarnings.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total orders subtotal fulfilled</p>
          </div>

          {/* Card 2: Platform Commission */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Platform Commission</span>
              <Layers className="size-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-600">
              -₹{platformCommission.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Marketplace commission (12% policy)</p>
          </div>

          {/* Card 3: Vendor Pending Clearing */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs ring-1 ring-amber-500/20 bg-amber-50/20">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Clearing</span>
              <Clock className="size-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              ₹{pendingClearing.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-amber-700/80 mt-1">Held in return-window escrow or transit</p>
          </div>

          {/* Card 4: Eligible for Next Settlement */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Eligible for Settlement</span>
              <CheckCircle2 className="size-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600">
              ₹{eligibleForSettlement.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Matured orders ready for statement</p>
          </div>

          {/* Card 5: Generated Settlement Statements */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Generated Statements</span>
              <FileText className="size-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              ₹{generatedStatementAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{settlements.length} billing cycles compiled</p>
          </div>

          {/* Card 6: Pending Payout Amount */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Payout</span>
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600">
              ₹{pendingPayoutAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Statements queued for bank transfer</p>
          </div>

          {/* Card 7: Successfully Disbursed Amount */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Total Disbursed</span>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700">
              ₹{disbursedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Successfully transferred to bank</p>
          </div>

          {/* Card 8: Available Wallet Balance */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Available Wallet Balance</span>
              <Wallet className="size-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">
              ₹{availableWalletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Matured funds available for withdrawal</p>
          </div>

          {/* Card 9: Reserved in Active Withdrawals */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Reserved in Payouts</span>
              <ShieldCheck className="size-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-700">
              ₹{reservedWalletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Locked in pending payout requests</p>
          </div>
        </div>
      </div>

      {/* Return-Window Maturity & Escrow Telemetry Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/40 via-white to-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-900">
                Return-Window Maturity & Escrow Timeline
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks delivered customer orders through the 7-day return policy before releasing funds into available earnings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">
              In Escrow: <strong className="text-slate-900 font-bold">₹{pendingClearing.toFixed(2)}</strong>
            </span>
            <Link
              href="/vendor/finance/wallet"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#004D38] hover:bg-[#003828] text-white transition-colors shadow-xs"
            >
              <span>Wallet & Clearance Details</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="size-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700">No Pending Escrow Items</h4>
            <p className="text-xs text-slate-400 mt-0.5">All customer orders have completed return cycles.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {timelineItems.map((item) => {
              const isDelivered = item.isDelivered;
              const returnExpires = item.returnWindowExpiresAt ? new Date(item.returnWindowExpiresAt) : null;
              const deliveredAt = item.deliveredAt ? new Date(item.deliveredAt) : null;

              return (
                <div key={item.itemId} className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          item.status === "return_window_active"
                            ? "bg-amber-100 text-amber-800"
                            : item.status === "matured"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.status === "return_window_active" ? (
                          <Clock className="size-5" />
                        ) : item.status === "matured" ? (
                          <CheckCircle2 className="size-5" />
                        ) : (
                          <Package className="size-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Link
                            href={`/vendor/orders/${item.orderId}`}
                            className="text-xs font-mono font-black text-[#004D38] hover:underline"
                          >
                            {item.orderNumber}
                          </Link>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              item.status === "return_window_active"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : item.status === "matured"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {item.statusLabel || item.status}
                          </span>
                          <span className="text-[11px] text-slate-400">• Qty: {item.quantity}</span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{item.productName}</h4>

                        {/* Delivery & Maturity Telemetry */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1">
                          {isDelivered && deliveredAt ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                Delivered: {deliveredAt.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} at {deliveredAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                                <Calendar className="size-3 text-amber-600" />
                                Return Window: {item.returnWindowDays || 7} days (Matures {returnExpires ? returnExpires.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "N/A"})
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <Clock className="size-3 text-blue-500" />
                              Order in transit. 7-day buyer return clock starts upon delivery confirmation.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full lg:w-auto lg:justify-end gap-6 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="text-left lg:text-right">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Net Vendor Entitlement
                        </div>
                        <div className="text-base font-black text-slate-900">
                          ₹{Number(item.netEarnings || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold ${
                            item.status === "matured"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "return_window_active"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.status === "matured" ? "Ready" : item.status === "return_window_active" ? "In Escrow" : "Ineligible"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Settlement Statements</h3>
            <p className="text-xs text-slate-500">Bi-weekly billing cycle statements with automatic net payouts</p>
          </div>
          <Link
            href="/vendor/finance/statements"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004D38] hover:text-[#003828] hover:underline"
          >
            <span>View All Statements</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : settlements.length === 0 ? (
          <div className="p-16 text-center">
            <Wallet className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Statements Generated Yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Statements are automatically compiled at the close of each marketplace settlement window for matured orders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Statement #</th>
                  <th className="px-6 py-3.5">Period</th>
                  <th className="px-6 py-3.5 text-right">Gross Sales</th>
                  <th className="px-6 py-3.5 text-right">Fee / Commission</th>
                  <th className="px-6 py-3.5 text-right">Net Payout</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/vendor/finance/settlements/${s.secureId || s._id}`}
                        className="font-mono font-bold text-[#004D38] hover:underline"
                      >
                        {s.settlementNumber || s.secureId}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {s.periodStart ? new Date(s.periodStart).toLocaleDateString("en-IN") : "Start"} —{" "}
                      {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString("en-IN") : "End"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">
                      ₹{Number(s.grossSales || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-rose-600 font-medium">
                      -₹{Number(s.platformCommission || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₹{Number(s.netPayable || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : s.status === "processing"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
