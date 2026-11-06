"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorOrderUrl } from "@/utils/secure-id.util";
import { triggerBlobDownload } from "@/utils/fileDownload";
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import {
  VendorPageHeader,
  VendorStatusBadge,
  VendorEmptyState,
} from "@/components/vendor";

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  const handleExport = async (type = "orders", format = "csv") => {
    try {
      setIsExporting(true);
      setShowExportDropdown(false);
      const params = { format };
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = type === "items"
        ? await vendorService.exportMyOrderItems(params)
        : await vendorService.exportMyOrders(params);

      const ext = format === "xlsx" ? "xlsx" : "csv";
      triggerBlobDownload(res, `vendor-${type}-${new Date().toISOString().slice(0, 10)}.${ext}`);
      toast.success(`Exported vendor ${type} (${format.toUpperCase()}) successfully`);
    } catch (err) {
      toast.error("Export failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const params = { page, limit };
    if (status !== "all") params.status = status;
    if (search.trim()) params.search = search.trim();

    vendorService
      .getMyOrders(params)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.orders || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        const paginationMeta = res?.data?.meta || {
          page,
          limit,
          total: items.length,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
        setOrders(items);
        setMeta(paginationMeta);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setOrders([]);
          setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
          return;
        }
        toast.error("Failed to fetch customer orders", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [status, search, page, limit]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit };
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.getMyOrders(params);
      const data = res?.data?.data || res?.data?.orders || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      const paginationMeta = res?.data?.meta || {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
      };
      setOrders(items);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setOrders([]);
        setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
        return;
      }
      toast.error("Failed to fetch customer orders", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <VendorPageHeader
        title="Customer Orders"
        subtitle="Marketplace orders containing your products, strictly scoped to your tenant line items and payouts."
        breadcrumbs={[{ label: "Orders" }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw className="size-3.5" />
              <span>Refresh Orders</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportDropdown((prev) => !prev)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-700 bg-[#004D38] text-white hover:bg-[#003d2c] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span>{isExporting ? "Exporting..." : "Export"}</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </button>

              {showExportDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Scoped Orders
                    </div>
                    <button
                      onClick={() => handleExport("orders", "csv")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileText className="size-3.5 text-emerald-600" />
                      <span>Orders Summary (CSV)</span>
                    </button>
                    <button
                      onClick={() => handleExport("orders", "xlsx")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="size-3.5 text-blue-600" />
                      <span>Orders Summary (XLSX)</span>
                    </button>

                    <div className="border-t border-slate-100 my-1" />
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Scoped Line Items
                    </div>
                    <button
                      onClick={() => handleExport("items", "csv")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileText className="size-3.5 text-emerald-600" />
                      <span>Order Items (CSV)</span>
                    </button>
                    <button
                      onClick={() => handleExport("items", "xlsx")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="size-3.5 text-blue-600" />
                      <span>Order Items (XLSX)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by order number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "confirmed", label: "Confirmed" },
            { id: "processing", label: "Processing" },
            { id: "fulfilled", label: "Fulfilled" },
            { id: "cancelled", label: "Cancelled" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStatus(s.id);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                status === s.id
                  ? "bg-[#004D38] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <VendorEmptyState
            icon={ShoppingBag}
            title={search || status !== "all" ? "No Orders Found" : "No Orders Yet"}
            description={
              search || status !== "all"
                ? "No customer orders match your selected filters."
                : "When customers order products from your catalog, they will be listed here."
            }
            action={
              search || status !== "all"
                ? {
                    label: "Clear Filters",
                    onClick: () => {
                      setSearch("");
                      setStatus("all");
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Destination</th>
                  <th className="px-6 py-3.5">Your Items</th>
                  <th className="px-6 py-3.5">Fulfillment</th>
                  <th className="px-6 py-3.5 text-right">Vendor Subtotal</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const secureUrl = getVendorOrderUrl(order.secureId || order._id);
                  const address = order.shippingAddress || {};
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
                        <div>{[address.city, address.state].filter(Boolean).join(", ") || "India"}</div>
                        <div className="text-[11px] text-slate-400">{address.postalCode}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <span className="font-semibold">{itemCount}</span> line item{itemCount > 1 ? "s" : ""}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <VendorStatusBadge status={order.fulfillmentStatus || order.status} entityType="order" />
                          {order.vendorFulfillment?.acceptanceStatus && (
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                order.vendorFulfillment.acceptanceStatus === "accepted"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : order.vendorFulfillment.acceptanceStatus === "rejected"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {order.vendorFulfillment.acceptanceStatus === "pending"
                                ? "Action Required"
                                : `Acceptance: ${order.vendorFulfillment.acceptanceStatus}`}
                            </span>
                          )}
                        </div>
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

            {/* Pagination */}
            <VendorTablePagination
              page={page}
              limit={limit}
              total={meta?.total ?? orders.length}
              totalPages={meta?.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              isLoading={isLoading}
              itemLabel="orders"
            />
          </div>
        )}
      </div>
    </div>
  );
}
