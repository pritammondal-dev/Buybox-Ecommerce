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
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import {
  VendorPageHeader,
  VendorKpiCard,
  VendorStatusBadge,
  VendorEmptyState,
} from "@/components/vendor";

export default function VendorInventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Stock Adjustment Modal State
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState(1);
  const [adjustType, setAdjustType] = useState("add"); // "add" | "remove"
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    vendorService
      .getMyWarehouses()
      .then((whRes) => {
        const whData = whRes?.data?.data || whRes?.data?.warehouses || whRes?.data || [];
        setWarehouses(Array.isArray(whData) ? whData : []);
      })
      .catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    const params = { page, limit };
    if (selectedWarehouse !== "all") params.warehouseId = selectedWarehouse;
    if (search.trim()) params.search = search.trim();

    vendorService
      .getMyInventory(params)
      .then((invRes) => {
        if (!isMounted) return;
        const invData = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
        const items = Array.isArray(invData) ? invData : invData.items || [];
        const paginationMeta = invRes?.data?.meta || {
          page,
          limit,
          total: items.length,
          totalPages: Math.ceil(items.length / limit) || 1,
        };
        setInventory(items);
        setMeta(paginationMeta);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setInventory([]);
          setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
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
  }, [page, limit, selectedWarehouse, search]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const params = { page, limit };
      if (selectedWarehouse !== "all") params.warehouseId = selectedWarehouse;
      if (search.trim()) params.search = search.trim();

      const [invRes, whRes] = await Promise.all([
        vendorService.getMyInventory(params),
        vendorService.getMyWarehouses(),
      ]);
      const invData = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
      const items = Array.isArray(invData) ? invData : invData.items || [];
      const whData = whRes?.data?.data || whRes?.data?.warehouses || whRes?.data || [];
      const paginationMeta = invRes?.data?.meta || {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
      };
      setInventory(items);
      setWarehouses(Array.isArray(whData) ? whData : []);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setInventory([]);
        setWarehouses([]);
        setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
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
      if (whId && whId.toString() !== selectedWarehouse) return false;
    }
    if (filterLowStock && !item.isLowStock) {
      return false;
    }
    return true;
  });

  const lowStockCount = inventory.filter((i) => i.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <VendorPageHeader
        title="Inventory & Stock Control"
        subtitle="Real-time physical inventory counts, warehouse allocations, and reorder threshold alerts."
        breadcrumbs={[{ label: "Inventory" }]}
        actions={
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh Stock</span>
          </button>
        }
      />

      {/* KPI Mini-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <VendorKpiCard
          title="Total Allocated SKUs"
          value={inventory.length}
          subtitle="Unique SKU bindings"
          icon={Boxes}
          variant="purple"
        />

        <VendorKpiCard
          title="Total Units On Hand"
          value={inventory.reduce((sum, i) => sum + (i.onHand || 0), 0)}
          subtitle="Physical units across fulfillment centers"
          icon={Package}
          variant="emerald"
        />

        <VendorKpiCard
          title="Low Stock Alerts"
          value={lowStockCount}
          subtitle={lowStockCount > 0 ? "Requires restock replenishment" : "All inventories optimal"}
          icon={AlertTriangle}
          variant={lowStockCount > 0 ? "amber" : "emerald"}
          alert={lowStockCount > 0}
        />
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setPage(1);
            }}
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
            onClick={() => {
              setFilterLowStock(!filterLowStock);
              setPage(1);
            }}
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
          <VendorEmptyState
            icon={Boxes}
            title={
              search || selectedWarehouse !== "all" || filterLowStock
                ? "No Inventory Found"
                : "No Inventory Records"
            }
            description={
              search || selectedWarehouse !== "all" || filterLowStock
                ? "No inventory records match your criteria. Try adjusting your filters."
                : "No inventory has been allocated to fulfillment centers for your vendor products yet."
            }
            action={
              search || selectedWarehouse !== "all" || filterLowStock
                ? {
                    label: "Clear Filters",
                    onClick: () => {
                      setSearch("");
                      setSelectedWarehouse("all");
                      setFilterLowStock(false);
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
                        <VendorStatusBadge
                          status={isOut ? "out_of_stock" : isLow ? "low_stock" : "healthy"}
                          entityType="inventory"
                        />
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

            {/* Pagination */}
            <VendorTablePagination
              page={page}
              limit={limit}
              total={meta?.total ?? inventory.length}
              totalPages={meta?.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              isLoading={isLoading}
              itemLabel="inventory items"
            />
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
