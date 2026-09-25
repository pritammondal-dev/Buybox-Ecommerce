"use client";

import React, { useEffect, useState } from "react";
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
  ShieldAlert,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { dashboardService } from "@/services/admin/admin.service.js";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardService.getStats();
      setData(result);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load dashboard metrics"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const kpis = data?.kpis || {};

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Marketplace Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time platform metrics, transactions, and fulfillment operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* 17 Real KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Total Customers */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Customers</span>
            <Users className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.totalCustomers ?? 0)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {kpis.activeCustomers ?? 0} active
          </div>
        </div>

        {/* Vendors */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Vendors</span>
            <Building2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.totalVendors ?? 0)}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {kpis.pendingVendors ?? 0} pending review
          </div>
        </div>

        {/* Products */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Catalog Items</span>
            <Package className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.totalProducts ?? 0)}
          </div>
          <div className="text-[11px] text-amber-600 font-medium">
            {kpis.pendingProducts ?? 0} pending moderation
          </div>
        </div>

        {/* Orders */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Orders</span>
            <ShoppingBag className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.totalOrders ?? 0)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {kpis.pendingOrders ?? 0} pending fulfillment
          </div>
        </div>

        {/* GMV */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>GMV</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? "..." : formatCurrency(kpis.gmv)}
          </div>
          <div className="text-[11px] text-slate-500">Gross order value</div>
        </div>

        {/* Revenue */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Captured Revenue</span>
            <CreditCard className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? "..." : formatCurrency(kpis.revenue)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Paid orders</div>
        </div>

        {/* Commission */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Platform Take</span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {loading ? "..." : formatCurrency(kpis.commission)}
          </div>
          <div className="text-[11px] text-slate-500">Estimated commission</div>
        </div>

        {/* Refunds */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Refunds</span>
            <RotateCcw className="size-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-rose-700 truncate">
            {loading ? "..." : formatCurrency(kpis.refunds)}
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
            {loading ? "..." : (kpis.vendorSettlements ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500">Periods pending</div>
        </div>

        {/* Low Stock */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Low Stock</span>
            <Warehouse className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {loading ? "..." : (kpis.lowStock ?? 0)}
          </div>
          <div className="text-[11px] text-amber-700">Needs replenishment</div>
        </div>

        {/* Pending Returns */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Returns Queue</span>
            <RotateCcw className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.pendingReturns ?? 0)}
          </div>
          <div className="text-[11px] text-amber-600">Pending review</div>
        </div>

        {/* Open Support Tickets */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Support Tickets</span>
            <Headphones className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {loading ? "..." : (kpis.openSupportTickets ?? 0)}
          </div>
          <div className="text-[11px] text-emerald-600">Active inquiries</div>
        </div>
      </div>

      {/* Two Column Section: Recent Orders & Recent Vendor Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
            <Link
              href="/admin/operations/orders"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.recentOrders?.length > 0 ? (
              data.recentOrders.map((ord) => (
                <div
                  key={ord._id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900">
                      {ord.orderNumber}
                    </span>
                    <div className="text-slate-400 text-[11px]">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="font-bold text-slate-900">
                      {formatCurrency(parseFloat(ord.grandTotal?.toString() || 0))}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        ord.paymentStatus === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No orders recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Pending Vendor Approvals */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Vendor Onboarding Queue
            </h2>
            <Link
              href="/admin/vendors"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>Review queue</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.recentVendors?.length > 0 ? (
              data.recentVendors.map((ven) => (
                <div
                  key={ven._id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-900">
                      {ven.businessName}
                    </span>
                    <div className="text-slate-400 text-[11px]">
                      {ven.businessSlug}
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
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No vendor submissions yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Audit Trail */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Recent Audit &amp; Governance Events
          </h2>
          <Link
            href="/admin/security/audit-logs"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Full audit trail</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {data?.recentActivity?.length > 0 ? (
            data.recentActivity.map((log) => (
              <div
                key={log._id}
                className="py-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {log.actorId?.firstName?.[0] || "A"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">
                      {log.actorId?.firstName} {log.actorId?.lastName}
                    </span>
                    <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                      ({log.action})
                    </span>
                    <div className="text-[11px] text-slate-500">
                      Target: {log.entityType}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Clock className="size-3" />
                  <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs">
              No audit logs recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
