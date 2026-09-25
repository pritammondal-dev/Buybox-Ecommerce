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
} from "lucide-react";
import { adminOperationsService } from "@/services/admin/admin.service.js";

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

        <button
          onClick={fetchShipments}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
