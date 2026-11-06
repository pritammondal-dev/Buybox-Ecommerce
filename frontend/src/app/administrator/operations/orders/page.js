"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  Users,
  CreditCard,
  Download,
  ChevronDown,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";
import { triggerBlobDownload } from "@/utils/fileDownload";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [triageFilter, setTriageFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedOrderForSlip, setSelectedOrderForSlip] = useState(null);

  const loadOrders = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await adminOrderService.getOrders({
        page,
        limit: 20,
        status: statusFilter !== "all" ? statusFilter : undefined,
        triageFilter: triageFilter !== "all" ? triageFilter : undefined,
        search: searchQuery.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });

      const list = res?.data || res?.items || [];
      setOrders(Array.isArray(list) ? list : []);
      if (res?.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      toast.error("Failed to load platform orders", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(1);
  }, [statusFilter, triageFilter, sortBy, sortOrder, dateFrom, dateTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadOrders(1);
  };

  const handleExportOrders = async (format = "csv") => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const res = await adminOrderService.exportOrders({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      }, format);
      triggerBlobDownload(res, `buybox_orders_${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`Orders exported successfully (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to export orders", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportItems = async (format = "csv") => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const res = await adminOrderService.exportOrderItems({
        status: statusFilter !== "all" ? statusFilter : undefined,
      }, format);
      triggerBlobDownload(res, `buybox_order_items_${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`Order items exported successfully (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to export order items", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const totalGMV = orders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Platform Orders & Fulfillment
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Marketplace-wide customer orders, multi-vendor splits, fulfillment states, and payment audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Exceptions Queue Shortcut */}
          <Link
            href="/administrator/operations/exceptions"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <AlertCircle className="size-3.5 text-amber-600" />
            <span>Exceptions Queue</span>
          </Link>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="size-3.5" />
              <span>{isExporting ? "Exporting..." : "Export"}</span>
              <ChevronDown className="size-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-20 text-xs font-medium text-slate-700">
                <button
                  onClick={() => handleExportOrders("csv")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Orders</span>
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">CSV</span>
                </button>
                <button
                  onClick={() => handleExportOrders("xlsx")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Orders</span>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">XLSX</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => handleExportItems("csv")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Order Items</span>
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">CSV</span>
                </button>
                <button
                  onClick={() => handleExportItems("xlsx")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Order Items</span>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">XLSX</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => loadOrders(meta.page)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <ShoppingBag className="size-3.5" />
            <span>Total Orders</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{meta.total}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Truck className="size-3.5" />
            <span>Fulfillment Filter</span>
          </div>
          <div className="text-2xl font-black text-[#004D38] capitalize">{statusFilter}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <CreditCard className="size-3.5" />
            <span>Page GMV Subtotal</span>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalGMV.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filters, Search, Date Range & Sorting */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer, phone, city..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
              <span className="text-[10px] uppercase font-bold text-slate-400 ml-1">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-xs text-slate-700 focus:outline-none"
              />
            </div>

            {/* Sort Selector */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-[#004D38] focus:outline-none cursor-pointer"
            >
              <option value="createdAt:desc">Placed: Newest First</option>
              <option value="createdAt:asc">Placed: Oldest First</option>
              <option value="grandTotal:desc">Total: High to Low</option>
              <option value="grandTotal:asc">Total: Low to High</option>
              <option value="status:asc">Status: A to Z</option>
            </select>

            {(searchQuery || statusFilter !== "all" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
          {[
            "all",
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "completed",
            "cancelled",
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? "bg-[#004D38] text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Fulfillment SLA & Triage Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Vendor SLA Triage:
          </span>
          {[
            { id: "all", label: "All SLAs" },
            { id: "intervention_required", label: "⚠️ Intervention Required" },
            { id: "sla_breached", label: "🔴 SLA Breached" },
            { id: "pending_acceptance", label: "⏳ Awaiting Acceptance" },
            { id: "acceptance_overdue", label: "⏰ Acceptance Overdue (>24h)" },
            { id: "confirmation_overdue", label: "📦 Confirmation Overdue (>48h)" },
          ].map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTriageFilter(tf.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                triageFilter === tf.id
                  ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <ShoppingBag className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Orders Found</h4>
            <p className="text-xs text-slate-500 mt-1">
              No orders matched the specified filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5 text-center">Vendors</th>
                  <th className="px-6 py-3.5 text-center">Items</th>
                  <th className="px-6 py-3.5">Order Status</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-6 py-3.5 text-right">Grand Total</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-900">
                        {o.orderNumber || o.secureId}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.placedAt ? new Date(o.placedAt).toLocaleDateString("en-IN") : "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {o.customer?.name || "Customer"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {o.customer?.email || o.customer?.phone || ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {o.vendorCount || 1}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-600">
                      {o.itemCount || 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          o.status === "delivered" || o.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : o.status === "cancelled"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {o.status}
                        </span>
                        {o.hasVendorRejection ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                            Rejection Pending
                          </span>
                        ) : o.triage?.isOverdue ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                            Overdue (+{o.triage.hoursOverdue}h)
                          </span>
                        ) : o.triage?.stage === "pending_acceptance" ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            Awaiting Accept
                          </span>
                        ) : null}
                        {o.deliveryOptionName && (
                          <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <Truck className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[110px]">{o.deliveryOptionName}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          o.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : o.paymentStatus === "refunded"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {o.paymentStatus}
                        </span>
                        {o.paymentMethod && (
                          <span className="font-mono text-[10px] text-slate-500 uppercase font-semibold">
                            {o.paymentMethod}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      ₹{Number(o.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForSlip(o.orderNumber || o.secureId || o._id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200/80 transition-colors cursor-pointer"
                          title="Print Packing Slip"
                        >
                          <Printer className="size-3.5" />
                          <span>Slip</span>
                        </button>
                        <Link
                          href={`/administrator/operations/orders/${o.secureId || o._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                        >
                          <Eye className="size-3.5" />
                          <span>Inspect</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {meta.total > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing{" "}
              <strong className="text-slate-900">
                {(meta.page - 1) * meta.limit + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900">
                {Math.min(meta.page * meta.limit, meta.total)}
              </strong>{" "}
              of <strong className="text-slate-900">{meta.total}</strong> orders
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1 || isLoading}
                onClick={() => loadOrders(meta.page - 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>

              <span className="font-semibold text-slate-800 px-1">
                Page {meta.page} of {meta.totalPages || 1}
              </span>

              <button
                type="button"
                disabled={meta.page >= meta.totalPages || isLoading}
                onClick={() => loadOrders(meta.page + 1)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Packing Slip Modal */}
      {selectedOrderForSlip && (
        <PackingSlipModal
          isOpen={Boolean(selectedOrderForSlip)}
          orderId={selectedOrderForSlip}
          onClose={() => setSelectedOrderForSlip(null)}
        />
      )}
    </div>
  );
}
