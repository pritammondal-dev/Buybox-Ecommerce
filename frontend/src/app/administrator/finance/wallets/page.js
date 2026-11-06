"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Building2,
  Loader2,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminVendorWalletsPage() {
  const [wallets, setWallets] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reconciliationFilter, setReconciliationFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const formatCurrency = (val, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
    }).format(Number(val || 0));
  };

  const loadWallets = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await adminFinanceService.listVendorWallets({
        page,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        reconciliationStatus: reconciliationFilter !== "all" ? reconciliationFilter : undefined,
        search: searchQuery.trim() || undefined,
        currency: "INR",
      });

      const list = res?.data || res?.items || [];
      setWallets(Array.isArray(list) ? list : []);
      if (res?.meta) {
        setMeta(res.meta);
        if (res.meta.aggregates) {
          setAggregates(res.meta.aggregates);
        }
      }
    } catch (err) {
      toast.error("Failed to load vendor wallets", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallets(1);
  }, [statusFilter, reconciliationFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadWallets(1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Vendor Wallet Oversight
            </h1>
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Ledger Integrated
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Authoritative vendor balances, payout liabilities, and real-time ledger reconciliation health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadWallets(meta.page)}
            disabled={isLoading}
            className="p-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            title="Refresh Wallets"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/administrator/finance/reconciliation"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          >
            <Scale className="w-4 h-4" />
            Platform Reconciliation
          </Link>
        </div>
      </div>

      {/* Aggregate Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Available Liability
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(aggregates.totalAvailableBalance)}
          </div>
          <p className="text-xs text-gray-400 mt-1">Eligible for vendor withdrawal</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Reserved Balance
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(aggregates.totalReservedBalance)}
          </div>
          <p className="text-xs text-gray-400 mt-1">Locked in pending payouts</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Pending Balance
          </span>
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300 mt-1">
            {formatCurrency(aggregates.totalPendingBalance)}
          </div>
          <p className="text-xs text-gray-400 mt-1">Awaiting order delivery / release</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Lifetime Net Earned
          </span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(aggregates.totalLifetimeEarned)}
          </div>
          <p className="text-xs text-gray-400 mt-1">{aggregates.totalWalletsCount || meta.total || 0} Registered Vendor Wallets</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Wallet Statuses</option>
            <option value="active">Active Only</option>
            <option value="frozen">Frozen / Suspended</option>
          </select>

          <select
            value={reconciliationFilter}
            onChange={(e) => setReconciliationFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Reconciliation States</option>
            <option value="healthy">Healthy Only</option>
            <option value="discrepant">Discrepancies Only</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendor store or business..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg w-64 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm">Loading vendor wallets...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Wallet className="w-10 h-10 mx-auto text-gray-400 mb-2 opacity-50" />
            <p className="text-sm font-medium">No vendor wallets found</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Available Balance</th>
                  <th className="px-5 py-3.5">Reserved Balance</th>
                  <th className="px-5 py-3.5">Pending Balance</th>
                  <th className="px-5 py-3.5">Lifetime Earned</th>
                  <th className="px-5 py-3.5">Reconciliation</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {wallets.map((w) => {
                  const vendorInfo = w.vendor || (typeof w.vendorId === "object" ? w.vendorId : {}) || {};
                  const isHealthy = !w.reconciliationStatus || w.reconciliationStatus === "healthy";
                  const stableKey = String(w._id || w.id || w.vendorId?._id || w.vendorId || w.vendor?._id);
                  const drillDownVendorId = String(w.vendor?._id || (typeof w.vendorId === "object" ? w.vendorId?._id : w.vendorId) || w._id || w.id);

                  return (
                    <tr key={stableKey} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {vendorInfo.storeName || vendorInfo.businessName || "Unnamed Vendor"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {vendorInfo.businessSlug ? `@${vendorInfo.businessSlug}` : vendorInfo.email || drillDownVendorId}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(w.availableBalance, w.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {formatCurrency(w.reservedBalance, w.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-gray-600 dark:text-gray-300">
                          {formatCurrency(w.pendingBalance, w.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(w.lifetimeEarned, w.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isHealthy ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Healthy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="w-3 h-3" /> Discrepant
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.status === "active"
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                        }`}>
                          {w.status || "active"}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/administrator/finance/wallets/${drillDownVendorId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Drill-Down
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

