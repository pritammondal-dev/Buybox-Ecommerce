"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Warehouse,
  Boxes,
  MapPin,
  ChevronRight,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorWarehouseUrl } from "@/utils/secure-id.util";

export default function VendorWarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const res = await vendorService.getMyWarehouses();
        const list = res?.data?.data || res?.data?.warehouses || res?.data || [];
        setWarehouses(Array.isArray(list) ? list : []);
      } catch (err) {
        toast.error("Failed to load warehouses", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadWarehouses();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Fulfillment Centers
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Regional warehouse locations storing and fulfilling your products across the marketplace network.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <Warehouse className="size-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Warehouses Allocated</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Your inventory has not been stocked in any regional fulfillment center yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {warehouses.map((wh) => {
            const secureUrl = getVendorWarehouseUrl(wh.secureId || wh._id);
            const address = wh.address || {};

            return (
              <div
                key={wh._id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Building2 className="size-5" />
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                      {wh.code}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {wh.name}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="size-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {[address.city, address.state, address.country].filter(Boolean).join(", ") || "India"}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">SKUs</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {wh.vendorSKUsCount ?? 0}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Units</div>
                    <div className="text-sm font-black text-emerald-700 mt-0.5">
                      {wh.vendorStockOnHand ?? 0}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Low Stock</div>
                    <div className={`text-sm font-black mt-0.5 ${
                      (wh.vendorLowStockCount || 0) > 0 ? "text-amber-700" : "text-slate-900"
                    }`}>
                      {wh.vendorLowStockCount ?? 0}
                    </div>
                  </div>
                </div>

                <Link
                  href={secureUrl}
                  className="mt-4 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50/50 text-xs font-semibold transition-all"
                >
                  <span>View Facility Stock</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
