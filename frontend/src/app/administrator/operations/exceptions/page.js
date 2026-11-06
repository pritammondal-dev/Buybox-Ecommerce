"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  Building2,
  ShoppingBag,
  Package,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Ban,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";
import AdminExceptionResolutionModal from "@/components/fulfillment/AdminExceptionResolutionModal";

export default function AdminExceptionsQueuePage() {
  const [exceptions, setExceptions] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExceptionId, setSelectedExceptionId] = useState(null);

  const loadExceptions = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = {
          page,
          limit: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          reason: reasonFilter !== "all" ? reasonFilter : undefined,
          search: searchQuery.trim() || undefined,
        };

        const res = await adminOrderService.getFulfillmentExceptions(params);
        const list = res?.exceptions || res?.data?.exceptions || res?.data || [];
        setExceptions(Array.isArray(list) ? list : []);

        if (res?.meta || res?.data?.meta) {
          setMeta(res?.meta || res?.data?.meta);
        }
      } catch (err) {
        toast.error("Failed to load fulfillment exceptions", {
          description: err.response?.data?.message || err.message,
        });
        setExceptions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, reasonFilter, searchQuery]
  );

  useEffect(() => {
    loadExceptions(1);
  }, [loadExceptions]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadExceptions(1);
  };

  // Status counts for quick filter tabs and KPIs
  const openCount = exceptions.filter((e) => ["open", "under_review"].includes(e.status)).length;
  const awaitingCount = exceptions.filter((e) => e.status === "awaiting_vendor").length;
  const resolvedCount = exceptions.filter((e) => e.status === "resolved").length;

  return (
    <div className="space-y-6 p-4 sm:p-6 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/administrator/operations/orders"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Operations Orders</span>
            </Link>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="size-6 text-amber-600" />
            <span>Vendor Fulfillment Exceptions</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Authoritative operations review queue for vendor out-of-stock, damaged stock, and item cancellation requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadExceptions(1)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total in View
            </span>
            <AlertTriangle className="size-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {meta.total || exceptions.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Platform-wide exception reports</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Requires Action
            </span>
            <Clock className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2">
            {openCount}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Open or currently under review</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
              Awaiting Vendor
            </span>
            <MessageSquare className="size-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-900 mt-2">
            {awaitingCount}
          </div>
          <p className="text-[11px] text-purple-700 mt-1">Clarification sent to merchant</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Resolved
            </span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-2">
            {resolvedCount}
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">Fulfillment restored or cancelled</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          {[
            { key: "all", label: "All Exceptions" },
            { key: "open", label: "Open" },
            { key: "under_review", label: "Under Review" },
            { key: "awaiting_vendor", label: "Awaiting Vendor" },
            { key: "resolved", label: "Resolved" },
            { key: "rejected", label: "Rejected" },
            { key: "withdrawn", label: "Withdrawn" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Reason Filters */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exception #, order #, SKU, or product..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Filter className="size-3.5 text-slate-400" />
              <span>Reason:</span>
            </div>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-slate-400 cursor-pointer"
            >
              <option value="all">All Reasons</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="damaged_stock">Damaged Stock</option>
              <option value="incorrect_sku_or_variant">Incorrect SKU / Variant</option>
              <option value="cannot_pack_or_ship">Cannot Pack / Ship</option>
              <option value="warehouse_discrepancy">Warehouse Discrepancy</option>
              <option value="other">Other / Custom</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Exceptions Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Exception / Date</th>
                <th className="px-6 py-3.5">Order Info</th>
                <th className="px-6 py-3.5">Vendor</th>
                <th className="px-6 py-3.5">Item &amp; Qty</th>
                <th className="px-6 py-3.5">Reason &amp; Request</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-slate-400" />
                      <span>Loading fulfillment exceptions queue...</span>
                    </div>
                  </td>
                </tr>
              ) : exceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <p className="font-semibold text-slate-800">No fulfillment exceptions found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {statusFilter !== "all" || reasonFilter !== "all" || searchQuery
                        ? "Try adjusting your filters or search criteria."
                        : "All vendor fulfillment operations are running cleanly without reported issues."}
                    </p>
                  </td>
                </tr>
              ) : (
                exceptions.map((exc) => {
                  const item = exc.itemSnapshot || {};
                  const vendor = exc.vendorId || {};
                  const order = exc.orderId || {};

                  return (
                    <tr key={exc._id || exc.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Exception Number & Created Date */}
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">
                          {exc.exceptionNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="size-3 text-slate-400" />
                          <span>
                            {exc.createdAt
                              ? new Date(exc.createdAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Order Number & Customer */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <ShoppingBag className="size-3.5 text-slate-400" />
                          <span>{order.orderNumber || exc.orderNumber || "Order"}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Total: ₹{Number(order.grandTotal || 0).toFixed(2)}
                        </div>
                      </td>

                      {/* Vendor Store */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1">
                          <Building2 className="size-3.5 text-emerald-700" />
                          <span>
                            {vendor.storeName || vendor.businessName || "Vendor"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {vendor.email || ""}
                        </div>
                      </td>

                      {/* Product & Qty */}
                      <td className="px-6 py-4 max-w-[200px]">
                        <div className="font-bold text-slate-900 truncate">
                          {item.productName || item.sku}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">SKU: {item.sku}</span>
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                            Qty: {exc.affectedQuantity} / {item.quantity}
                          </span>
                        </div>
                      </td>

                      {/* Reason & Resolution */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 capitalize">
                          {exc.reason?.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          Resolution: {exc.requestedResolution?.replace(/_/g, " ")}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            exc.status === "open"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : exc.status === "under_review"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : exc.status === "awaiting_vendor"
                              ? "bg-purple-50 text-purple-700 border-purple-200 animate-pulse"
                              : exc.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : exc.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {exc.status.replace("_", " ")}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedExceptionId(exc._id || exc.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <Eye className="size-3" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Resolution & Cancellation Approval Modal */}
      {selectedExceptionId && (
        <AdminExceptionResolutionModal
          isOpen={Boolean(selectedExceptionId)}
          onClose={() => setSelectedExceptionId(null)}
          exceptionId={selectedExceptionId}
          onUpdate={async () => {
            await loadExceptions(meta.page);
          }}
        />
      )}
    </div>
  );
}
