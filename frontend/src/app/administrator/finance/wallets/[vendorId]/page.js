"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Wallet,
  ArrowLeft,
  RefreshCw,
  Building2,
  Landmark,
  Scale,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  FileSpreadsheet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Lock,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminVendorWalletDrilldownPage() {
  const { vendorId } = useParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ledger");
  const [isSyncing, setIsSyncing] = useState(false);

  const formatCurrency = (val, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
    }).format(Number(val || 0));
  };

  const loadDrilldown = async () => {
    if (!vendorId) return;
    setIsLoading(true);
    try {
      const res = await adminFinanceService.getVendorWalletDrilldown(vendorId, { currency: "INR" });
      setData(res?.data || res);
    } catch (err) {
      toast.error("Failed to load vendor financial drill-down", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrilldown();
  }, [vendorId]);

  const handleSyncWallet = async () => {
    setIsSyncing(true);
    try {
      await adminFinanceService.syncVendorWalletProjections(vendorId);
      toast.success("Vendor wallet balance successfully synced with general ledger");
      loadDrilldown();
    } catch (err) {
      toast.error("Wallet sync failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const vendor = data?.vendor || {};
  const wallet = data?.wallet || {};
  const bankAccounts = data?.bankAccounts || [];
  const ledgerEntries = data?.ledgerEntries || data?.recentEntries || [];
  const settlements = data?.settlements || [];
  const payouts = data?.payouts || [];
  const withdrawalRequests = data?.withdrawalRequests || data?.withdrawals || [];
  const reconciliation = data?.reconciliation || {};

  const isHealthy = reconciliation.isHealthy !== false;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back and Top Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <Link
          href="/administrator/finance/wallets"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vendor Wallets
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDrilldown}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm disabled:opacity-50"
            title="Refresh Drilldown"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/administrator/finance/reconciliation"
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm inline-flex items-center gap-1"
          >
            <Scale className="w-3.5 h-3.5" /> Reconciliation Console
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm">Loading comprehensive vendor financial drilldown...</span>
        </div>
      ) : !data ? (
        <div className="p-12 text-center text-gray-500">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
          <p className="text-base font-semibold">Vendor Financial Record Not Found</p>
        </div>
      ) : (
        <>
          {/* Vendor Profile Header Banner */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-6 h-6 text-indigo-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {vendor.storeName || vendor.businessName || "Vendor"}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  wallet.status === "active"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                }`}>
                  Wallet {wallet.status || "active"}
                </span>
                {isHealthy ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ledger Reconciled
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Discrepant Balance
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vendor ID: <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">{vendor._id || vendorId}</code> | Slug: @{vendor.businessSlug || "N/A"} | Contract Commission: {vendor.commissionRate ? `${(Number(vendor.commissionRate.toString()) * (Number(vendor.commissionRate.toString()) <= 1 ? 100 : 1)).toFixed(2)}%` : "Global Default (10%)"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncWallet}
                disabled={isSyncing}
                className="px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                Sync Projections
              </button>
            </div>
          </div>

          {/* Real-time Balances Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Available for Withdrawal
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(wallet.availableBalance, wallet.currency)}
              </div>
              <p className="text-xs text-gray-400 mt-1">Authoritative general ledger credit</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Reserved in Withdrawals
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(wallet.reservedBalance, wallet.currency)}
              </div>
              <p className="text-xs text-gray-400 mt-1">Locked in pending payout transfers</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pending Settlement
              </span>
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                {formatCurrency(wallet.pendingBalance, wallet.currency)}
              </div>
              <p className="text-xs text-gray-400 mt-1">Awaiting order fulfillment cycle</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Lifetime Net Earned
              </span>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {formatCurrency(wallet.lifetimeEarned, wallet.currency)}
              </div>
              <p className="text-xs text-gray-400 mt-1">Total order earnings credited to date</p>
            </div>
          </div>

          {/* Masked Bank Accounts Destination Integrity Panel */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  Approved Payout Destinations (Masked & Encrypted)
                </h3>
              </div>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-600" /> Zero-Plaintext Security Audit Enforced
              </span>
            </div>

            {bankAccounts.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No bank account records configured for this vendor.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bankAccounts.map((b) => (
                  <div key={b._id || b.id || b.accountNumberMasked} className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{b.bankName || "Bank"}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        b.status === "approved"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-gray-200 text-gray-700"
                      }`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 font-mono">
                      Account: {b.accountNumberMasked || (b.accountNumberLast4 ? `••••••••${b.accountNumberLast4}` : "••••••••••••")}
                    </div>
                    <div className="text-gray-500">
                      Holder: <span className="text-gray-800 dark:text-gray-200 font-medium">{b.accountHolderName}</span>
                    </div>
                    <div className="text-gray-400">
                      IFSC / Code: <span className="font-mono text-gray-700 dark:text-gray-300">{b.ifscCode || b.routingNumber || "N/A"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabbed Activity Panels */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Tab navigation */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              {[
                { id: "ledger", label: `General Ledger (${ledgerEntries.length})` },
                { id: "settlements", label: `Settlements (${settlements.length})` },
                { id: "payouts", label: `Payouts (${payouts.length})` },
                { id: "withdrawals", label: `Withdrawals (${withdrawalRequests.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-xs font-semibold border-b-2 transition ${
                    activeTab === tab.id
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: General Ledger Entries */}
            {activeTab === "ledger" && (
              <div className="overflow-x-auto">
                {ledgerEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">No ledger transactions posted yet.</div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Journal ID</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Direction</th>
                        <th className="px-4 py-3">Account Code</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {ledgerEntries.map((le) => (
                        <tr key={le._id || le.id || le.journalId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {le.postedAt ? new Date(le.postedAt).toLocaleString() : new Date(le.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                            {le.journalId}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {le.entryType}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              le.direction === "CREDIT"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            }`}>
                              {le.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-500">
                            {le.accountCode}
                          </td>
                          <td className="px-4 py-3 font-bold">
                            <span className={le.direction === "CREDIT" ? "text-emerald-600" : "text-rose-600"}>
                              {le.direction === "CREDIT" ? "+" : "-"} {formatCurrency(le.amount, le.currency)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                            {le.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 2: Settlements */}
            {activeTab === "settlements" && (
              <div className="overflow-x-auto">
                {settlements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">No settlements generated yet.</div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3">Net Payable</th>
                        <th className="px-4 py-3">Commission Deducted</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Generated Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {settlements.map((s) => (
                        <tr key={s._id || s.id || s.settlementNumber} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                          <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                            {s.periodStart ? new Date(s.periodStart).toLocaleDateString() : ""} - {s.periodEnd ? new Date(s.periodEnd).toLocaleDateString() : ""}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {formatCurrency(s.netPayableAmount || s.netAmount, s.currency)}
                          </td>
                          <td className="px-4 py-3 text-rose-600 font-semibold">
                            {formatCurrency(s.commissionAmount || s.totalCommission, s.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-800">
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 3: Payouts */}
            {activeTab === "payouts" && (
              <div className="overflow-x-auto">
                {payouts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">No payout disbursements recorded yet.</div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Payout ID</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Destination Bank</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {payouts.map((p) => (
                        <tr key={p._id || p.id || p.payoutNumber} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                          <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                            {p._id}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                            {formatCurrency(p.amount, p.currency)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {p.destinationSnapshot?.bankName || "Approved Destination"} (••••{p.destinationSnapshot?.accountNumberLast4 || "•••"})
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              {p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 4: Withdrawal Requests */}
            {activeTab === "withdrawals" && (
              <div className="overflow-x-auto">
                {withdrawalRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">No withdrawal requests filed yet.</div>
                ) : (
                  <table className="w-full text-left text-xs divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/30 text-gray-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Request ID</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Destination</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {withdrawalRequests.map((wr) => (
                        <tr key={wr._id || wr.id || wr.withdrawalNumber} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                          <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                            {wr._id}
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600">
                            {formatCurrency(wr.amount, wr.currency)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {wr.bankAccountSnapshot?.bankName || "Partner Bank"} (••••{wr.bankAccountSnapshot?.accountNumberLast4 || "•••"})
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                              {wr.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {wr.createdAt ? new Date(wr.createdAt).toLocaleDateString() : ""}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                            {wr.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

