"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Truck,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Package,
  MapPin,
  Clock,
  Download,
  ChevronDown,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";
import AdminShipmentStatusModal from "@/components/admin/orders/AdminShipmentStatusModal";
import { triggerBlobDownload } from "@/utils/fileDownload";
import { adminOperationsService } from "@/services/admin/admin.service.js";

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activePackingSlipShipmentId, setActivePackingSlipShipmentId] = useState(null);
  const [statusModalShipment, setStatusModalShipment] = useState(null);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: 50 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await adminOperationsService.listShipments(params);
      const items = res?.items || res?.data || res || [];
      setShipments(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load shipments"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportShipments = async (format = "csv") => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminOperationsService.exportShipments(params, format);
      triggerBlobDownload(res, `buybox_shipments_${new Date().toISOString().slice(0, 10)}.${format}`);
      toast.success(`Shipments exported successfully (${format.toUpperCase()})`);
    } catch (err) {
      toast.error("Failed to export shipments", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchShipments();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Truck className="size-6 text-[#004D38]" />
            <span>Fulfillment Shipments &amp; Couriers</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-carrier shipment manifests, tracking coordinates, and dispatch logistics
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                  onClick={() => handleExportShipments("csv")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Manifest</span>
                  <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">CSV</span>
                </button>
                <button
                  onClick={() => handleExportShipments("xlsx")}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span>Export Manifest</span>
                  <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase">XLSX</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={fetchShipments}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            "all",
            "pending",
            "manifested",
            "picked_up",
            "in_transit",
            "out_for_delivery",
            "delivered",
            "cancelled",
          ].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-xs">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking or manifest..."
            className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
          />
        </form>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading platform shipments...
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Truck className="size-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No shipments recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Shipment # / Tracking</th>
                  <th className="py-3.5 px-4">Carrier</th>
                  <th className="py-3.5 px-4">Order Ref</th>
                  <th className="py-3.5 px-4">Warehouse</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Created Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {shipments.map((ship) => (
                  <tr key={ship._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {ship.shipmentNumber || `SHP-${ship._id.slice(-8).toUpperCase()}`}
                      </div>
                      <div className="text-[11px] font-mono text-[#004D38]">
                        {ship.trackingNumber ? `AWB: ${ship.trackingNumber}` : "AWB Pending"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 capitalize font-semibold text-slate-800">
                      {ship.carrier || "Delhivery"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800">
                      {ship.orderId?.orderNumber ? `#${ship.orderId.orderNumber}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {ship.warehouseId?.name || "Main Fulfillment"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ship.status === "delivered"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : ship.status === "in_transit" || ship.status === "out_for_delivery"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ship.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(ship.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setStatusModalShipment(ship)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl transition-colors cursor-pointer shadow-2xs"
                        >
                          <Truck className="size-3" />
                          <span>Status</span>
                        </button>
                        <button
                          onClick={() => setActivePackingSlipShipmentId(ship._id || ship.secureId || ship.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                        >
                          <Printer className="size-3" />
                          <span>Packing Slip</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shipment Packing Slip Modal */}
      <PackingSlipModal
        isOpen={Boolean(activePackingSlipShipmentId)}
        onClose={() => setActivePackingSlipShipmentId(null)}
        shipmentId={activePackingSlipShipmentId}
        fetchPackingSlipFn={async ({ shipmentId }) => {
          return adminOperationsService.getShipmentPackingSlip(shipmentId);
        }}
      />

      {/* Admin Shipment Status Management Modal */}
      {statusModalShipment && (
        <AdminShipmentStatusModal
          isOpen={Boolean(statusModalShipment)}
          onClose={() => setStatusModalShipment(null)}
          shipment={statusModalShipment}
          onUpdated={async () => {
            fetchShipments();
          }}
        />
      )}
    </div>
  );
}
