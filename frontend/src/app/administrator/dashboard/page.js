"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Package,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  RotateCcw,
  Headphones,
  Warehouse,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  Clock,
  Calendar,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { dashboardService } from "@/services/admin/admin.service.js";

const DATE_RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("30d");
  const [chartMetric, setChartMetric] = useState("sales"); // "sales" | "orders"

  const fetchStats = useCallback(
    async (isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await dashboardService.getStats({ range });
        setData(result);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to load dashboard metrics"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = useMemo(() => data?.kpis || {}, [data]);
  const periodMetrics = useMemo(() => data?.periodMetrics || {}, [data]);
  const trends = useMemo(() => data?.trends || [], [data]);
  const recentOrders = useMemo(() => data?.recentOrders || [], [data]);
  const recentVendors = useMemo(() => data?.recentVendors || [], [data]);
  const recentActivity = useMemo(() => data?.recentActivity || [], [data]);
  const authorizedSections = useMemo(() => data?.authorizedSections || {}, [data]);

  const formatCurrency = useCallback((val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  }, []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, []);

  const formatTime = useCallback((dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Compute peak value and aggregate for trends visualizer
  const trendAnalysis = useMemo(() => {
    if (!trends || trends.length === 0) {
      return { maxVal: 1, totalSales: 0, totalOrders: 0, avgDailySales: 0 };
    }
    const totalSales = trends.reduce((acc, t) => acc + (t.sales || 0), 0);
    const totalOrders = trends.reduce((acc, t) => acc + (t.orders || 0), 0);
    const avgDailySales = trends.length > 0 ? totalSales / trends.length : 0;
    const maxVal = Math.max(
      ...trends.map((t) => (chartMetric === "sales" ? t.sales || 0 : t.orders || 0)),
      chartMetric === "sales" ? 100 : 5
    );
    return { maxVal, totalSales, totalOrders, avgDailySales };
  }, [trends, chartMetric]);

  return (
    <div className="space-y-6">
      {/* Top Header Banner & Filter Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Marketplace Overview
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live DB
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative platform metrics, sales analytics, and fulfillment operations
          </p>
        </div>

        {/* Dynamic Date Filter and Live Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs font-semibold text-slate-700">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRange(opt.id)}
                disabled={loading || refreshing}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  range === opt.id
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchStats(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh current data from server"
          >
            <RefreshCw
              className={`size-3.5 ${refreshing || loading ? "animate-spin text-emerald-600" : ""}`}
            />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            className="px-3 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Grid (12 Authoritative Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Captured Revenue */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Captured Revenue</span>
            <CreditCard className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? (
              <span className="inline-block w-20 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              formatCurrency(periodMetrics.revenue ?? kpis.revenue)
            )}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            Paid orders in {range}
          </div>
        </div>

        {/* Gross Merchandise Value (GMV) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>GMV</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? (
              <span className="inline-block w-20 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              formatCurrency(periodMetrics.gmv ?? kpis.gmv)
            )}
          </div>
          <div className="text-[11px] text-slate-500">Gross order value</div>
        </div>

        {/* Orders in Period */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Orders</span>
            <ShoppingBag className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              periodMetrics.orders ?? kpis.totalOrders ?? 0
            )}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {kpis.pendingOrders ?? 0} pending fulfillment
          </div>
        </div>

        {/* Platform Take / Commission */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Platform Take</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? (
              <span className="inline-block w-20 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              formatCurrency(periodMetrics.commission ?? kpis.commission)
            )}
          </div>
          <div className="text-[11px] text-slate-500">Estimated commission</div>
        </div>

        {/* Customers */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Customers</span>
            <Users className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.totalCustomers ?? 0
            )}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            +{periodMetrics.newCustomers ?? 0} new in {range}
          </div>
        </div>

        {/* Vendors */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Vendors</span>
            <Building2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.totalVendors ?? 0
            )}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {kpis.pendingVendors ?? 0} pending review
          </div>
        </div>

        {/* Catalog Items */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Catalog Items</span>
            <Package className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.totalProducts ?? 0
            )}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {kpis.pendingProducts ?? 0} pending review
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Low Stock</span>
            <Warehouse className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.lowStock ?? 0
            )}
          </div>
          <div className="text-[11px] text-amber-700">Needs replenishment</div>
        </div>

        {/* Returns Queue */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Returns Queue</span>
            <RotateCcw className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.pendingReturns ?? 0
            )}
          </div>
          <div className="text-[11px] text-amber-600">Pending RMA review</div>
        </div>

        {/* Refunds Issued */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Refunds</span>
            <RotateCcw className="size-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700 truncate">
            {loading ? (
              <span className="inline-block w-20 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              formatCurrency(periodMetrics.refunds ?? kpis.refunds)
            )}
          </div>
          <div className="text-[11px] text-rose-600">Issued refunds</div>
        </div>

        {/* Vendor Settlements */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Settlements</span>
            <Building2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.vendorSettlements ?? 0
            )}
          </div>
          <div className="text-[11px] text-slate-500">Periods pending</div>
        </div>

        {/* Open Support Tickets */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Support Tickets</span>
            <Headphones className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? (
              <span className="inline-block w-12 h-6 bg-slate-200 animate-pulse rounded" />
            ) : (
              kpis.openSupportTickets ?? 0
            )}
          </div>
          <div className="text-[11px] text-emerald-600">Active inquiries</div>
        </div>
      </div>

      {/* Sales & Orders Trend Visualizer (Phase B & C) */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                {chartMetric === "sales" ? "Revenue & Sales Trajectory" : "Order Volume Trajectory"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative daily transaction aggregations across {trends.length} days ({range})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setChartMetric("sales")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMetric === "sales"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Revenue (₹)
              </button>
              <button
                onClick={() => setChartMetric("orders")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  chartMetric === "orders"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Orders Count
              </button>
            </div>
          </div>
        </div>

        {/* Time-Series Continuous Bar Visualization */}
        <div className="pt-2">
          {loading ? (
            <div className="h-48 w-full bg-slate-100/70 rounded-2xl animate-pulse flex items-center justify-center text-xs text-slate-400">
              Aggregating timeline points...
            </div>
          ) : trends.length === 0 ? (
            <div className="h-48 w-full border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs">
              <Calendar className="size-6 text-slate-300 mb-1" />
              <span>No recorded transactions in this timeframe</span>
            </div>
          ) : (
            <div>
              <div className="h-48 flex items-end gap-1 sm:gap-2 pt-6 pb-2 border-b border-slate-100">
                {trends.map((pt, idx) => {
                  const val = chartMetric === "sales" ? pt.sales || 0 : pt.orders || 0;
                  const heightPercent = Math.max(
                    Math.round((val / trendAnalysis.maxVal) * 100),
                    val > 0 ? 8 : 2
                  );
                  return (
                    <div
                      key={pt.date || idx}
                      className="flex-1 flex flex-col items-center group relative h-full justify-end"
                    >
                      {/* Hover Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 bg-slate-900 text-white text-[11px] py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-xl z-20 transition-all duration-150">
                        <div className="font-semibold">{formatDate(pt.date)}</div>
                        <div className="text-emerald-400 font-bold">{formatCurrency(pt.sales)}</div>
                        <div className="text-slate-300 text-[10px]">{pt.orders} orders • {pt.newCustomers || 0} signups</div>
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all duration-200 ${
                          val > 0
                            ? chartMetric === "sales"
                              ? "bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                              : "bg-blue-600 hover:bg-blue-700 shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Trend Timeline X-Axis Boundaries */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 font-medium">
                <span>{formatDate(trends[0]?.date)}</span>
                <span className="hidden sm:inline">
                  Average: {formatCurrency(trendAnalysis.avgDailySales)}/day
                </span>
                <span>{formatDate(trends[trends.length - 1]?.date)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Operational Summary Quick-Queue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Fulfillment Dispatch Queue */}
        <Link
          href="/administrator/operations/orders"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Fulfillment
            </span>
            <div className="text-2xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              {kpis.pendingOrders ?? 0}
            </div>
            <p className="text-[11px] text-slate-400">Orders requiring dispatch</p>
          </div>
          <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Vendor Onboarding Queue */}
        <Link
          href="/administrator/vendors"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Vendor Review Queue
            </span>
            <div className="text-2xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              {kpis.pendingVendors ?? 0}
            </div>
            <p className="text-[11px] text-slate-400">Applications awaiting KYC</p>
          </div>
          <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Low Stock Attention */}
        <Link
          href="/administrator/inventory/stock"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className={`text-2xl font-bold ${
              (kpis.lowStock || 0) > 0 ? "text-amber-600" : "text-slate-900"
            }`}>
              {kpis.lowStock ?? 0}
            </div>
            <p className="text-[11px] text-slate-400">Variants below threshold</p>
          </div>
          <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Customer Returns Queue */}
        <Link
          href="/administrator/operations/orders"
          className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Returns &amp; RMAs
            </span>
            <div className="text-2xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              {kpis.pendingReturns ?? 0}
            </div>
            <p className="text-[11px] text-slate-400">Pending return decisions</p>
          </div>
          <ChevronRight className="size-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Two Column Grid: Recent Orders & Vendor Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Customer Orders</h2>
              <p className="text-xs text-slate-400">Latest platform purchase transactions</p>
            </div>
            <Link
              href="/administrator/operations/orders"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View all orders</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOrders.length > 0 ? (
              recentOrders.map((ord) => (
                <Link
                  key={ord._id}
                  href={`/administrator/operations/orders/${ord._id}`}
                  className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 font-mono">
                        {ord.orderNumber}
                      </span>
                      {ord.customerId?.firstName && (
                        <span className="text-slate-500 text-[11px]">
                          • {ord.customerId.firstName} {ord.customerId.lastName}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {formatDate(ord.createdAt)} at {formatTime(ord.createdAt)}
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="font-bold text-slate-900">
                      {formatCurrency(parseFloat(ord.grandTotal?.toString() || 0))}
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ord.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {ord.paymentStatus || "unpaid"}
                      </span>
                      <span className="text-slate-400 text-[10px] font-medium capitalize">
                        {ord.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No orders recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Vendor Onboarding Applications */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Vendor Onboarding Queue</h2>
              <p className="text-xs text-slate-400">Applications awaiting partner approval</p>
            </div>
            <Link
              href="/administrator/vendors"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Review vendors</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentVendors.length > 0 ? (
              recentVendors.map((ven) => (
                <Link
                  key={ven._id}
                  href={`/administrator/vendors/${ven._id}`}
                  className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900">
                      {ven.businessName}
                    </span>
                    <div className="text-slate-400 text-[11px]">
                      slug: {ven.businessSlug} {ven.email ? `• ${ven.email}` : ""}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                      ven.onboardingStatus === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : ven.onboardingStatus === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {ven.onboardingStatus}
                  </span>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No vendor submissions yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Audit & Governance Activity Trail */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Audit &amp; Governance Activity Trail
            </h2>
            <p className="text-xs text-slate-400">Recent security and administrative mutations</p>
          </div>
          <Link
            href="/administrator/security/audit-logs"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Full audit log</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivity.length > 0 ? (
            recentActivity.map((log) => (
              <div
                key={log._id}
                className="py-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                    {log.actorId?.firstName?.[0] || "A"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {log.actorId?.firstName || "System"} {log.actorId?.lastName || ""}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        ({log.action})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Entity: <span className="font-mono">{log.entityType}</span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="size-3 text-slate-400" />
                  <span>{formatDate(log.createdAt)} {formatTime(log.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No audit log entries recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
