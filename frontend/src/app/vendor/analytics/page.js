"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Package,
  Calendar,
  Download,
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  Layers,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import {
  VendorBreadcrumbs,
  VendorPageHeader,
  VendorKpiCard,
  VendorStatusBadge,
  VendorEmptyState,
  VendorTablePagination,
} from "@/components/vendor";

import {
  CANONICAL_SORT_FIELDS,
  CANONICAL_SORT_ORDERS,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  normalizeSortParams,
} from "@/utils/vendor-analytics-sort";

export {
  CANONICAL_SORT_FIELDS,
  CANONICAL_SORT_ORDERS,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  normalizeSortParams,
};

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "previous_month", label: "Previous Month" },
  { value: "custom", label: "Custom Range" },
];

export default function VendorAnalyticsPage() {
  // Period & comparison states
  const [period, setPeriod] = useState("last_30_days");
  const [compare, setCompare] = useState(true);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Loading & export states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Product table filters & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("unitsSold");
  const [sortOrder, setSortOrder] = useState("desc");

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch Overview and Trends
  const fetchOverviewAndTrends = useCallback(async () => {
    try {
      const params = {
        period,
        compare,
      };
      if (period === "custom") {
        if (!customStartDate || !customEndDate) return;
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }

      const [overviewRes, trendRes] = await Promise.all([
        vendorService.getAnalyticsOverview(params),
        vendorService.getAnalyticsSalesTrend(params),
      ]);

      const oData = overviewRes?.data?.data || overviewRes?.data || overviewRes;
      const tData = trendRes?.data?.data || trendRes?.data || trendRes;

      setOverviewData(oData);
      setTrendData(Array.isArray(tData?.trend) ? tData.trend : []);
    } catch (err) {
      console.error("Failed to load vendor overview metrics:", err);
      toast.error(err?.response?.data?.message || "Failed to load sales analytics");
    }
  }, [period, compare, customStartDate, customEndDate]);

  // Fetch Product Performance Table
  const fetchProductPerformance = useCallback(async () => {
    try {
      const { sortBy: cleanSortBy, sortOrder: cleanSortOrder } = normalizeSortParams(sortBy, sortOrder);

      const params = {
        period,
        page: pagination.page,
        limit: pagination.limit,
        sortBy: cleanSortBy,
        sortOrder: cleanSortOrder,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (period === "custom") {
        if (!customStartDate || !customEndDate) return;
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }

      const res = await vendorService.getProductPerformance(params);
      const data = res?.data?.data || res?.data || res;

      setProductsData(Array.isArray(data?.products) ? data.products : []);
      if (data?.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.pagination.total || 0,
          totalPages: data.pagination.totalPages || 1,
        }));
      }
    } catch (err) {
      console.error("Failed to load product performance:", err);
      toast.error(err?.response?.data?.message || "Failed to load product performance");
    }
  }, [period, pagination.page, pagination.limit, debouncedSearch, sortBy, sortOrder, customStartDate, customEndDate]);

  // Column header sort handler
  const handleColumnSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "productName" ? "asc" : "desc");
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [sortBy]);

  // Master Data Refresh
  const loadAllData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      await Promise.all([fetchOverviewAndTrends(), fetchProductPerformance()]);
      if (isManualRefresh) {
        toast.success("Analytics updated with live marketplace data");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchOverviewAndTrends, fetchProductPerformance]);

  // Initial and reactive load
  useEffect(() => {
    if (period === "custom" && (!customStartDate || !customEndDate)) {
      return;
    }
    loadAllData();
  }, [period, compare, debouncedSearch, sortBy, sortOrder, pagination.page, pagination.limit]);

  // Handle Export
  const handleExport = async (type, format) => {
    setExportMenuOpen(false);
    try {
      setIsExporting(true);
      toast.info(`Preparing ${type} export (${format.toUpperCase()})...`);
      const params = {
        type,
        format,
        period,
      };
      if (period === "custom") {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      }
      if (type === "products") {
        const { sortBy: cleanSortBy, sortOrder: cleanSortOrder } = normalizeSortParams(sortBy, sortOrder);
        params.sortBy = cleanSortBy;
        params.sortOrder = cleanSortOrder;
        if (debouncedSearch) {
          params.search = debouncedSearch;
        }
      }

      const res = await vendorService.exportAnalytics(params);
      const blob = new Blob([res.data], {
        type:
          format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `buybox_${type}_${period}_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${type} export successfully`);
    } catch (err) {
      console.error("Export failure:", err);
      toast.error(err?.response?.data?.message || "Failed to export analytics report");
    } finally {
      setIsExporting(false);
    }
  };

  // Metric formatters
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const metrics = overviewData?.metrics || {};
  const comparison = overviewData?.comparison || {};
  const wallet = overviewData?.authoritativeWallet || {};

  // Maximum value for trend scaling
  const maxTrendSales = useMemo(() => {
    if (!trendData.length) return 100;
    const maxVal = Math.max(...trendData.map((d) => d.grossSales || 0));
    return maxVal > 0 ? maxVal : 100;
  }, [trendData]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Breadcrumbs */}
      <VendorBreadcrumbs
        items={[
          { label: "Marketplace Operations", href: "/vendor/dashboard" },
          { label: "Analytics & Performance" },
        ]}
      />

      {/* 2. Page Header with Controls */}
      <VendorPageHeader
        title="Business Analytics & Sales Performance"
        description="Comprehensive marketplace revenue tracking, period comparisons, unit velocity, and authoritative ledger balances."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live DB Telemetry
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Selector */}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-9 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007A55] focus:border-transparent"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Compare Toggle */}
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors select-none">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="size-3.5 rounded border-slate-300 text-[#007A55] focus:ring-[#007A55]"
              />
              <span>Compare with Previous</span>
            </label>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => loadAllData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-1.5 h-9 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#007A55]" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 h-9 px-3 py-1.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-lg shadow-sm transition-colors"
              >
                <Download className="size-3.5" />
                <span>Export Report</span>
                <ChevronDown className="size-3" />
              </button>

              {exportMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setExportMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-30 text-xs">
                    <div className="px-3 py-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      Sales & Performance Reports
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport("overview", "csv")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Sales Overview</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("overview", "xlsx")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Sales Overview</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-600">XLSX</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <div className="px-3 py-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      Catalog Product Reports
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport("products", "csv")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Product Performance</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("products", "xlsx")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Product Performance</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-600">XLSX</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />

                    <div className="px-3 py-1 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      Daily Velocity Trend
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExport("trend", "csv")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Daily Trend Series</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("trend", "xlsx")}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <span>Daily Trend Series</span>
                      <span className="text-[10px] uppercase font-bold text-emerald-600">XLSX</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Custom Date Range Picker */}
      {period === "custom" && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 px-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
            />
          </div>
          <button
            type="button"
            onClick={() => loadAllData()}
            className="h-8 px-3 text-xs font-semibold text-white bg-[#007A55] rounded-lg hover:bg-[#004D38] transition-colors"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* 3. Authoritative Wallet Balance Banner */}
      <div className="rounded-xl border border-emerald-900/20 bg-gradient-to-r from-[#003828] to-[#004D38] p-5 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-emerald-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Authoritative Wallet & Payout Ledger
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                General Ledger Synchronized
              </span>
            </div>
            <p className="text-xs text-emerald-100/80">
              Real-time balance state from the financial double-entry ledger. Available funds are eligible for payout requests.
            </p>
          </div>

          <Link
            href="/vendor/finance/wallet"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-white text-[#004D38] hover:bg-emerald-50 transition-colors shadow-sm self-start md:self-auto"
          >
            <span>Manage Wallet & Payouts</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <div className="text-emerald-200/70 text-[11px]">Available for Payout</div>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {formatCurrency(wallet.availableBalance)}
            </div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-[11px]">Pending Clearance</div>
            <div className="text-base sm:text-lg font-bold text-emerald-200 mt-0.5">
              {formatCurrency(wallet.pendingBalance)}
            </div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-[11px]">Reserved (In-Flight)</div>
            <div className="text-base sm:text-lg font-bold text-amber-200 mt-0.5">
              {formatCurrency(wallet.reservedBalance)}
            </div>
          </div>
          <div>
            <div className="text-emerald-200/70 text-[11px]">Total Paid Out</div>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {formatCurrency(wallet.totalPaidOut)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Core Sales & Velocity KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <VendorKpiCard
          title="Gross Ordered Sales"
          value={formatCurrency(metrics.grossSales)}
          subtitle={
            compare && comparison.grossSales
              ? `${comparison.grossSales.display} vs prev period`
              : "All non-cancelled customer orders"
          }
          icon={DollarSign}
          trend={
            compare && comparison.grossSales
              ? {
                  direction: comparison.grossSales.direction === "negative" ? "down" : "up",
                  value: comparison.grossSales.display,
                }
              : null
          }
        />

        <VendorKpiCard
          title="Net Merchandise Sales"
          value={formatCurrency(metrics.merchandiseSales)}
          subtitle={
            compare && comparison.merchandiseSales
              ? `${comparison.merchandiseSales.display} vs prev period`
              : `Discounts applied: ${formatCurrency(metrics.discounts)}`
          }
          icon={TrendingUp}
          trend={
            compare && comparison.merchandiseSales
              ? {
                  direction: comparison.merchandiseSales.direction === "negative" ? "down" : "up",
                  value: comparison.merchandiseSales.display,
                }
              : null
          }
        />

        <VendorKpiCard
          title="Units Sold & Dispatched"
          value={Number(metrics.unitsSold || 0).toLocaleString()}
          subtitle={
            compare && comparison.unitsSold
              ? `${comparison.unitsSold.display} vs prev period`
              : "Total customer units ordered"
          }
          icon={Package}
          trend={
            compare && comparison.unitsSold
              ? {
                  direction: comparison.unitsSold.direction === "negative" ? "down" : "up",
                  value: comparison.unitsSold.display,
                }
              : null
          }
        />

        <VendorKpiCard
          title="Realized Orders Count"
          value={Number(metrics.orderCount || 0).toLocaleString()}
          subtitle={
            compare && comparison.orderCount
              ? `${comparison.orderCount.display} vs prev period`
              : `Avg Order: ${formatCurrency(metrics.averageOrderValue)}`
          }
          icon={ShoppingBag}
          trend={
            compare && comparison.orderCount
              ? {
                  direction: comparison.orderCount.direction === "negative" ? "down" : "up",
                  value: comparison.orderCount.display,
                }
              : null
          }
        />
      </div>

      {/* 5. Secondary Operational Metrics (Cancelled & Returns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cancelled Orders
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {metrics.cancelledOrdersCount || 0}{" "}
              <span className="text-xs font-normal text-slate-400">
                ({formatCurrency(metrics.cancelledOrdersAmount)})
              </span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
            <XCircle className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Customer Returns (RMA)
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {metrics.returnsCount || 0}{" "}
              <span className="text-xs font-normal text-slate-400">
                ({metrics.returnsUnits || 0} units, {formatCurrency(metrics.returnsAmount)})
              </span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertCircle className="size-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Marketplace Commission
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {formatCurrency(metrics.commission)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-[#007A55]">
            <Percent className="size-5" />
          </div>
        </div>
      </div>

      {/* 6. Daily Sales Trend Chart (Interactive High-Contrast Vector SVG) */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Daily Revenue & Velocity Trajectory
            </h3>
            <p className="text-xs text-slate-500">
              Daily gross sales and realized customer order volume across the selected time window.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#007A55]" />
              Gross Sales (₹)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-slate-300" />
              Orders Count
            </span>
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="py-12">
            <VendorEmptyState
              title="No Trend Data Recorded"
              description="No customer sales or order events occurred during this selected date window."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {/* SVG Visual Bars */}
            <div className="h-44 w-full flex items-end gap-1 sm:gap-2 pt-6 pb-2 border-b border-slate-200 overflow-x-auto">
              {trendData.map((d, idx) => {
                const heightPercent = Math.max(
                  4,
                  Math.round(((d.grossSales || 0) / maxTrendSales) * 100)
                );
                return (
                  <div
                    key={d.date || idx}
                    className="flex-1 min-w-[20px] flex flex-col items-center group relative h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                      <div className="font-bold">{d.date}</div>
                      <div>Sales: {formatCurrency(d.grossSales)}</div>
                      <div>Orders: {d.orderCount || 0} ({d.unitsSold || 0} units)</div>
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[28px] rounded-t bg-gradient-to-t from-[#004D38] to-[#007A55] group-hover:from-emerald-600 group-hover:to-emerald-400 transition-all cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Date axis markers */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
              <span>{trendData[0]?.date}</span>
              {trendData.length > 2 && (
                <span>{trendData[Math.floor(trendData.length / 2)]?.date}</span>
              )}
              <span>{trendData[trendData.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* 7. Product Performance Table (Amazon Seller Central Pattern) */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Product Performance & Inventory Health
            </h3>
            <p className="text-xs text-slate-500">
              Itemized sales velocity, revenue contribution, and real-time warehouse inventory for your catalog.
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs border border-slate-300 rounded-lg bg-white placeholder-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#007A55] focus:border-transparent"
              />
            </div>

            {/* Sort Dropdown */}
            <select
              id="vendor-analytics-sort-select"
              aria-label="Sort product performance table"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const { sortBy: nextSortBy, sortOrder: nextSortOrder } = normalizeSortParams(e.target.value);
                setSortBy(nextSortBy);
                setSortOrder(nextSortOrder);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="h-9 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007A55]"
            >
              <option value="unitsSold:desc">Sort: Units Sold (High to Low)</option>
              <option value="unitsSold:asc">Sort: Units Sold (Low to High)</option>
              <option value="grossSales:desc">Sort: Gross Sales (High to Low)</option>
              <option value="grossSales:asc">Sort: Gross Sales (Low to High)</option>
              <option value="netSales:desc">Sort: Net Sales (High to Low)</option>
              <option value="netSales:asc">Sort: Net Sales (Low to High)</option>
              <option value="productName:asc">Sort: Product Title (A-Z)</option>
              <option value="productName:desc">Sort: Product Title (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {productsData.length === 0 ? (
          <div className="py-12">
            <VendorEmptyState
              title="No Product Performance Records"
              description={
                debouncedSearch
                  ? `No products matched the filter "${debouncedSearch}".`
                  : "No sales activity recorded for products in this date range."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleColumnSort("productName")}
                      className="inline-flex items-center gap-1.5 font-semibold uppercase hover:text-slate-900 focus:outline-none transition-colors"
                      title="Sort by Product Title"
                    >
                      Product & SKU
                      {sortBy === "productName" && (
                        sortOrder === "asc" ? (
                          <ArrowUp className="size-3 text-[#007A55]" />
                        ) : (
                          <ArrowDown className="size-3 text-[#007A55]" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleColumnSort("unitsSold")}
                      className="inline-flex items-center gap-1.5 font-semibold uppercase hover:text-slate-900 focus:outline-none transition-colors ml-auto"
                      title="Sort by Units Sold"
                    >
                      Units Sold
                      {sortBy === "unitsSold" && (
                        sortOrder === "asc" ? (
                          <ArrowUp className="size-3 text-[#007A55]" />
                        ) : (
                          <ArrowDown className="size-3 text-[#007A55]" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleColumnSort("grossSales")}
                      className="inline-flex items-center gap-1.5 font-semibold uppercase hover:text-slate-900 focus:outline-none transition-colors ml-auto"
                      title="Sort by Gross Sales"
                    >
                      Gross Sales
                      {sortBy === "grossSales" && (
                        sortOrder === "asc" ? (
                          <ArrowUp className="size-3 text-[#007A55]" />
                        ) : (
                          <ArrowDown className="size-3 text-[#007A55]" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Discounts</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleColumnSort("netSales")}
                      className="inline-flex items-center gap-1.5 font-semibold uppercase hover:text-slate-900 focus:outline-none transition-colors ml-auto"
                      title="Sort by Net Sales"
                    >
                      Net Sales
                      {sortBy === "netSales" && (
                        sortOrder === "asc" ? (
                          <ArrowUp className="size-3 text-[#007A55]" />
                        ) : (
                          <ArrowDown className="size-3 text-[#007A55]" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">On-Hand Stock</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productsData.map((prod) => {
                  const onHand = Number(prod.totalStockOnHand || 0);
                  const available = Number(prod.totalAvailableStock || 0);
                  const isOutOfStock = available <= 0;
                  const isLowStock = available > 0 && available <= 5;

                  return (
                    <tr
                      key={`${prod.productId}_${prod.variantId || "default"}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 max-w-xs truncate">
                          {prod.productName || "Product"}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          SKU: {prod.sku || "N/A"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {Number(prod.unitsSold || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">
                        {formatCurrency(prod.grossSales)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {formatCurrency(prod.discounts)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#007A55]">
                        {formatCurrency(prod.netSales)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">
                        {Number(prod.orderCount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600">
                        {onHand.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {available.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <VendorStatusBadge status="out_of_stock" />
                        ) : isLowStock ? (
                          <VendorStatusBadge status="low_stock" />
                        ) : (
                          <VendorStatusBadge status="in_stock" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. Table Pagination */}
        {productsData.length > 0 && (
          <div className="p-4 border-t border-slate-200">
            <VendorTablePagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              pageSize={pagination.limit}
              onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
              onPageSizeChange={(sz) =>
                setPagination((prev) => ({ ...prev, limit: sz, page: 1 }))
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

