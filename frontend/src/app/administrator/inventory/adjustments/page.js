"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Warehouse,
  Package,
} from "lucide-react";
import { adminInventoryService } from "@/services/admin/admin.service.js";

export default function AdminInventoryAdjustmentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");

  // Adjustment Modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [deltaQuantity, setDeltaQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminInventoryService.listStock({ limit: 50 });
      const data = res?.items || res || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load inventory for adjustment"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    const qty = Number(deltaQuantity);
    if (isNaN(qty) || qty === 0) {
      alert("Please enter a valid non-zero adjustment quantity.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const invId = selectedItem.id || selectedItem._id;
      await adminInventoryService.adjustStock(
        invId,
        qty,
        adjustmentReason.trim() || "Manual operational correction"
      );
      setSuccess(`Inventory adjusted by ${qty > 0 ? `+${qty}` : qty} units successfully`);
      setTimeout(() => setSuccess(null), 4000);
      setSelectedItem(null);
      setDeltaQuantity(0);
      setAdjustmentReason("");
      fetchInventory();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to process inventory adjustment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = items.filter((inv) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const sku = inv.sku || inv.productVariantId?.sku || "";
    const title = inv.productTitle || inv.productVariantId?.title || "";
    const warehouse = inv.warehouseName || inv.warehouseId?.name || "";
    return (
      sku.toLowerCase().includes(s) ||
      title.toLowerCase().includes(s) ||
      warehouse.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <SlidersHorizontal className="size-6 text-[#004D38]" />
            <span>Stock Corrections &amp; Adjustments</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Perform transactional inventory manual adjustments, shrinkage accounting, and physical audits
          </p>
        </div>

        <button
          onClick={fetchInventory}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, variant, or warehouse..."
              className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
            />
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {filtered.length} inventory records
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading inventory records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Package className="size-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No inventory allocations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">SKU / Variant</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">On Hand</th>
                  <th className="py-3 px-4">Reserved</th>
                  <th className="py-3 px-4">Available</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((inv) => {
                  const onHand = inv.onHand ?? 0;
                  const reserved = inv.reserved ?? 0;
                  const available = Math.max(0, onHand - reserved);
                  const sku = inv.sku || inv.productVariantId?.sku || "SKU";
                  const warehouse = inv.warehouseName || inv.warehouseId?.name || "Warehouse";

                  return (
                    <tr key={inv._id || inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{sku}</div>
                        <div className="text-[11px] text-slate-400">{inv.productTitle}</div>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-1.5 text-slate-700">
                        <Warehouse className="size-3.5 text-slate-400" />
                        <span>{warehouse}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{onHand}</td>
                      <td className="py-3 px-4 text-slate-500">{reserved}</td>
                      <td className="py-3 px-4 font-bold text-[#004D38]">{available}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedItem(inv);
                            setDeltaQuantity(0);
                            setAdjustmentReason("");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-[#004D38] hover:text-white text-xs font-semibold transition-colors"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              Adjust Stock Level
            </h3>
            <p className="text-xs text-slate-500">
              Enter positive value to add stock, or negative value to deduct stock.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
              <div className="font-mono font-bold text-slate-900">
                {selectedItem.sku || selectedItem.productVariantId?.sku}
              </div>
              <div className="text-slate-500 flex justify-between">
                <span>Current On Hand:</span>
                <span className="font-bold text-slate-800">{selectedItem.onHand ?? 0}</span>
              </div>
              <div className="text-slate-500 flex justify-between">
                <span>Reserved:</span>
                <span className="font-bold text-slate-800">{selectedItem.reserved ?? 0}</span>
              </div>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quantity Delta (+ / -) *
                </label>
                <input
                  type="number"
                  required
                  value={deltaQuantity}
                  onChange={(e) => setDeltaQuantity(e.target.value)}
                  placeholder="e.g. +10 or -5"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Adjustment Reason *
                </label>
                <input
                  type="text"
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g., Physical count discrepancy, damaged return, stock transfer..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#004D38] hover:bg-[#003829] rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Commit Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
