"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Warehouse,
  Boxes,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorWarehouseDetailPage() {
  const params = useParams();
  const warehouseId = params?.id;

  const [warehouse, setWarehouse] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!warehouseId) return;
    let isMounted = true;

    Promise.all([
      vendorService.getMyWarehouseById(warehouseId),
      vendorService.getMyInventory(),
    ])
      .then(([whRes, invRes]) => {
        if (!isMounted) return;
        const whData = whRes?.data?.data || whRes?.data?.warehouse || whRes?.data;
        setWarehouse(whData);

        const allInv = invRes?.data?.data || invRes?.data?.inventory || invRes?.data || [];
        const whSpecific = (Array.isArray(allInv) ? allInv : []).filter((item) => {
          const itemWhId = item.warehouseId?._id || item.warehouseId;
          const targetId = whData?._id;
          return itemWhId?.toString() === targetId?.toString();
        });
        setInventory(whSpecific);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load warehouse details", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [warehouseId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-36 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Warehouse Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested fulfillment center was not found or is inactive.
        </p>
        <Link
          href="/vendor/warehouses"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Warehouses</span>
        </Link>
      </div>
    );
  }

  const address = warehouse.address || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/vendor/warehouses"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Fulfillment Centers</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {warehouse.name}
              </h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {warehouse.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID: {warehouse.secureId || warehouse._id}
            </p>
          </div>
        </div>
      </div>

      {/* Warehouse Info Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Facility Address
          </h3>
          <div className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
            <MapPin className="size-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p>{address.addressLine1}</p>
              {address.addressLine2 && <p>{address.addressLine2}</p>}
              <p>
                {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
              </p>
              <p>{address.country || "India"}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Your Stock At This Location
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-50">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">SKUs</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {inventory.length}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">On Hand</div>
              <div className="text-lg font-black text-emerald-700 mt-0.5">
                {inventory.reduce((acc, i) => acc + (i.onHand || 0), 0)}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Low Stock</div>
              <div className="text-lg font-black text-amber-700 mt-0.5">
                {inventory.filter((i) => i.isLowStock).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Stored At This Warehouse */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Stored Product Variants</h3>
          <p className="text-xs text-slate-500">Live units available at this regional facility</p>
        </div>

        {inventory.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-xs">
            No stock currently recorded for your products in this facility.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Product Title</th>
                  <th className="px-6 py-3.5 text-center">On Hand</th>
                  <th className="px-6 py-3.5 text-center">Reserved</th>
                  <th className="px-6 py-3.5 text-center">Available</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((i) => {
                  const available = (i.onHand || 0) - (i.reserved || 0);
                  return (
                    <tr key={i._id} className="hover:bg-slate-50/60">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                        {i.sku}
                      </td>
                      <td className="px-6 py-3.5 text-slate-700">
                        {i.productTitle}
                      </td>
                      <td className="px-6 py-3.5 text-center font-bold text-slate-900">
                        {i.onHand}
                      </td>
                      <td className="px-6 py-3.5 text-center text-slate-500">
                        {i.reserved || 0}
                      </td>
                      <td className="px-6 py-3.5 text-center font-black text-slate-900">
                        {available}
                      </td>
                      <td className="px-6 py-3.5">
                        {i.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
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
