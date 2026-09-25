"use client";

import React, { useEffect, useState } from "react";
import {
  Warehouse,
  Search,
  AlertTriangle,
  RefreshCw,
  Layers,
  CheckCircle,
  Sliders,
  ArrowRightLeft,
  X,
  Plus,
  Minus,
} from "lucide-react";
import apiClient from "@/lib/api/axios.js";
import { adminInventoryService } from "@/services/admin/admin.service.js";

export default function AdminInventoryStockPage() {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

  // Adjust Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustType, setAdjustType] = useState("add"); // "add" | "deduct"
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [transferQty, setTransferQty] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

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

  const fetchWarehouses = async () => {
    try {
      const res = await adminInventoryService.listWarehouses();
      const whs = res?.warehouses || res?.items || (Array.isArray(res) ? res : []);
      setWarehouses(whs);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    fetchInventory(1);
    fetchWarehouses();
  }, [lowStockFilter]);

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !adjustQty) return;
    setAdjusting(true);
    setError(null);
    try {
      const qtyNum = parseInt(adjustQty, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        alert("Please enter a valid positive quantity");
        setAdjusting(false);
        return;
      }
      const delta = adjustType === "add" ? qtyNum : -qtyNum;
      await adminInventoryService.adjustStock(
        selectedItem.id || selectedItem._id,
        delta,
        adjustReason.trim() || "Manual adjustment"
      );

      setSuccess(
        `Successfully ${adjustType === "add" ? "added" : "deducted"} ${qtyNum} units for SKU ${
          selectedItem.productVariant?.sku || ""
        }`
      );
      setTimeout(() => setSuccess(null), 4500);
      setShowAdjustModal(false);
      setSelectedItem(null);
      setAdjustQty("");
      setAdjustReason("");
      fetchInventory(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to adjust stock");
    } finally {
      setAdjusting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferItem || !destWarehouseId || !transferQty) return;
    setTransferring(true);
    setError(null);
    try {
      const qtyNum = parseInt(transferQty, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        alert("Please enter a valid positive quantity");
        setTransferring(false);
        return;
      }

      const variantId =
        transferItem.productVariant?._id ||
        transferItem.productVariant?.id ||
        transferItem.productVariantId;
      const sourceWH =
        transferItem.warehouse?._id ||
        transferItem.warehouse?.id ||
        transferItem.warehouseId;

      await adminInventoryService.transferStock({
        productVariantId: variantId,
        sourceWarehouseId: sourceWH,
        destinationWarehouseId: destWarehouseId,
        quantity: qtyNum,
        reason: transferReason.trim() || "Warehouse transfer",
      });

      setSuccess(
        `Successfully transferred ${qtyNum} units of SKU ${
          transferItem.productVariant?.sku || ""
        }`
      );
      setTimeout(() => setSuccess(null), 4500);
      setShowTransferModal(false);
      setTransferItem(null);
      setDestWarehouseId("");
      setTransferQty("");
      setTransferReason("");
      fetchInventory(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to transfer stock");
    } finally {
      setTransferring(false);
    }
  };

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
            Real-time multi-warehouse stock levels, reservations, stock adjustments, and transfers
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
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
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
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length > 0 ? (
                items.map((inv) => (
                  <tr key={inv.id || inv._id} className="hover:bg-slate-50/60 transition-colors">
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

                    <td className="px-6 py-4 text-center">
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

                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedItem(inv);
                          setShowAdjustModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
                        title="Adjust Stock Quantity"
                      >
                        <Sliders className="size-3" />
                        <span>Adjust</span>
                      </button>

                      <button
                        onClick={() => {
                          setTransferItem(inv);
                          setShowTransferModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors"
                        title="Transfer to Another Warehouse"
                      >
                        <ArrowRightLeft className="size-3" />
                        <span>Transfer</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400 text-xs">
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

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Adjust Inventory Stock</h2>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {selectedItem.productVariant?.productId?.name || "Product"}
              </div>
              <div className="font-mono text-slate-600">
                SKU: {selectedItem.productVariant?.sku}
              </div>
              <div className="text-slate-500">
                Warehouse: {selectedItem.warehouse?.name || "Main Warehouse"}
              </div>
              <div className="text-slate-700 pt-1 font-medium">
                Current On Hand: <strong>{selectedItem.onHand}</strong> | Available:{" "}
                <strong>{selectedItem.available}</strong>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("add")}
                    className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      adjustType === "add"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Plus className="size-3.5" />
                    <span>Add Stock</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("deduct")}
                    className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      adjustType === "deduct"
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Minus className="size-3.5" />
                    <span>Deduct Stock</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory count correction, damaged units..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {adjusting ? "Adjusting..." : "Apply Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Stock Modal */}
      {showTransferModal && transferItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Transfer Warehouse Stock</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {transferItem.productVariant?.productId?.name || "Product"}
              </div>
              <div className="font-mono text-slate-600">
                SKU: {transferItem.productVariant?.sku}
              </div>
              <div className="text-slate-500">
                Origin: <strong>{transferItem.warehouse?.name || "Main Warehouse"}</strong>
              </div>
              <div className="text-slate-700 font-medium">
                Available to Transfer: <strong>{transferItem.available}</strong>
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Warehouse</label>
                <select
                  required
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="">Select Destination Warehouse</option>
                  {warehouses
                    .filter(
                      (w) =>
                        (w._id || w.id) !==
                        (transferItem.warehouse?._id ||
                          transferItem.warehouse?.id ||
                          transferItem.warehouseId)
                    )
                    .map((w) => (
                      <option key={w._id || w.id} value={w._id || w.id}>
                        {w.name} ({w.code || "WH"})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={transferItem.available}
                  required
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Manifest Note</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Regional redistribution, restocking..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {transferring ? "Transferring..." : "Dispatch Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
