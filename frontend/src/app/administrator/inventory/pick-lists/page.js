"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Printer,
  Download,
  RefreshCw,
  Warehouse,
  MapPin,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Package,
  Layers,
  Building2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { adminInventoryService } from "@/services/admin/admin.service.js";
import { triggerBlobDownload } from "@/utils/fileDownload";

export default function AdminPickListsPage() {
  const [pickData, setPickData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Pick checklist state (sku -> boolean checked)
  const [checkedItems, setCheckedItems] = useState({});
  // Expanded contributing orders (warehouseIndex_itemIndex -> boolean)
  const [expandedOrders, setExpandedOrders] = useState({});

  const loadWarehouses = async () => {
    try {
      const res = await adminInventoryService.listWarehouses();
      const list = res?.warehouses || res?.items || res?.data?.warehouses || res || [];
      setWarehouses(Array.isArray(list) ? list : []);
    } catch {
      // Non-critical if list fails
    }
  };

  const loadPickList = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedWarehouseId) params.warehouseId = selectedWarehouseId;

      const res = await adminInventoryService.getPickLists(params);
      const data = res?.data || res;
      setPickData(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load warehouse pick lists"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    loadPickList();
  }, [selectedWarehouseId]);

  const toggleCheck = (itemKey) => {
    setCheckedItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const toggleExpandOrders = (orderKey) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderKey]: !prev[orderKey],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = async (format = "csv") => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const params = {};
      if (selectedWarehouseId) params.warehouseId = selectedWarehouseId;

      const res = await adminInventoryService.exportPickLists(params, format);
      triggerBlobDownload(res, `buybox_pick_list_${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`Pick list exported successfully (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to export pick list", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const pickLists = pickData?.pickLists || [];
  const totalWarehouses = pickData?.totalWarehouses || 0;
  const totalUniqueSkus = pickData?.totalUniqueSkus || 0;
  const totalUnitsToPick = pickData?.totalUnitsToPick || 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Printable styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-picklist-area,
          #printable-picklist-area * {
            visibility: visible !important;
          }
          #printable-picklist-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Warehouse Operations
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="size-6 text-indigo-600" />
            <span>Fulfillment Pick Lists</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated picking batches grouped by warehouse and bin/shelf location. Read-only reservation audit.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Warehouse Selector */}
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh._id} value={wh._id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="size-3.5" />
              <span>{isExporting ? "Exporting..." : "Export"}</span>
              <ChevronDown className="size-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-20 text-xs font-medium text-slate-700">
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Pick List</span>
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">CSV</span>
                </button>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Pick List</span>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">XLSX</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handlePrint}
            disabled={loading || totalUnitsToPick === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Printer className="size-3.5" />
            <span>Print Pick List</span>
          </button>

          <button
            onClick={loadPickList}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Screen only) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Building2 className="size-3.5 text-indigo-600" />
            <span>Active Warehouses</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalWarehouses}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Layers className="size-3.5 text-indigo-600" />
            <span>Unique SKUs to Pick</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalUniqueSkus}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Package className="size-3.5 text-indigo-600" />
            <span>Total Units to Pick</span>
          </div>
          <div className="text-2xl font-black text-indigo-700">{totalUnitsToPick}</div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pick List Content Area (Target of window.print()) */}
      <div id="printable-picklist-area" className="space-y-8">
        {/* Printable Document Title (Hidden on screen, shown when printing) */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900">BUYBOX E-COMMERCE</span>
              <p className="text-xs uppercase font-bold text-slate-600 tracking-wider">
                Authoritative Warehouse Pick Manifest
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>Generated: {new Date().toLocaleString("en-IN")}</p>
              <p className="font-bold">Total Units: {totalUnitsToPick}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-500">Aggregating warehouse pick lists...</p>
          </div>
        ) : pickLists.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200/80 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardList className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Unfulfilled Pick Items</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All confirmed orders are currently fulfilled or there are no unfulfilled items allocated to the selected warehouse.
            </p>
          </div>
        ) : (
          pickLists.map((pl, whIdx) => (
            <div
              key={pl.warehouse.id || whIdx}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none"
            >
              {/* Warehouse Section Header */}
              <div className="p-6 border-b border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shadow-xs">
                    <Warehouse className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>{pl.warehouse.name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {pl.warehouse.code}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[pl.warehouse.address?.city, pl.warehouse.address?.state].filter(Boolean).join(", ") ||
                        "Central Facility"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                      Required Picks
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {pl.items.length} SKUs &bull; <span className="text-indigo-600 font-black">{pl.totalUnits} Units</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Pick</th>
                      <th className="py-3 px-4">Bin / Location</th>
                      <th className="py-3 px-4">SKU / Product Variant</th>
                      <th className="py-3 px-4 text-center">Qty to Pick</th>
                      <th className="py-3 px-4">Traceability &bull; Contributing Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {pl.items.map((item, itemIdx) => {
                      const itemKey = `${pl.warehouse.id}_${item.sku}`;
                      const isChecked = Boolean(checkedItems[itemKey]);
                      const orderKey = `${whIdx}_${itemIdx}`;
                      const isExpanded = Boolean(expandedOrders[orderKey]);

                      return (
                        <tr
                          key={item.sku || itemIdx}
                          className={`transition-colors ${
                            isChecked ? "bg-emerald-50/40 text-slate-400" : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* Pick Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleCheck(itemKey)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                              aria-label="Mark picked"
                            >
                              {isChecked ? (
                                <CheckSquare className="size-4 text-emerald-600" />
                              ) : (
                                <Square className="size-4" />
                              )}
                            </button>
                          </td>

                          {/* Bin Location */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                                  item.primaryLocationCode === "UNASSIGNED"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                }`}
                              >
                                {item.primaryLocationCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {item.primaryLocation}
                            </div>
                          </td>

                          {/* SKU & Product Details */}
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-slate-900">{item.sku}</div>
                            <div className="font-semibold text-slate-800 text-xs">{item.productName}</div>
                            {item.variantName && (
                              <div className="text-[11px] text-slate-500">{item.variantName}</div>
                            )}
                          </td>

                          {/* Required Quantity */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex px-3 py-1 rounded-xl bg-slate-900 text-white font-mono font-black text-sm">
                              {item.requiredQuantity}
                            </span>
                          </td>

                          {/* Contributing Orders Traceability */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => toggleExpandOrders(orderKey)}
                                className="no-print inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                              >
                                <span>{item.contributingOrders.length} Contributing Order(s)</span>
                                {isExpanded ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                              </button>

                              {/* On print or when expanded: list orders */}
                              <div
                                className={`${
                                  isExpanded ? "block" : "hidden print:block"
                                } mt-1 space-y-1 text-[11px] text-slate-600`}
                              >
                                {item.contributingOrders.map((ord, ordIdx) => (
                                  <div
                                    key={ordIdx}
                                    className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                                  >
                                    <span className="font-mono font-bold text-slate-800">
                                      {ord.orderNumber}
                                    </span>
                                    <span>
                                      {ord.recipientName} ({ord.recipientCity || "Local"})
                                    </span>
                                    <span className="font-mono font-bold text-slate-900">
                                      x{ord.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
