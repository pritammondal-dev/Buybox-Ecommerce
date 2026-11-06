"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Wallet,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Landmark,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileText,
  DollarSign,
  Info,
  Loader2,
  ChevronRight,
  ExternalLink,
  Package,
  Truck,
  Calendar,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorWalletPage() {
  const [wallet, setWallet] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [clearanceData, setClearanceData] = useState({ summary: {}, items: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("clearance"); // "clearance" | "withdrawals" | "transactions"

  // Withdrawal modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState(null);

  // Status and pagination
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const [walletRes, bankRes, wthRes, txRes, clrRes] = await Promise.allSettled([
        vendorService.getMyWallet(),
        vendorService.getMyBankAccounts(),
        vendorService.getMyWithdrawals(),
        vendorService.getMyWalletTransactions({ limit: 50 }),
        vendorService.getMyClearanceTimeline(),
      ]);

      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value?.data?.data || walletRes.value?.data);
      }

      if (bankRes.status === "fulfilled") {
        const bankData =
          bankRes.value?.data?.data?.accounts ||
          bankRes.value?.data?.accounts ||
          (Array.isArray(bankRes.value?.data) ? bankRes.value?.data : []);
        setBankAccounts(Array.isArray(bankData) ? bankData : []);
      }

      if (wthRes.status === "fulfilled") {
        const wthData =
          wthRes.value?.data?.data ||
          wthRes.value?.data?.items ||
          (Array.isArray(wthRes.value?.data) ? wthRes.value?.data : []);
        setWithdrawals(Array.isArray(wthData) ? wthData : []);
      }

      if (txRes.status === "fulfilled") {
        const txData =
          txRes.value?.data?.data ||
          txRes.value?.data?.items ||
          (Array.isArray(txRes.value?.data) ? txRes.value?.data : []);
        setTransactions(Array.isArray(txData) ? txData : []);
      }

      if (clrRes.status === "fulfilled") {
        const clrData =
          clrRes.value?.data?.data ||
          clrRes.value?.data ||
          { summary: {}, items: [] };
        setClearanceData(clrData);
      }

      if (showToast) {
        toast.success("Wallet data refreshed");
      }
    } catch (err) {
      toast.error("Failed to load wallet data", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived approved bank accounts
  const approvedBanks = useMemo(() => {
    return bankAccounts.filter((b) => b.status === "approved" && !b.isArchived);
  }, [bankAccounts]);

  const activeBank = useMemo(() => {
    return approvedBanks.find((b) => b.isActive) || approvedBanks[0] || null;
  }, [approvedBanks]);

  // Set default bank in modal
  useEffect(() => {
    if (activeBank && !selectedBankId) {
      setSelectedBankId(activeBank._id || activeBank.id);
    }
  }, [activeBank, selectedBankId]);

  // Formatting helpers
  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "₹0.00";
    const num = Number(val?.toString?.() || val);
    return isNaN(num) ? "₹0.00" : `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const availableBalance = Number(wallet?.availableBalance?.toString?.() || wallet?.availableBalance || 0);
  const reservedBalance = Number(wallet?.reservedBalance?.toString?.() || wallet?.reservedBalance || 0);
  const pendingBalance = Number(wallet?.pendingBalance?.toString?.() || wallet?.pendingBalance || 0);
  const totalEarned = Number(wallet?.totalEarned?.toString?.() || wallet?.totalEarned || 0);
  const totalPaidOut = Number(wallet?.totalPaidOut?.toString?.() || wallet?.totalPaidOut || 0);
  const totalCommission = Number(wallet?.totalCommission?.toString?.() || wallet?.totalCommission || 0);
  const totalRefunded = Number(wallet?.totalRefunded?.toString?.() || wallet?.totalRefunded || 0);

  // Submit withdrawal request
  const handleWithdrawalSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive withdrawal amount");
      return;
    }

    if (amountNum > availableBalance) {
      toast.error("Amount exceeds available balance", {
        description: `Your available balance is ${formatCurrency(availableBalance)}`,
      });
      return;
    }

    if (!selectedBankId) {
      toast.error("Please select an approved bank account destination");
      return;
    }

    setIsSubmitting(true);
    const idempotencyKey = `wth_vendor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      await vendorService.submitWithdrawalRequest(
        {
          amount: amountNum,
          bankAccountId: selectedBankId,
          notes: withdrawalNotes.trim() || undefined,
        },
        idempotencyKey
      );

      toast.success("Withdrawal request submitted successfully", {
        description: `${formatCurrency(amountNum)} has been reserved and queued for administrative approval.`,
      });

      setIsModalOpen(false);
      setWithdrawAmount("");
      setWithdrawalNotes("");
      await loadData();
    } catch (err) {
      toast.error("Withdrawal request failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter withdrawals
  const filteredWithdrawals = useMemo(() => {
    if (statusFilter === "all") return withdrawals;
    return withdrawals.filter((w) => w.status === statusFilter);
  }, [withdrawals, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing Payout
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#001D15] text-slate-100 p-6 md:p-8 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#003828] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/vendor/dashboard" className="hover:text-emerald-400">Dashboard</Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/vendor/finance" className="hover:text-emerald-400">Finance</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-emerald-400 font-semibold">Wallet & Withdrawals</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-400" />
            Vendor Wallet & Payouts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative double-entry ledger balance, atomic fund reservations, and bank disbursements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#002B1F] border border-[#004D38] hover:border-emerald-500/50 text-slate-300 hover:text-white text-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            disabled={availableBalance <= 0 || approvedBanks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Request Withdrawal
          </button>
        </div>
      </div>

      {/* Warning Banner if No Approved Bank Account */}
      {approvedBanks.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-300">No Approved Bank Account Destination</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                You must have at least one verified, approved bank account on file to request fund withdrawals.
              </p>
            </div>
          </div>
          <Link
            href="/vendor/finance/bank-accounts"
            className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold shrink-0 transition"
          >
            Manage Bank Accounts &rarr;
          </Link>
        </div>
      )}

      {/* Primary KPI Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Available Balance Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#002C20] to-[#001D15] border border-emerald-500/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
            <Wallet className="w-24 h-24 text-emerald-400" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Available For Withdrawal
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Instant Reserve
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatCurrency(availableBalance)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Matured order earnings eligible for payout disbursement to your approved bank.
          </p>
        </div>

        {/* Reserved For Payout Card */}
        <div className="p-6 rounded-2xl bg-[#00261C] border border-[#004532] shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Reserved in Payouts
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Locked in Escrow
            </span>
          </div>
          <div className="text-3xl font-extrabold text-amber-300 tracking-tight">
            {formatCurrency(reservedBalance)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Withdrawal requests currently under administrative review or banking transmission.
          </p>
        </div>

        {/* Pending Clearing Card */}
        <div className="p-6 rounded-2xl bg-[#00261C] border border-[#004532] shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Pending Clearing
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/20 text-slate-300 border border-slate-500/30">
              Return Window
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-200 tracking-tight">
            {formatCurrency(pendingBalance)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Delivered orders undergoing settlement maturity and buyer return policy windows.
          </p>
        </div>
      </div>

      {/* Secondary Financial Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#002219] border border-[#003828]">
          <span className="text-xs text-slate-400 font-medium">Lifetime Gross Earned</span>
          <div className="text-lg font-bold text-slate-100 mt-1">{formatCurrency(totalEarned)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#002219] border border-[#003828]">
          <span className="text-xs text-slate-400 font-medium">Total Disbursed (Paid Out)</span>
          <div className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(totalPaidOut)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#002219] border border-[#003828]">
          <span className="text-xs text-slate-400 font-medium">Platform Commissions Paid</span>
          <div className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(totalCommission)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#002219] border border-[#003828]">
          <span className="text-xs text-slate-400 font-medium">Customer Returns Deducted</span>
          <div className="text-lg font-bold text-rose-400 mt-1">{formatCurrency(totalRefunded)}</div>
        </div>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-[#00261C] border border-[#003B2A] rounded-2xl shadow-xl overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-[#003B2A] px-6 pt-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("clearance")}
              className={`pb-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                activeTab === "clearance"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock className="w-4 h-4" />
              Escrow & Clearance Timeline ({clearanceData.items?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("withdrawals")}
              className={`pb-4 text-sm font-semibold border-b-2 transition ${
                activeTab === "withdrawals"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Withdrawals & Payout History ({withdrawals.length})
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`pb-4 text-sm font-semibold border-b-2 transition ${
                activeTab === "transactions"
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Ledger Journal Entries ({transactions.length})
            </button>
          </div>

          {activeTab === "withdrawals" && (
            <div className="pb-3 flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#001D15] border border-[#004D38] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="completed">Disbursed (Completed)</option>
                <option value="rejected">Rejected</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab Content: Clearance Timeline */}
        {activeTab === "clearance" && (
          <div className="p-6 space-y-6">
            {/* Informational Policy Banner */}
            <div className="p-4 rounded-xl bg-[#002017] border border-[#004D38] flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-emerald-300">
                  Escrow Hold & Buyer Protection Timeline
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Delivered order earnings enter escrow for the duration of the customer return window (standard 7 calendar days post-delivery) to safeguard against returns and cancellations. Once the return window expires, eligible earnings automatically mature into your <span className="text-emerald-400 font-semibold">Available for Withdrawal</span> balance. Withdrawal requests are subsequently disbursed to your verified bank account upon administrative processing.
                </p>
              </div>
            </div>

            {/* Sub-KPI Filter / Status Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#001D15] border border-[#003B2A] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">Total in Escrow</span>
                  <div className="text-sm font-bold text-slate-100 mt-0.5 font-mono">
                    {formatCurrency(clearanceData.summary?.totalPendingAmount || pendingBalance)}
                  </div>
                </div>
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-3 rounded-xl bg-[#001D15] border border-[#003B2A] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">In Return Window</span>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {clearanceData.summary?.returnWindowActiveCount || 0} item(s)
                  </div>
                </div>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="p-3 rounded-xl bg-[#001D15] border border-[#003B2A] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">Awaiting Delivery</span>
                  <div className="text-sm font-bold text-sky-400 mt-0.5">
                    {clearanceData.summary?.awaitingDeliveryCount || 0} item(s)
                  </div>
                </div>
                <Truck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="p-3 rounded-xl bg-[#001D15] border border-[#003B2A] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">Ready for Batch</span>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {clearanceData.summary?.maturedCount || 0} item(s)
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Timeline Items Table */}
            <div className="overflow-x-auto rounded-xl border border-[#003B2A]">
              {(!clearanceData.items || clearanceData.items.length === 0) ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <Package className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
                  <p className="text-base font-semibold text-slate-300">No pending orders in escrow</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    All fulfilled order earnings have cleared into your available balance, or no newly placed customer orders are currently in transit.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-200">
                  <thead className="bg-[#002017] text-xs uppercase tracking-wider text-slate-400 border-b border-[#003B2A]">
                    <tr>
                      <th className="py-3.5 px-6">Order Reference</th>
                      <th className="py-3.5 px-6">Product / Item</th>
                      <th className="py-3.5 px-6">Net Earning</th>
                      <th className="py-3.5 px-6">Fulfillment / Delivery</th>
                      <th className="py-3.5 px-6">Return Expiry</th>
                      <th className="py-3.5 px-6">Clearance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#003828]">
                    {clearanceData.items.map((item) => (
                      <tr key={item.itemId || item.orderNumber} className="hover:bg-[#002D21] transition">
                        <td className="py-4 px-6 font-mono text-xs font-semibold text-emerald-400">
                          <Link href={`/vendor/orders`} className="hover:underline flex items-center gap-1.5">
                            {item.orderNumber}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </Link>
                          <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                            Placed: {new Date(item.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="max-w-[220px]">
                            <p className="text-xs font-medium text-white truncate" title={item.productName}>
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              SKU: {item.sku} • Qty: {item.quantity}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-bold text-white font-mono">
                          {formatCurrency(item.netEarnings)}
                        </td>
                        <td className="py-4 px-6">
                          {item.isDelivered ? (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                Delivered
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(item.deliveredAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1 text-xs text-sky-300 font-medium capitalize">
                                <Truck className="w-3.5 h-3.5 text-sky-400" />
                                {item.fulfillmentStatus?.replace(/_/g, " ") || item.orderStatus}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Est. Delivery: {item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "In Fulfillment"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {item.returnWindowExpiresAt ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-200">
                                {new Date(item.returnWindowExpiresAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {item.returnWindowDays}-day policy window
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Starts upon delivery ({item.returnWindowDays} days)
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {item.status === "return_window_active" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <Clock className="w-3.5 h-3.5" />
                              Return Escrow
                            </span>
                          )}
                          {item.status === "awaiting_delivery" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              <Truck className="w-3.5 h-3.5" />
                              Awaiting Delivery
                            </span>
                          )}
                          {item.status === "matured" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Ready for Clearance
                            </span>
                          )}
                          {item.status === "on_hold" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20" title={item.holdReason}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              Hold: {item.holdReason || "Under Review"}
                            </span>
                          )}
                          {item.status === "account_hold" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/20" title={item.holdReason}>
                              <Lock className="w-3.5 h-3.5" />
                              Account Hold
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Withdrawals */}
        {activeTab === "withdrawals" && (
          <div className="overflow-x-auto">
            {filteredWithdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Landmark className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
                <p className="text-base font-semibold text-slate-300">No withdrawal requests found</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  When you request withdrawals from your available balance, they will appear here along with their review status and banking transaction references.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-200">
                <thead className="bg-[#002017] text-xs uppercase tracking-wider text-slate-400 border-b border-[#003B2A]">
                  <tr>
                    <th className="py-3.5 px-6">Withdrawal #</th>
                    <th className="py-3.5 px-6">Date Requested</th>
                    <th className="py-3.5 px-6">Destination Bank</th>
                    <th className="py-3.5 px-6">Amount</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#003828]">
                  {filteredWithdrawals.map((item) => (
                    <tr key={item._id || item.id} className="hover:bg-[#002D21] transition">
                      <td className="py-4 px-6 font-mono text-xs font-semibold text-emerald-400">
                        {item.withdrawalNumber}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300">
                        {new Date(item.requestedAt || item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">
                            {item.bankSnapshot?.bankName || "Partner Bank"}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.bankSnapshot?.accountNumberMasked} • {item.bankSnapshot?.ifscCode}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(item.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setDetailModalItem(item)}
                          className="px-3 py-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition"
                        >
                          View Details &rarr;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: Ledger Transactions */}
        {activeTab === "transactions" && (
          <div className="overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <FileText className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
                <p className="text-base font-semibold text-slate-300">No ledger transactions found</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Authoritative double-entry ledger lines will record order earnings, commission snapshotting, settlement maturity, and withdrawal fund movements.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-200">
                <thead className="bg-[#002017] text-xs uppercase tracking-wider text-slate-400 border-b border-[#003B2A]">
                  <tr>
                    <th className="py-3.5 px-6">Journal ID</th>
                    <th className="py-3.5 px-6">Timestamp</th>
                    <th className="py-3.5 px-6">Entry Type</th>
                    <th className="py-3.5 px-6">Account Code</th>
                    <th className="py-3.5 px-6">Direction</th>
                    <th className="py-3.5 px-6 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#003828]">
                  {transactions.map((t, idx) => (
                    <tr key={t._id || idx} className="hover:bg-[#002D21] transition">
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                        {t.journalId}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-300">
                        {new Date(t.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-6 text-xs font-semibold text-slate-200">
                        {t.entryType}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                        {t.accountCode}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.direction === "CREDIT"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold font-mono text-white">
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Request Withdrawal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#00251C] border border-[#004D38] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#003B2A] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowDownCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Request Payout Withdrawal</h3>
                  <p className="text-xs text-slate-400">Transfer available earnings to your verified bank account</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              {/* Available balance indicator */}
              <div className="p-3.5 rounded-xl bg-[#001D15] border border-[#003B2A] flex items-center justify-between">
                <span className="text-xs text-slate-400">Available Balance:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {formatCurrency(availableBalance)}
                </span>
              </div>

              {/* Bank Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Payout Bank Destination
                </label>
                <div className="space-y-2">
                  {approvedBanks.map((bank) => (
                    <label
                      key={bank._id || bank.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        selectedBankId === (bank._id || bank.id)
                          ? "bg-emerald-500/10 border-emerald-500 text-white"
                          : "bg-[#001D15] border-[#003828] text-slate-300 hover:border-[#004D38]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="bankSelection"
                          value={bank._id || bank.id}
                          checked={selectedBankId === (bank._id || bank.id)}
                          onChange={() => setSelectedBankId(bank._id || bank.id)}
                          className="accent-emerald-500"
                        />
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                            {bank.bankName}
                            {bank.isActive && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-semibold">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {bank.accountNumberMasked} • {bank.ifscCode}
                          </div>
                        </div>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    </label>
                  ))}
                </div>
              </div>

              {/* Amount input with Max button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Withdrawal Amount (₹)
                  </label>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(availableBalance.toFixed(2))}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    Use Max Available
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={availableBalance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full pl-8 pr-4 py-2.5 bg-[#001D15] border border-[#004D38] rounded-xl text-white font-mono font-semibold focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reference Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={withdrawalNotes}
                  onChange={(e) => setWithdrawalNotes(e.target.value)}
                  placeholder="e.g. October payroll settlement"
                  className="w-full px-3.5 py-2 bg-[#001D15] border border-[#004D38] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Fund Reservation Notice */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  Atomic Escrow Reservation
                </div>
                <p className="text-[11px] text-slate-300">
                  Submitting will atomically debit your available balance and reserve the funds under general ledger account 2030 (Reserved Payouts).
                </p>
              </div>

              {/* Submit CTA */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#003B2A]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-[#001D15] border border-[#003B2A] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Confirm & Submit Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Drawer / Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#00251C] border border-[#004D38] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#003B2A] pb-3">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                  Withdrawal Audit Record
                </span>
                <h3 className="text-base font-bold text-white">{detailModalItem.withdrawalNumber}</h3>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">Status</span>
                <span>{getStatusBadge(detailModalItem.status)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">Requested Amount</span>
                <span className="font-bold font-mono text-white">{formatCurrency(detailModalItem.amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">Destination Bank</span>
                <span className="font-semibold text-white">
                  {detailModalItem.bankSnapshot?.bankName} ({detailModalItem.bankSnapshot?.accountNumberMasked})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">Account Holder</span>
                <span className="text-slate-200">{detailModalItem.bankSnapshot?.accountHolderName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">IFSC Code</span>
                <span className="font-mono text-slate-300">{detailModalItem.bankSnapshot?.ifscCode}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#003828]">
                <span className="text-slate-400">Reservation Journal ID</span>
                <span className="font-mono text-emerald-400">{detailModalItem.reservationJournalId}</span>
              </div>
              {detailModalItem.disbursementJournalId && (
                <div className="flex justify-between py-1.5 border-b border-[#003828]">
                  <span className="text-slate-400">Disbursement Journal ID</span>
                  <span className="font-mono text-emerald-400">{detailModalItem.disbursementJournalId}</span>
                </div>
              )}
              {detailModalItem.releaseJournalId && (
                <div className="flex justify-between py-1.5 border-b border-[#003828]">
                  <span className="text-slate-400">Release Journal ID</span>
                  <span className="font-mono text-amber-400">{detailModalItem.releaseJournalId}</span>
                </div>
              )}
              {detailModalItem.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                  <span className="font-semibold">Reviewer Rejection Justification:</span>
                  <p className="text-[11px] text-slate-200">{detailModalItem.rejectionReason}</p>
                </div>
              )}
              {detailModalItem.failureReason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 space-y-1">
                  <span className="font-semibold">Bank Transmission Failure:</span>
                  <p className="text-[11px] text-slate-200">{detailModalItem.failureReason}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#003B2A] flex justify-end">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-[#001D15] border border-[#003828]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

