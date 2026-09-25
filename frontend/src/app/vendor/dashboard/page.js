"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  RotateCcw,
  Wallet,
  TrendingUp,
  Boxes,
  Clock,
  ArrowUpRight,
  ChevronRight,
  RefreshCw,
  Plus,
  Truck,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { vendorService } from "@/services/vendor.service";
import { getVendorOrderUrl, getVendorInventoryUrl } from "@/utils/secure-id.util";

export default function VendorDashboardPage() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState(null);
  const [range, setRange] = useState("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onboardingStatus = analytics?.vendor?.onboardingStatus || "approved";

  const getPendingAnalyticsFallback = (selectedRange, vendorProfile = null) => {
    const status = vendorProfile?.onboardingStatus || "pending";
    let alertItem;

    if (status === "changes_requested") {
      alertItem = {
        type: "warning",
        title: "Action Required: Information Requested",
        message: `The marketplace operations team requested changes: "${vendorProfile?.changesRequestedReason || "Please review and resubmit your details."}"`,
        actionUrl: "/vendor/store",
        actionLabel: "Update & Resubmit",
      };
    } else if (status === "rejected") {
      alertItem = {
        type: "destructive",
        title: "Application Not Approved",
        message: `Review decision notes: "${vendorProfile?.rejectionReason || "Application did not meet marketplace requirements."}"`,
        actionUrl: "/vendor/store",
        actionLabel: "View Store Details",
      };
    } else {
      alertItem = {
        type: "warning",
        title: "Application Under Review",
        message:
          "Your merchant application is currently pending marketplace operational review. Live metrics, inventory calculations, and customer orders will become active upon approval.",
        actionUrl: "/vendor/store",
        actionLabel: "View Store Details",
      };
    }

    return {
      vendor: {
        onboardingStatus: status,
        changesRequestedReason: vendorProfile?.changesRequestedReason,
        rejectionReason: vendorProfile?.rejectionReason,
      },
      metrics: {
        totalSales: "0.00",
        todaySales: "0.00",
        ordersCount: 0,
        pendingOrdersCount: 0,
        productsCount: 0,
        activeProductsCount: 0,
        lowStockCount: 0,
        pendingReturnsCount: 0,
        pendingSettlementsCount: 0,
        pendingSettlementAmount: "0.00",
        totalStockOnHand: 0,
      },
      range: selectedRange,
      salesTrends: [],
      recentOrders: [],
      alerts: [alertItem],
      lowStockAlerts: [],
      recentReturns: [],
    };
  };

  const isNotApprovedError = (err) => {
    return (
      err?.code === "VENDOR_ONBOARDING_NOT_APPROVED" ||
      err?.status === 403 ||
      err?.status === 404 ||
      err?.response?.data?.code === "VENDOR_ONBOARDING_NOT_APPROVED" ||
      err?.response?.status === 403 ||
      err?.response?.status === 404
    );
  };

  useEffect(() => {
    let isMounted = true;
    vendorService
      .getDashboardAnalytics({ range })
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data;
        setAnalytics(data);
      })
      .catch(async (err) => {
        if (!isMounted) return;
        if (isNotApprovedError(err)) {
          try {
            const profileRes = await vendorService.getMyProfile();
            const profile = profileRes?.data?.data?.vendor || profileRes?.data?.vendor || profileRes?.data;
            if (isMounted) {
              setAnalytics(getPendingAnalyticsFallback(range, profile));
            }
          } catch {
            if (isMounted) {
              setAnalytics(getPendingAnalyticsFallback(range));
            }
          }
          return;
        }
        toast.error("Failed to load dashboard metrics", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [range]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await vendorService.getDashboardAnalytics({ range });
      const data = res?.data?.data || res?.data;
      setAnalytics(data);
    } catch (err) {
      if (isNotApprovedError(err)) {
        setAnalytics(getPendingAnalyticsFallback(range));
        return;
      }
      toast.error("Failed to refresh metrics", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (user && user.role === "customer") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-44 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-9 w-32 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-2xl animate-pulse" />
          <div className="h-72 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const metrics = analytics?.metrics || {};
  const alerts = analytics?.alerts || [];
  const recentOrders = analytics?.recentOrders || [];
  const salesTrends = analytics?.salesTrends || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Store Performance Overview
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time analytics and inventory health calculated directly from live marketplace database records.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Time Range Selector */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {[
              { id: "today", label: "Today" },
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "90d", label: "90 Days" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setRange(t.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  range === t.id
                    ? "bg-[#004D38] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh Live Data"
            aria-label="Refresh live metrics"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Actionable Live Alerts (if any) */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alert, idx) => {
            const isWarning = alert.type === "warning";
            const isDestructive = alert.type === "destructive";
            return (
              <div
                key={idx}
                className={`flex items-start justify-between gap-3 p-4 rounded-2xl border transition-all ${
                  isDestructive
                    ? "bg-rose-50/80 border-rose-200 text-rose-950"
                    : isWarning
                    ? "bg-amber-50/80 border-amber-200 text-amber-950"
                    : "bg-blue-50/80 border-blue-200 text-blue-950"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isDestructive
                        ? "bg-rose-100 text-rose-700"
                        : isWarning
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    <AlertTriangle className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold truncate">{alert.title}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      {alert.message}
                    </p>
                  </div>
                </div>

                {alert.actionUrl && (
                  <Link
                    href={alert.actionUrl}
                    className="shrink-0 text-xs font-bold underline hover:opacity-80 flex items-center gap-0.5"
                  >
                    <span>{alert.actionLabel || "Resolve"}</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Live KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Gross Sales
            </span>
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="size-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{Number(metrics.totalSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-emerald-700">₹{Number(metrics.todaySales || 0).toFixed(2)}</span>
            <span>earned today</span>
          </div>
        </div>

        {/* Orders Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Vendor Orders
            </span>
            <div className="size-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="size-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.ordersCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-amber-700">{metrics.pendingOrdersCount ?? 0} pending</span>
            <span>fulfillment</span>
          </div>
        </div>

        {/* Product Catalog */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Listings
            </span>
            <div className="size-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Package className="size-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.activeProductsCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>of {metrics.productsCount ?? 0} total products</span>
          </div>
        </div>

        {/* Low Stock Indicator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className={`size-9 rounded-xl flex items-center justify-center ${
              (metrics.lowStockCount || 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              <Boxes className="size-4.5" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${
            (metrics.lowStockCount || 0) > 0 ? "text-amber-700" : "text-slate-900"
          }`}>
            {metrics.lowStockCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.totalStockOnHand ?? 0} total units on hand
          </div>
        </div>

        {/* Returns */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Returns
            </span>
            <div className="size-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <RotateCcw className="size-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {metrics.pendingReturnsCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Awaiting inspection / RMA
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Payouts
            </span>
            <div className="size-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Wallet className="size-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{Number(metrics.pendingSettlementAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {metrics.pendingSettlementsCount ?? 0} pending settlements
          </div>
        </div>
      </div>

      {/* Sales Trend Bar Visual & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (Derived from real database order points) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Trend</h3>
              <p className="text-xs text-slate-500">Gross order revenue bucketed across time range</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {salesTrends.length} data points
            </span>
          </div>

          {/* Time Series visualization */}
          <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 border-b border-slate-100">
            {salesTrends.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No sales recorded in this time range.
              </div>
            ) : (
              (() => {
                const maxSale = Math.max(...salesTrends.map((s) => s.sales), 1);
                return salesTrends.map((item, i) => {
                  const heightPercent = Math.max(Math.round((item.sales / maxSale) * 100), 4);
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                    >
                      {/* Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md whitespace-nowrap shadow-md z-10 transition-opacity">
                        <div className="font-semibold">{item.date}</div>
                        <div>₹{item.sales.toFixed(2)} ({item.orders} orders)</div>
                      </div>

                      {/* Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          item.sales > 0
                            ? "bg-[#007A55] hover:bg-[#004D38]"
                            : "bg-slate-100"
                        }`}
                      />
                    </div>
                  );
                });
              })()
            )}
          </div>

          <div className="flex items-center justify-between pt-3 text-[11px] text-slate-400">
            <span>{salesTrends[0]?.date || "Start"}</span>
            <span>{salesTrends[salesTrends.length - 1]?.date || "Today"}</span>
          </div>
        </div>

        {/* Quick Operations Actions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Quick Actions</h3>
            <p className="text-xs text-slate-500">Direct shortcuts to frequent merchant workflows</p>
          </div>

          <div className="space-y-2">
            <Link
              href="/vendor/products/new"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#004D38] text-slate-800 hover:text-white transition-all group border border-slate-200/60"
            >
              <div className="flex items-center gap-2.5">
                <Plus className="size-4 text-emerald-700 group-hover:text-emerald-300" />
                <span className="text-xs font-semibold">List New Product</span>
              </div>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100" />
            </Link>

            <Link
              href="/vendor/inventory"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#004D38] text-slate-800 hover:text-white transition-all group border border-slate-200/60"
            >
              <div className="flex items-center gap-2.5">
                <Boxes className="size-4 text-emerald-700 group-hover:text-emerald-300" />
                <span className="text-xs font-semibold">Manage Stock & Warehouses</span>
              </div>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100" />
            </Link>

            <Link
              href="/vendor/orders"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#004D38] text-slate-800 hover:text-white transition-all group border border-slate-200/60"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="size-4 text-emerald-700 group-hover:text-emerald-300" />
                <span className="text-xs font-semibold">Process Customer Orders</span>
              </div>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100" />
            </Link>

            <Link
              href="/vendor/finance"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#004D38] text-slate-800 hover:text-white transition-all group border border-slate-200/60"
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="size-4 text-emerald-700 group-hover:text-emerald-300" />
                <span className="text-xs font-semibold">Settlements & Banking</span>
              </div>
              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100" />
            </Link>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200/80">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs mb-1">
              <span>Marketplace Compliance</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-snug">
              Maintain high fulfillment rates and prompt customer question responses to maximize your Buybox visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Orders Table (Using Secure IDs) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
            <p className="text-xs text-slate-500">Orders containing your products with scoped vendor line items</p>
          </div>
          <Link
            href="/vendor/orders"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>View All Orders</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="size-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No Orders Yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When customers purchase products from your catalog, your vendor-scoped line items will appear here immediately.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Vendor Items</th>
                  <th className="px-6 py-3.5">Fulfillment Status</th>
                  <th className="px-6 py-3.5 text-right">Vendor Total</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => {
                  const secureUrl = getVendorOrderUrl(order.secureId || order._id);
                  const itemCount = order.items?.length || 0;

                  return (
                    <tr key={order._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <Link href={secureUrl} className="hover:text-emerald-700 hover:underline">
                          {order.orderNumber || order.secureId}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }) : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {itemCount} line item{itemCount > 1 ? "s" : ""}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.fulfillmentStatus === "fulfilled"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : order.fulfillmentStatus === "partially_fulfilled"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {order.fulfillmentStatus || "unfulfilled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        ₹{Number(order.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={secureUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span>Manage</span>
                          <ChevronRight className="size-3" />
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
