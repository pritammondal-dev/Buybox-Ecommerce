"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Boxes,
  Package,
  TrendingUp,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  Search,
  Filter,
  Warehouse,
  ShieldCheck,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Percent,
  XCircle,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { VendorKpiCard, VendorEmptyState } from "@/components/vendor";

const PERIOD_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "this_month", label: "This Month" },
];

const RISK_BADGES = {
  critical: { bg: "bg-red-50 text-red-700 border-red-200", label: "Critical Stockout Risk" },
  warning: { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Low Cover Warning" },
  healthy: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Healthy Cover" },
  overstock: { bg: "bg-purple-50 text-purple-700 border-purple-200", label: "Overstock Risk" },
};

export default function WarehouseAnalyticsTab({ warehouses = [] }) {
  // Filters State
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [period, setPeriod] = useState("30d");
  const [riskFilter, setRiskFilter] = useState("all");

  // Loading States
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Data States
  const [overview, setOverview] = useState(null);
  const [movements, setMovements] = useState(null);
  const [aging, setAging] = useState(null);
  const [turnover, setTurnover] = useState(null);
  const [replenishment, setReplenishment] = useState(null);
  const [operations, setOperations] = useState(null);

  // Load all analytics data
  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        warehouseId: selectedWarehouse === "all" ? undefined : selectedWarehouse,
        period,
      };

      const [ovRes, mvRes, agRes, toRes, rpRes, opRes] = await Promise.all([
        vendorService.getWarehouseAnalyticsOverview(params),
        vendorService.getWarehouseMovementAnalytics(params),
        vendorService.getWarehouseInventoryAging(params),
        vendorService.getWarehouseInventoryTurnover(params),
        vendorService.getWarehouseReplenishmentIntelligence({ ...params, riskLevel: riskFilter }),
        vendorService.getWarehouseOperationsPerformance(params),
      ]);

      setOverview(ovRes);
      setMovements(mvRes);
      setAging(agRes);
      setTurnover(toRes);
      setReplenishment(rpRes);
      setOperations(opRes);
    } catch (err) {
      console.error("Failed to load warehouse analytics:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to load warehouse intelligence");
    } finally {
      setIsLoading(false);
    }
  }, [selectedWarehouse, period, riskFilter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Export handler
  const handleExport = async (format = "csv") => {
    setIsExporting(true);
    try {
      const params = {
        warehouseId: selectedWarehouse === "all" ? undefined : selectedWarehouse,
        period,
        format,
      };
      const res = await vendorService.exportWarehouseAnalytics(params);
      const blob = new Blob([res.data || res], {
        type: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `warehouse_intelligence_${period}_${new Date().toISOString().slice(0, 10)}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Warehouse intelligence report downloaded (${format.toUpperCase()})`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export warehouse analytics report");
    } finally {
      setIsExporting(false);
    }
  };

  // Max value for movement trend chart scaling
  const maxTrendVal = useMemo(() => {
    if (!movements?.dailyTrends?.length) return 100;
    const maxVal = Math.max(
      ...movements.dailyTrends.map((d) => Math.max(d.inbound || 0, d.outbound || 0, Math.abs(d.netChange || 0)))
    );
    return maxVal > 0 ? maxVal : 100;
  }, [movements]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="size-5 text-[#004D38]" />
            <span>Warehouse Intelligence &amp; Stock Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time authoritative inventory velocity, stock aging, turnover, and replenishment forecasting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Warehouse Selector */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          >
            <option value="all">All Fulfillment Centers</option>
            {warehouses.map((wh) => (
              <option key={wh._id || wh.id} value={wh._id || wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin text-[#004D38]" : ""}`} />
            <span>Refresh</span>
          </button>

          {/* Export Dropdown / Button */}
          <div className="relative inline-block text-left">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#004D38] hover:bg-[#003828] text-white transition-colors shadow-xs"
            >
              <Download className="size-3.5" />
              <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </div>

      {isLoading && !overview ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <RefreshCw className="size-8 text-[#004D38] animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Authoritative Warehouse Intelligence...</p>
          <p className="text-xs text-slate-400 mt-1">Aggregating inventory movements, aging queues, and replenishment models.</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* SECTION 1: WAREHOUSE OVERVIEW KPI CARDS                 */}
          {/* ======================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <VendorKpiCard
              title="Managed SKUs"
              value={overview?.totalSkus ?? 0}
              subtitle="Distinct stock variants"
              icon={Package}
              variant="default"
            />
            <VendorKpiCard
              title="On-Hand Units"
              value={overview?.totalOnHandUnits ?? 0}
              subtitle="Physical units stored"
              icon={Boxes}
              variant="default"
            />
            <VendorKpiCard
              title="Available for Sale"
              value={overview?.availableUnits ?? 0}
              subtitle="Unreserved sellable stock"
              icon={ShieldCheck}
              variant="teal"
            />
            <VendorKpiCard
              title="Reserved Stock"
              value={overview?.reservedUnits ?? 0}
              subtitle="Allocated to active orders"
              icon={Clock}
              variant="default"
            />
            <VendorKpiCard
              title="Non-Sellable Stock"
              value={overview?.nonSellableUnits ?? 0}
              subtitle={`Damaged: ${overview?.damagedUnits || 0} | Exp: ${overview?.expiredUnits || 0}`}
              icon={AlertCircle}
              variant={overview?.nonSellableUnits > 0 ? "rose" : "default"}
            />
            <VendorKpiCard
              title="Low Stock SKUs"
              value={overview?.lowStockSkus ?? 0}
              subtitle="At or below reorder threshold"
              icon={AlertTriangle}
              variant={overview?.lowStockSkus > 0 ? "amber" : "default"}
            />
            <VendorKpiCard
              title="Stockout SKUs"
              value={overview?.outOfStockSkus ?? 0}
              subtitle="Zero available stock"
              icon={XCircle}
              variant={overview?.outOfStockSkus > 0 ? "rose" : "default"}
            />
            <VendorKpiCard
              title="Active Nodes"
              value={overview?.totalActiveWarehouses ?? 0}
              subtitle="Warehouses holding stock"
              icon={Warehouse}
              variant="teal"
            />
            <VendorKpiCard
              title="Inventory Accuracy"
              value={overview?.latestInventoryAccuracy ? `${overview.latestInventoryAccuracy.quantityAccuracyRate}%` : "100%"}
              subtitle={overview?.latestInventoryAccuracy ? `Audit: ${overview.latestInventoryAccuracy.countNumber}` : "Baseline alignment"}
              icon={CheckCircle2}
              variant="teal"
            />
            <VendorKpiCard
              title="Retail Valuation"
              value={`₹${(overview?.totalInventoryRetailValue || 0).toLocaleString("en-IN")}`}
              subtitle="Current catalog retail value"
              icon={DollarSign}
              variant="default"
            />
          </div>

          {/* ======================================================== */}
          {/* SECTION 2: INVENTORY MOVEMENT ANALYTICS & TREND CHART    */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="size-4 text-[#004D38]" />
                  <span>Inventory Movement Trends &amp; Net Velocity</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Daily inbound stock additions versus outbound order fulfillment and adjustment trends.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-600" />
                  Inbound (Receipts)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-blue-600" />
                  Outbound (Sales)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-amber-500" />
                  Transfers
                </span>
              </div>
            </div>

            {/* Movement Summary Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Inbound Units</span>
                <span className="text-sm font-bold text-emerald-700">+{movements?.summary?.totalInboundUnits || 0}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Outbound Units</span>
                <span className="text-sm font-bold text-blue-700">-{movements?.summary?.totalOutboundUnits || 0}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Net Stock Delta</span>
                <span className={`text-sm font-bold ${(movements?.summary?.netStockChange || 0) >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {(movements?.summary?.netStockChange || 0) >= 0 ? "+" : ""}{movements?.summary?.netStockChange || 0}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Internal Transfers</span>
                <span className="text-sm font-bold text-slate-700">{movements?.summary?.transferVolumeUnits || 0} units</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Recon Adjustments</span>
                <span className="text-sm font-bold text-slate-700">{movements?.summary?.reconciliationAdjustmentUnits || 0} units</span>
              </div>
            </div>

            {/* Transfer Note Disclosure */}
            <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200/60 flex items-center gap-2 text-xs text-blue-800">
              <Info className="size-4 shrink-0 text-blue-600" />
              <span>{movements?.summary?.transferNotice || "Internal warehouse transfers are tracked separately to avoid double-counting external demand."}</span>
            </div>

            {/* Movement SVG Chart */}
            {!movements?.dailyTrends?.length ? (
              <div className="py-10">
                <VendorEmptyState
                  title="No Movement Recorded"
                  description="No stock movements, sales, or receipts were recorded in this timeframe."
                />
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                <div className="h-44 w-full flex items-end gap-1.5 sm:gap-2.5 pt-6 pb-2 border-b border-slate-200 overflow-x-auto">
                  {movements.dailyTrends.map((d, idx) => {
                    const inHeight = Math.max(4, Math.round(((d.inbound || 0) / maxTrendVal) * 100));
                    const outHeight = Math.max(4, Math.round(((d.outbound || 0) / maxTrendVal) * 100));
                    return (
                      <div
                        key={d.date || idx}
                        className="flex-1 min-w-[24px] flex flex-col items-center group relative h-full justify-end"
                      >
                        {/* Tooltip */}
                        <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded shadow-lg pointer-events-none whitespace-nowrap z-20">
                          <div className="font-bold">{d.date}</div>
                          <div className="text-emerald-300">Inbound: +{d.inbound || 0}</div>
                          <div className="text-blue-300">Outbound: -{d.outbound || 0}</div>
                          <div>Net: {d.netChange > 0 ? `+${d.netChange}` : d.netChange}</div>
                        </div>

                        {/* Dual Bar (Inbound + Outbound) */}
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            style={{ height: `${inHeight}%` }}
                            className="w-1/2 max-w-[12px] rounded-t bg-emerald-600 group-hover:bg-emerald-500 transition-all cursor-pointer"
                          />
                          <div
                            style={{ height: `${outHeight}%` }}
                            className="w-1/2 max-w-[12px] rounded-t bg-blue-600 group-hover:bg-blue-500 transition-all cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                  <span>{movements.dailyTrends[0]?.date}</span>
                  {movements.dailyTrends.length > 2 && (
                    <span>{movements.dailyTrends[Math.floor(movements.dailyTrends.length / 2)]?.date}</span>
                  )}
                  <span>{movements.dailyTrends[movements.dailyTrends.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* SECTION 3: INVENTORY AGING & SLOW-MOVING ANALYSIS        */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="size-4 text-[#004D38]" />
                  <span>Inventory Aging &amp; Shelf-Life Analysis</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Authoritative First-In, First-Out (FIFO) depletion queue breakdown across standard age brackets.
                </p>
              </div>

              <div className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                <span>Aged Stock Ratio: </span>
                <span className="font-bold">{aging?.summary?.agedStockPercentage ?? 0}%</span>
              </div>
            </div>

            {/* FIFO Methodology & Limitation Disclosure */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <Info className="size-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Methodology: {aging?.methodology}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{aging?.limitationDisclosure}</p>
              </div>
            </div>

            {/* Age Bucket KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">0–30 Days</span>
                <span className="text-xl font-bold text-emerald-950 mt-1 block">{aging?.summary?.bucket0_30 || 0}</span>
                <span className="text-[10px] text-emerald-700">Fresh inventory</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">31–60 Days</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{aging?.summary?.bucket31_60 || 0}</span>
                <span className="text-[10px] text-slate-500">Standard turnover</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">61–90 Days</span>
                <span className="text-xl font-bold text-slate-900 mt-1 block">{aging?.summary?.bucket61_90 || 0}</span>
                <span className="text-[10px] text-slate-500">Aging transition</span>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">91–180 Days</span>
                <span className="text-xl font-bold text-amber-950 mt-1 block">{aging?.summary?.bucket91_180 || 0}</span>
                <span className="text-[10px] text-amber-700">Aged inventory</span>
              </div>

              <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50">
                <span className="text-[11px] font-bold text-red-800 uppercase tracking-wider block">181+ Days</span>
                <span className="text-xl font-bold text-red-950 mt-1 block">{aging?.summary?.bucket181Plus || 0}</span>
                <span className="text-[10px] text-red-700">Critical aged stock</span>
              </div>
            </div>

            {/* Aged & Slow Moving Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">SKU &amp; Product</th>
                    <th className="py-2.5 px-3 text-right">On-Hand</th>
                    <th className="py-2.5 px-3 text-right">0–30d</th>
                    <th className="py-2.5 px-3 text-right">31–60d</th>
                    <th className="py-2.5 px-3 text-right">61–90d</th>
                    <th className="py-2.5 px-3 text-right">91–180d</th>
                    <th className="py-2.5 px-3 text-right text-red-700">181+d</th>
                    <th className="py-2.5 px-3 text-center">60d Sales</th>
                    <th className="py-2.5 px-3 text-center">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!aging?.items?.length ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No active stock matching aging criteria.
                      </td>
                    </tr>
                  ) : (
                    aging.items.slice(0, 10).map((it) => (
                      <tr key={it.inventoryId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block font-mono text-[11px]">{it.sku}</span>
                          <span className="text-slate-500 text-[11px] truncate max-w-xs block">{it.productName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{it.onHand}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{it.bucket0_30}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{it.bucket31_60}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{it.bucket61_90}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-amber-700">{it.bucket91_180}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-red-700">{it.bucket181Plus}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{it.soldLast60Days} units</td>
                        <td className="py-2.5 px-3 text-center">
                          {it.isSlowMoving ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Slow Moving
                            </span>
                          ) : it.isZeroSales ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              Zero Sales
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 4: INVENTORY TURNOVER & DIO                     */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Percent className="size-4 text-[#004D38]" />
                  <span>Stock Turnover &amp; Days Inventory Outstanding (DIO)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Cost-based inventory turnover ratio and realized stock movement velocity.
                </p>
              </div>

              <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                Period: {turnover?.days || 30} Days
              </div>
            </div>

            {/* Cost-Based Turnover Availability Alert */}
            {!turnover?.costBasedTurnoverAvailable ? (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-950">Cost-Based Turnover Metrics Unavailable</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Catalog cost price coverage is currently {turnover?.costDataCoveragePercent || 0}% (requires &ge; 80%). To prevent manufactured or misleading ratios, COGS-based turnover is withheld until purchase costs (`costPrice`) are populated.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs">
                <div>
                  <span className="text-emerald-800 block text-[11px] font-medium">Cost of Goods Sold (COGS)</span>
                  <span className="text-base font-bold text-emerald-950">₹{(turnover?.costOfGoodsSold || 0).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-emerald-800 block text-[11px] font-medium">Average Inventory Value</span>
                  <span className="text-base font-bold text-emerald-950">₹{(turnover?.averageInventoryValue || 0).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-emerald-800 block text-[11px] font-medium">Turnover Ratio</span>
                  <span className="text-base font-bold text-[#004D38]">{turnover?.turnoverRatio || 0}x</span>
                </div>
                <div>
                  <span className="text-emerald-800 block text-[11px] font-medium">Days Inventory Outstanding</span>
                  <span className="text-base font-bold text-slate-900">{turnover?.daysInventoryOutstanding ? `${turnover.daysInventoryOutstanding} days` : "N/A"}</span>
                </div>
              </div>
            )}

            {/* Realized Stock Movement Velocity (Unit-Based) */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="font-bold text-slate-800 block text-xs">Realized Movement Velocity (Physical Fulfilled Units)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block text-[11px]">Fulfilled Demand Units</span>
                  <span className="text-sm font-bold text-slate-900">{turnover?.unitMovementVelocity?.totalUnitsFulfilled || 0} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Avg On-Hand Stock</span>
                  <span className="text-sm font-bold text-slate-900">{turnover?.unitMovementVelocity?.averageOnHandUnits || 0} units</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Velocity Ratio</span>
                  <span className="text-sm font-bold text-blue-700">{turnover?.unitMovementVelocity?.velocityRatio || 0}x</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Annualized Turnover Velocity</span>
                  <span className="text-sm font-bold text-[#004D38]">{turnover?.unitMovementVelocity?.annualizedTurnoverEstimate || 0}x / year</span>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 5: DEMAND & REPLENISHMENT INTELLIGENCE           */}
          {/* ======================================================== */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="size-4 text-[#004D38]" />
                  <span>Demand &amp; Replenishment Intelligence</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Evidence-based replenishment suggestions based on {replenishment?.windowDays || 30}-day fulfilled demand, active reservations, and in-transit transfers.
                </p>
              </div>

              {/* Risk Level Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {["all", "critical", "warning", "healthy", "overstock"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiskFilter(r)}
                    className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                      riskFilter === r
                        ? "bg-[#004D38] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Replenishment Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-red-200 bg-red-50/50">
                <span className="text-slate-500 block text-[11px]">Critical Stockout</span>
                <span className="text-base font-bold text-red-700">{replenishment?.summary?.criticalRiskCount || 0} SKUs</span>
                <span className="text-[10px] text-red-600">&le; 7 days cover</span>
              </div>
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                <span className="text-slate-500 block text-[11px]">Low Stock Warning</span>
                <span className="text-base font-bold text-amber-700">{replenishment?.summary?.warningRiskCount || 0} SKUs</span>
                <span className="text-[10px] text-amber-600">8–14 days cover</span>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-slate-500 block text-[11px]">Healthy Stock</span>
                <span className="text-base font-bold text-emerald-700">{replenishment?.summary?.healthyCount || 0} SKUs</span>
                <span className="text-[10px] text-emerald-600">15–60 days cover</span>
              </div>
              <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50">
                <span className="text-slate-500 block text-[11px]">Overstock Risk</span>
                <span className="text-base font-bold text-purple-700">{replenishment?.summary?.overstockCount || 0} SKUs</span>
                <span className="text-[10px] text-purple-600">&gt; 60 days cover</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-slate-500 block text-[11px]">Recommended Reorder</span>
                <span className="text-base font-bold text-slate-900">{replenishment?.summary?.totalSuggestedReorderUnits || 0} units</span>
                <span className="text-[10px] text-slate-500">Across all catalog SKUs</span>
              </div>
            </div>

            {/* Replenishment Recommendations Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">SKU &amp; Product</th>
                    <th className="py-2.5 px-3 text-right">Available</th>
                    <th className="py-2.5 px-3 text-right">In-Transit</th>
                    <th className="py-2.5 px-3 text-right">Daily Demand</th>
                    <th className="py-2.5 px-3 text-right">Days of Cover</th>
                    <th className="py-2.5 px-3 text-center">Stockout Risk</th>
                    <th className="py-2.5 px-3 text-right">Reorder Point</th>
                    <th className="py-2.5 px-3 text-right text-emerald-800">Suggested Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!replenishment?.recommendations?.length ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No inventory records matching selected replenishment risk filter.
                      </td>
                    </tr>
                  ) : (
                    replenishment.recommendations.slice(0, 10).map((r) => {
                      const badge = RISK_BADGES[r.riskLevel] || RISK_BADGES.healthy;
                      return (
                        <tr key={r.inventoryId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block font-mono text-[11px]">{r.sku}</span>
                            <span className="text-slate-500 text-[11px] truncate max-w-xs block">{r.productName}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{r.availableStock}</td>
                          <td className="py-2.5 px-3 text-right text-blue-700 font-medium">{r.inTransitQuantity}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{r.avgDailyDemand}/day</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {r.daysOfCover >= 999 ? "∞" : `${r.daysOfCover}d`}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{r.reorderPoint}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                            {r.suggestedReorderQuantity > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">
                                +{r.suggestedReorderQuantity}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECTION 6 & 7: OPERATIONS & RECONCILIATION ACCURACY      */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Operational Performance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <ArrowRightLeft className="size-4 text-[#004D38]" />
                <span>Warehouse Operations Performance</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Inbound Receiving</span>
                  <span className="text-base font-bold text-slate-900">{operations?.receiving?.totalReceivedUnits || 0} units</span>
                  <span className="text-[10px] text-slate-500 block">
                    {operations?.receiving?.confirmedReceivingCount || 0} confirmed ASNs
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Inter-Warehouse Transfers</span>
                  <span className="text-base font-bold text-slate-900">{operations?.transfers?.totalTransferVolume || 0} units</span>
                  <span className="text-[10px] text-slate-500 block">
                    Avg transit: {operations?.transfers?.averageTransitHours ? `${operations.transfers.averageTransitHours} hrs` : "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Stock Adjustments</span>
                  <span className="text-base font-bold text-slate-900">{operations?.adjustments?.totalAdjustmentEvents || 0} events</span>
                  <span className="text-[10px] text-slate-500 block">
                    +{operations?.adjustments?.positiveAdjustmentUnits || 0} / -{operations?.adjustments?.negativeAdjustmentUnits || 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Condition Damage</span>
                  <span className="text-base font-bold text-red-700">{operations?.adjustments?.damagedMarkedUnits || 0} units</span>
                  <span className="text-[10px] text-slate-500 block">Segregated to non-sellable</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Accuracy */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <CheckCircle2 className="size-4 text-[#004D38]" />
                <span>Reconciliation &amp; Physical Audit Accuracy</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Completed Audits</span>
                  <span className="text-base font-bold text-slate-900">{operations?.reconciliation?.completedCountSessions || 0} sessions</span>
                  <span className="text-[10px] text-slate-500 block">Reconciled cycle counts</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Average SKU Accuracy</span>
                  <span className="text-base font-bold text-[#004D38]">
                    {operations?.reconciliation?.averageSkuAccuracyRate ? `${operations.reconciliation.averageSkuAccuracyRate}%` : "100%"}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Physical SKU matches</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Quantity Accuracy Rate</span>
                  <span className="text-base font-bold text-[#004D38]">
                    {operations?.reconciliation?.averageQuantityAccuracyRate ? `${operations.reconciliation.averageQuantityAccuracyRate}%` : "100%"}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Total quantity match rate</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px]">Net Audit Variance</span>
                  <span className="text-base font-bold text-slate-900">
                    {(operations?.reconciliation?.netReconciliationVarianceUnits || 0) >= 0 ? "+" : ""}
                    {operations?.reconciliation?.netReconciliationVarianceUnits || 0} units
                  </span>
                  <span className="text-[10px] text-slate-500 block">Physical delta applied</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

