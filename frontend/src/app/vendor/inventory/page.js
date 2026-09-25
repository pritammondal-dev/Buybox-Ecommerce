"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Boxes,
  Warehouse,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  Package,
  Plus,
  Minus,
  X,
  Loader2,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorProductUrl } from "@/utils/secure-id.util";

export default function VendorInventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Stock Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjustType, setAdjustType] = useState("add"); // "add" | "remove"
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      vendorService.getMyInventory(),
      vendorService.getMyWarehouses(),
    ])
      .then(([invRes, whRes]) => {
        if (!isMounted) return;
        const invData = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
        const whData = whRes?.data?.data || whRes?.data?.warehouses || whRes?.data || [];
        setInventory(Array.isArray(invData) ? invData : []);
        setWarehouses(Array.isArray(whData) ? whData : []);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setInventory([]);
          setWarehouses([]);
          return;
        }
        toast.error("Failed to fetch inventory records", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const [invRes, whRes] = await Promise.all([
        vendorService.getMyInventory(),
        vendorService.getMyWarehouses(),
      ]);
      const invData = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
      const whData = whRes?.data?.data || whRes?.data?.warehouses || whRes?.data || [];
      setInventory(Array.isArray(invData) ? invData : []);
      setWarehouses(Array.isArray(whData) ? whData : []);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setInventory([]);
        setWarehouses([]);
        return;
      }
      toast.error("Failed to fetch inventory records", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdjustModal = (item) => {
    setAdjustModalItem(item);
    setAdjustDelta(1);
    setAdjustType("add");
    setAdjustNotes("");
  };

  const handleCloseAdjustModal = () => {
    setAdjustModalItem(null);
    setAdjustDelta(1);
    setAdjustType("add");
    setAdjustNotes("");
    setIsAdjusting(false);
  };

  const handleExecuteAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalItem) return;

    const deltaNum = parseInt(adjustDelta, 10);
    if (isNaN(deltaNum) || deltaNum <= 0) {
      toast.error("Adjustment quantity must be a positive integer.");
      return;
    }

    const netQuantity = adjustType === "add" ? deltaNum : -deltaNum;
    const currentOnHand = adjustModalItem.onHand || 0;
    const reserved = adjustModalItem.reserved || 0;

    if (currentOnHand + netQuantity < reserved) {
      toast.error(
        `Cannot reduce stock below reserved quantity (${reserved} reserved). Max allowed reduction is ${currentOnHand - reserved}.`
      );
      return;
    }

    setIsAdjusting(true);

    try {
      await vendorService.adjustInventory(adjustModalItem._id, {
        quantity: netQuantity,
        notes: adjustNotes.trim() || undefined,
      });

      toast.success(
        `Stock ${adjustType === "add" ? "increased" : "reduced"} by ${deltaNum} unit(s) for ${adjustModalItem.sku}`
      );

      handleCloseAdjustModal();
      await handleRefresh();
    } catch (err) {
      toast.error("Failed to adjust inventory", {
        description: err?.response?.data?.message || err.message,
      });
      setIsAdjusting(false);
    }
  };

  // Filter items
  const filteredItems = inventory.filter((item) => {
    if (selectedWarehouse !== "all") {
      const whId = item.warehouseId?._id || item.warehouseId;
      if (whId?.toString() !== selectedWarehouse) return false;
    }
    if (filterLowStock && !item.isLowStock) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const skuMatch = item.sku?.toLowerCase().includes(q);
      const titleMatch = item.productTitle?.toLowerCase().includes(q);
      if (!skuMatch && !titleMatch) return false;
    }
    return true;
  });

  const lowStockCount = inventory.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventory & Stock Control
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time physical inventory counts, warehouse allocations, and reorder threshold alerts.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Stock</span>
        </button>
      </div>

      {/* KPI Mini-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Allocated SKUs
          </div>
          <div className="text-2xl font-black text-slate-900">
            {inventory.length}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Units On Hand
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {inventory.reduce((sum, i) => sum + (i.onHand || 0), 0)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Low Stock Alerts
          </div>
          <div className={`text-2xl font-black ${lowStockCount > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {lowStockCount}
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU or product title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="all">All Warehouses ({warehouses.length})</option>
            {warehouses.map((wh) => (
              <option key={wh._id} value={wh._id}>
                {wh.name || wh.code}
              </option>
            ))}
          </select>

          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              filterLowStock
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
            }`}
          >
            Low Stock Only
          </button>
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
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center">
            <Boxes className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Inventory Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || selectedWarehouse !== "all" || filterLowStock
                ? "No inventory records match your criteria. Try adjusting your filters."
                : "No inventory has been allocated to fulfillment centers for your vendor products yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">SKU / Product</th>
                  <th className="px-6 py-3.5">Fulfillment Center</th>
                  <th className="px-6 py-3.5 text-center">On Hand</th>
                  <th className="px-6 py-3.5 text-center">Reserved</th>
                  <th className="px-6 py-3.5 text-center">Available</th>
                  <th className="px-6 py-3.5 text-center">Threshold</th>
                  <th className="px-6 py-3.5">Health Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const available = (item.onHand || 0) - (item.reserved || 0);
                  const isLow = item.isLowStock;
                  const isOut = available <= 0;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">
                          {item.sku}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {item.productTitle}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {item.warehouseName || "Regional Warehouse"}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.warehouseCode}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900">
                        {item.onHand}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {item.reserved || 0}
                      </td>
                      <td className="px-6 py-4 text-center font-black text-slate-900">
                        {available}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 font-mono">
                        {item.lowStockThreshold || 5}
                      </td>
                      <td className="px-6 py-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="size-3" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="size-3" /> Healthy
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenAdjustModal(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] shadow-xs transition-colors"
                        >
                          <Sliders className="size-3 text-[#007A55]" />
                          Adjust Stock
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

      {/* Adjust Stock Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-bold">
                  <Boxes className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Adjust Physical Stock
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">
                    {adjustModalItem.sku}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAdjustModal}
                disabled={isAdjusting}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Current Metrics Info */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-2xl p-3 border border-slate-200/60 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">On Hand</span>
                <span className="font-bold text-sm text-slate-900">{adjustModalItem.onHand || 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Reserved</span>
                <span className="font-bold text-sm text-amber-700">{adjustModalItem.reserved || 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Available</span>
                <span className="font-black text-sm text-emerald-700">
                  {(adjustModalItem.onHand || 0) - (adjustModalItem.reserved || 0)}
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4">
              {/* Type Switcher: Add vs Remove */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Adjustment Operation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("add")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      adjustType === "add"
                        ? "bg-[#007A55] text-white border-[#007A55] shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Plus className="size-3.5" />
                    Receive / Add Units
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("remove")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      adjustType === "remove"
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Minus className="size-3.5" />
                    Deduct / Write-off
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label
                  htmlFor="adjust-delta"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Quantity ({adjustType === "add" ? "Units to Add" : "Units to Deduct"})
                </label>
                <input
                  id="adjust-delta"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                />
              </div>

              {/* Reason / Notes */}
              <div>
                <label
                  htmlFor="adjust-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Audit Notes / Reason (Optional)
                </label>
                <input
                  id="adjust-notes"
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="e.g. Stock shipment received, warehouse audit"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                />
              </div>

              {/* Projected Result Preview */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs flex items-center justify-between text-emerald-950">
                <span>Projected New On Hand:</span>
                <strong className="font-mono text-sm font-black">
                  {adjustType === "add"
                    ? (adjustModalItem.onHand || 0) + (parseInt(adjustDelta, 10) || 0)
                    : Math.max(0, (adjustModalItem.onHand || 0) - (parseInt(adjustDelta, 10) || 0))}
                </strong>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseAdjustModal}
                  disabled={isAdjusting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting || !adjustDelta}
                  className="px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  {isAdjusting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Apply Adjustment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
