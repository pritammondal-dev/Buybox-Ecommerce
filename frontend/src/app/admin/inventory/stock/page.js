"use client";

import React, { useEffect, useState } from "react";
import {
  Warehouse,
  Search,
  AlertTriangle,
  RefreshCw,
  Layers,
  CheckCircle,
} from "lucide-react";
import apiClient from "@/lib/api/axios.js";

export default function AdminInventoryStockPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  const fetchInventory = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (lowStockFilter) params.isLowStock = "true";

      const res = await apiClient.get("/inventory", { params });
      const data = res?.data?.data || res?.data || [];
      const meta = res?.data?.meta || {};
      setItems(Array.isArray(data) ? data : []);
      setPagination({
        page: meta?.page || page,
        total: meta?.total || 0,
        totalPages: meta?.totalPages || 1,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load inventory stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory(1);
  }, [lowStockFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Warehouse className="size-6 text-emerald-600" />
            <span>Inventory Stock &amp; Warehouse Allocations</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-warehouse stock levels, reservations, and low-inventory monitors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              lowStockFilter
                ? "bg-amber-500 text-white border-amber-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {lowStockFilter ? "Showing Low Stock Alerts" : "Filter Low Stock"}
          </button>
          <button
            onClick={() => fetchInventory(pagination.page)}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Variant / SKU</th>
                <th className="px-6 py-3.5">Product Title</th>
                <th className="px-6 py-3.5">Warehouse</th>
                <th className="px-6 py-3.5 text-center">On Hand</th>
                <th className="px-6 py-3.5 text-center">Reserved</th>
                <th className="px-6 py-3.5 text-center">Available Stock</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length > 0 ? (
                items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {inv.productVariant?.sku || "SKU-N/A"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {inv.productVariant?.productId?.name || "Product"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {inv.productVariant?.title || ""}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {inv.warehouse?.name || "Main Warehouse"}
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-slate-700">
                      {inv.onHand}
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-amber-600">
                      {inv.reserved}
                    </td>

                    <td className="px-6 py-4 text-center font-black text-slate-900">
                      {inv.available}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {inv.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="size-3" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="size-3" />
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 text-xs">
                    {loading ? "Loading inventory levels..." : "No inventory records matching criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchInventory(pagination.page - 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchInventory(pagination.page + 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
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
