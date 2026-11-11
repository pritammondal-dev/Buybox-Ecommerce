"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Building2,
  Landmark,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorStatementsPage() {
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [serverSummary, setServerSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadStatements = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const [settlementsRes, summaryRes] = await Promise.allSettled([
        vendorService.getMySettlements(params),
        vendorService.getFinanceSummary(),
      ]);

      if (settlementsRes.status === "fulfilled") {
        const raw =
          settlementsRes.value?.data?.data ||
          settlementsRes.value?.data?.settlements ||
          settlementsRes.value?.data ||
          [];
        const items = Array.isArray(raw) ? raw : raw.items || [];
        setSettlements(items);

        const meta = settlementsRes.value?.data?.meta || {};
        if (meta.summary) {
          setServerSummary(meta.summary);
        }
        setTotalRecords(meta.total !== undefined ? meta.total : items.length);
        setTotalPages(meta.totalPages || 1);
      }

      if (summaryRes.status === "fulfilled") {
        const sumData =
          summaryRes.value?.data?.data || summaryRes.value?.data || null;
        setSummary(sumData);
      }

      if (showToast) {
        toast.success("Statements updated successfully");
      }
    } catch (err) {
      if (
        err.status !== 403 &&
        err.status !== 404 &&
        err.response?.status !== 403 &&
        err.response?.status !== 404
      ) {
        toast.error("Failed to load statements", {
          description: err.response?.data?.message || err.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  // Authoritative cumulative financial metrics from database aggregation
  const totalSettledAmount = serverSummary?.totalSettledAmount !== undefined
    ? Number(serverSummary.totalSettledAmount)
    : summary?.totalSettledAmount !== undefined
    ? Number(summary.totalSettledAmount)
    : 0;

  const pendingDisbursements = serverSummary?.pendingDisbursements !== undefined
    ? Number(serverSummary.pendingDisbursements)
    : summary?.pendingSettlementAmount !== undefined
    ? Number(summary.pendingSettlementAmount)
    : 0;

  const totalGrossVolume = serverSummary?.totalGrossVolume !== undefined
    ? Number(serverSummary.totalGrossVolume)
    : summary?.totalSettlementVolume !== undefined
    ? Number(summary.totalSettlementVolume)
    : 0;

  // Filtered & searched statement list (safe client fallback)
  const filteredSettlements = useMemo(() => {
    return settlements.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const numberMatch =
          item.settlementNumber &&
          String(item.settlementNumber).toLowerCase().includes(query);
        const idMatch =
          (item.secureId || item.id || item._id) &&
          String(item.secureId || item.id || item._id)
            .toLowerCase()
            .includes(query);
        const refMatch =
          item.payoutReference &&
          String(item.payoutReference).toLowerCase().includes(query);
        const bankMatch =
          item.bankSnapshot?.bankName &&
          item.bankSnapshot.bankName.toLowerCase().includes(query);

        return Boolean(numberMatch || idMatch || refMatch || bankMatch);
      }
      return true;
    });
  }, [settlements, statusFilter, searchQuery]);

  const formatDate = (dateVal) => {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getStatusBadge = (status) => {
    const lower = (status || "pending").toLowerCase();
    switch (lower) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="size-3" /> Paid
          </span>
        );
      case "payable":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="size-3" /> Payable
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Clock className="size-3" /> In Process
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="size-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb & Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Link
          href="/vendor/finance"
          className="hover:text-slate-800 transition-colors"
        >
          Finance Overview
        </Link>
        <ChevronRight className="size-3 text-slate-400" />
        <span className="text-slate-900 font-bold">Statements</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Settlement Statements
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Review detailed statement cycles, gross commission deductions, net disbursements, and payout references.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/vendor/finance/bank-accounts"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors"
          >
            <Landmark className="size-3.5 text-emerald-700" />
            <span>Bank Accounts</span>
          </Link>

          <button
            onClick={() => loadStatements(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors"
            title="Refresh statements"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Financial Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Settled Earnings
            </span>
            <div className="size-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {formatCurrency(totalSettledAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total net payouts successfully transferred
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Payouts
            </span>
            <div className="size-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {formatCurrency(pendingDisbursements)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Statements scheduled for banking disbursement
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cumulative Gross
            </span>
            <div className="size-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatCurrency(totalGrossVolume)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Gross customer sales across all statements
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Statements
            </span>
            <div className="size-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalRecords}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Generated marketplace billing cycles
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search statement #, payout reference, or bank..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="size-3.5 text-slate-400" />
          <span className="text-xs font-bold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-emerald-600"
          >
            <option value="all">All Statuses ({totalRecords})</option>
            <option value="paid">Paid</option>
            <option value="payable">Payable</option>
            <option value="processing">Processing</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Statements Table / Card List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <div className="h-6 w-48 bg-slate-100 rounded-lg animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-100 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : filteredSettlements.length === 0 ? (
          <div className="py-16 text-center px-4">
            <FileSpreadsheet className="size-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">
              {settlements.length === 0
                ? "No Settlement Statements Found"
                : "No Statements Match Your Filter"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {settlements.length === 0
                ? "Settlement statements are automatically created on billing cycle close for eligible delivered orders."
                : "Try clearing your search query or choosing 'All Statuses'."}
            </p>
            {settlements.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Statement #</th>
                  <th className="py-3.5 px-4">Cycle Period</th>
                  <th className="py-3.5 px-4 text-right">Gross Sales</th>
                  <th className="py-3.5 px-4 text-right">Fee Deduction</th>
                  <th className="py-3.5 px-4 text-right">Net Payable</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredSettlements.map((statement) => {
                  const statementId =
                    statement.id || statement._id || statement.secureId;
                  const statementNumber =
                    statement.settlementNumber ||
                    statement.secureId ||
                    statementId;

                  return (
                    <tr
                      key={statementId}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-4 px-4 sm:px-6 font-bold text-slate-900">
                        <Link
                          href={`/vendor/finance/settlements/${statementId}`}
                          className="hover:text-emerald-700 transition-colors flex items-center gap-1.5"
                        >
                          <span>#{statementNumber}</span>
                          <ArrowUpRight className="size-3 text-slate-400" />
                        </Link>
                        {statement.payoutReference && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Ref: {statement.payoutReference}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Calendar className="size-3.5 text-slate-400 shrink-0" />
                          <span>
                            {formatDate(statement.periodStart)} —{" "}
                            {formatDate(statement.periodEnd)}
                          </span>
                        </div>
                        {statement.orderIds && (
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {Array.isArray(statement.orderIds)
                              ? statement.orderIds.length
                              : 0}{" "}
                            orders included
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right font-semibold text-slate-800">
                        {formatCurrency(statement.grossSales)}
                      </td>

                      <td className="py-4 px-4 text-right text-rose-600 font-semibold">
                        -{formatCurrency(statement.platformCommission)}
                      </td>

                      <td className="py-4 px-4 text-right font-black text-emerald-700 text-sm">
                        {formatCurrency(statement.netPayable)}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(statement.status)}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right">
                        <Link
                          href={`/vendor/finance/settlements/${statementId}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#004D38] text-slate-700 hover:text-white text-xs font-bold transition-all shadow-2xs"
                        >
                          <span>View Detail</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-xs">
            <span className="text-slate-500 font-semibold">
              Showing page <span className="text-slate-900 font-bold">{page}</span> of{" "}
              <span className="text-slate-900 font-bold">{totalPages}</span> ({totalRecords} statements total)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <span className="px-2 font-bold text-slate-600">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

