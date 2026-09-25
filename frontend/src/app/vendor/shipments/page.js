"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Truck,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorShipmentUrl } from "@/utils/secure-id.util";

export default function VendorShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const params = {};
    if (status !== "all") params.status = status;
    if (search.trim()) params.search = search.trim();

    vendorService
      .getMyShipments(params)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.shipments || res?.data || [];
        const items = Array.isArray(data) ? data : data.items || [];
        setShipments(items);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
          setShipments([]);
          return;
        }
        toast.error("Failed to load shipments", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [status, search]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (status !== "all") params.status = status;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.getMyShipments(params);
      const data = res?.data?.data || res?.data?.shipments || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      setShipments(items);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setShipments([]);
        return;
      }
      toast.error("Failed to load shipments", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Shipment Operations
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Outbound fulfillment packages, carrier integrations, and live tracking milestones.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Shipments</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tracking or shipment number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "manifested", label: "Manifested" },
            { id: "in_transit", label: "In Transit" },
            { id: "out_for_delivery", label: "Out for Delivery" },
            { id: "delivered", label: "Delivered" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
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
        ) : shipments.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No Shipments Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When orders are fulfilled and dispatched via integrated logistics couriers, their parcels will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Shipment / Tracking #</th>
                  <th className="px-6 py-3.5">Carrier</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Items</th>
                  <th className="px-6 py-3.5">Dispatched Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => {
                  const secureUrl = getVendorShipmentUrl(s.secureId || s._id);
                  const isDelivered = s.status === "delivered";

                  return (
                    <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">
                          <Link href={secureUrl} className="hover:text-emerald-700 hover:underline">
                            {s.trackingNumber || s.shipmentNumber || s.secureId}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Shipment ID: {s.secureId || s._id}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800 uppercase">
                        {s.carrier || s.courier || "Delhivery"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isDelivered
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : s.status === "in_transit"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {s.items?.length || 1} item(s)
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={secureUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                        >
                          <span>Track</span>
                          <ChevronRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
