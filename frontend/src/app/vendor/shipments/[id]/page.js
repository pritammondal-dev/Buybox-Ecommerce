"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorShipmentDetailPage() {
  const params = useParams();
  const shipmentId = params?.id;

  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!shipmentId) return;
    let isMounted = true;

    vendorService
      .getMyShipmentById(shipmentId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data?.data || res?.data?.shipment || res?.data;
        setShipment(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load shipment details", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [shipmentId]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Shipment Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This shipment does not exist or does not belong to your vendor account.
        </p>
        <Link
          href="/vendor/shipments"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Shipments</span>
        </Link>
      </div>
    );
  }

  const events = shipment.events || shipment.trackingHistory || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/vendor/shipments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Shipments</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Shipment {shipment.trackingNumber || shipment.shipmentNumber}
              </h2>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {shipment.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Carrier: {shipment.carrier || "Integrated Courier"} • ID: {shipment.secureId || shipment._id}
            </p>
          </div>
        </div>
      </div>

      {/* Shipment Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Package Information
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tracking Code</span>
              <span className="font-mono font-bold text-slate-900">{shipment.trackingNumber || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Carrier Service</span>
              <span className="font-semibold text-slate-800 uppercase">{shipment.carrier || "Standard"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Dispatch Date</span>
              <span className="text-slate-700">{shipment.dispatchedAt ? new Date(shipment.dispatchedAt).toLocaleString("en-IN") : "Pending"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Estimated Delivery</span>
              <span className="text-slate-700">{shipment.estimatedDeliveryDate ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString("en-IN") : "TBD"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Shipping Destination
          </h3>
          <div className="text-xs text-slate-700 leading-relaxed space-y-0.5">
            <p className="font-semibold text-slate-900">{shipment.shippingAddress?.fullName || "Recipient"}</p>
            <p>{shipment.shippingAddress?.addressLine1}</p>
            {shipment.shippingAddress?.addressLine2 && <p>{shipment.shippingAddress?.addressLine2}</p>}
            <p>{[shipment.shippingAddress?.city, shipment.shippingAddress?.state, shipment.shippingAddress?.postalCode].filter(Boolean).join(", ")}</p>
            <p>{shipment.shippingAddress?.country || "India"}</p>
          </div>
        </div>
      </div>

      {/* Tracking Events Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Milestone Tracking Timeline</h3>

        {events.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            Package has been manifested. Tracking milestones will populate as the carrier scans this parcel.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((evt, idx) => (
              <div key={idx} className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 size-3 rounded-full bg-emerald-600 ring-4 ring-emerald-50" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {evt.status || evt.description}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {evt.location && <span>{evt.location} • </span>}
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleString("en-IN") : "Recorded"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
