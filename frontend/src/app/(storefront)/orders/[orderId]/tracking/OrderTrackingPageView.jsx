"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ShoppingBag,
  Calendar,
} from "lucide-react";
import { orderService } from "../../../../../services/order.service.js";
import { shipmentService } from "../../../../../services/shipment.service.js";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";
import { formatCurrency } from "../../../../../utils/formatCurrency.js";

const MILESTONES = [
  { key: "created", label: "Order Placed", desc: "Order verified and payment authorized" },
  { key: "packed", label: "Packed & Ready", desc: "Item inspected and secured in dispatch facility" },
  { key: "shipped", label: "In Transit", desc: "Carried by logistics partner to distribution hub" },
  { key: "out_for_delivery", label: "Out for Delivery", desc: "Courier partner is en route to delivery address" },
  { key: "delivered", label: "Delivered", desc: "Delivered to recipient with verified handover" },
];

export function OrderTrackingPageView({ orderId }) {
  const [order, setOrder] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [activeShipmentIndex, setActiveShipmentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [orderRes, shipmentRes] = await Promise.allSettled([
          orderService.getOrderById(orderId),
          shipmentService.getMyShipmentsByOrderId(orderId),
        ]);

        if (!isMounted) return;

        if (orderRes.status === "fulfilled") {
          const ord = orderRes.value?.data?.order || orderRes.value?.data;
          setOrder(ord);
        } else {
          setError("Could not load order details.");
        }

        if (shipmentRes.status === "fulfilled") {
          const shipList = Array.isArray(shipmentRes.value?.data?.shipments)
            ? shipmentRes.value.data.shipments
            : Array.isArray(shipmentRes.value?.data)
              ? shipmentRes.value.data
              : [];
          setShipments(shipList);
        }
      } catch (err) {
        if (isMounted) setError("Failed to fetch tracking data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Tracking Unavailable</h2>
          <p className="text-xs text-slate-500">{error || "Order not found."}</p>
          <Link
            href="/orders"
            className="inline-block rounded-xl bg-[#004D38] px-5 py-2 text-xs font-bold text-white"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const selectedShipment = shipments[activeShipmentIndex] || shipments[0] || null;
  const currentStatus = selectedShipment?.status || order.status || "pending";

  // Map status to milestone index
  const getActiveMilestoneIndex = (status) => {
    if (order?.isAwaitingVendorConfirmation || order?.customerDisplayStatus === "awaiting_merchant_confirmation") {
      return 0;
    }
    switch (status) {
      case "delivered":
      case "completed":
        return 4;
      case "out_for_delivery":
        return 3;
      case "shipped":
      case "in_transit":
      case "picked_up":
        return 2;
      case "ready_to_ship":
      case "packed":
      case "pickup_scheduled":
        return 1;
      case "processing":
        return (selectedShipment || order?.isFulfillmentConfirmed) ? 1 : 0;
      case "created":
      case "booked":
      case "awb_assigned":
      case "pending":
      case "confirmed":
      default:
        return 0;
    }
  };

  const activeIndex = getActiveMilestoneIndex(currentStatus);
  const milestoneEvents =
    selectedShipment?.trackingEvents ||
    selectedShipment?.events ||
    selectedShipment?.timeline ||
    order.timeline ||
    [];

  // Filter package items if shipment has items, else fallback to order items
  const packageItems = selectedShipment?.items && selectedShipment.items.length > 0
    ? selectedShipment.items
    : order.items || [];

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation */}
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#004D38] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Order #{order.orderNumber || orderId.slice(-8)}
        </Link>

        {/* Multi-Package Tabs (when more than 1 shipment exists) */}
        {shipments.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {shipments.map((s, idx) => (
              <button
                key={s._id || idx}
                onClick={() => setActiveShipmentIndex(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-xs whitespace-nowrap ${
                  activeShipmentIndex === idx
                    ? "bg-[#004D38] text-white"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Package className="size-3.5" />
                <span>Package {idx + 1} of {shipments.length}</span>
                <span className={`text-[10px] font-normal uppercase px-1.5 py-0.2 rounded ${
                  activeShipmentIndex === idx ? "bg-emerald-800 text-emerald-100" : "bg-slate-100 text-slate-600"
                }`}>
                  {s.carrier || "Standard"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Tracking Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Shipment Tracking {shipments.length > 1 ? `• Package ${activeShipmentIndex + 1}` : ""}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Order #{order.orderNumber || orderId}
              </h1>
              <p className="text-xs text-slate-500">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {(selectedShipment?.awbNumber || selectedShipment?.trackingNumber) && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs">
                <span className="text-slate-500 block text-[11px]">AWB / Tracking Number</span>
                <span className="font-mono font-bold text-[#004D38] text-sm block">
                  {selectedShipment.awbNumber || selectedShipment.trackingNumber}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-600">
                    Carrier: <strong className="uppercase">{selectedShipment.carrier || "Standard Logistics"}</strong>
                  </span>
                  {selectedShipment.trackingUrl && (
                    <a
                      href={selectedShipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700 hover:underline font-semibold"
                    >
                      <span>Live Portal</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stepper Timeline */}
          <div className="py-4">
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute top-5 left-4 right-4 h-0.5 bg-slate-200 hidden sm:block" />
              <div
                className="absolute top-5 left-4 h-0.5 bg-[#004D38] transition-all duration-500 hidden sm:block"
                style={{ width: `${(activeIndex / (MILESTONES.length - 1)) * 95}%` }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2 relative z-10">
                {MILESTONES.map((step, idx) => {
                  const isDone = idx <= activeIndex;
                  const isCurrent = idx === activeIndex;

                  return (
                    <div key={step.key} className="flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                          isDone
                            ? "bg-[#004D38] text-white"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        } ${isCurrent ? "ring-4 ring-emerald-100" : ""}`}
                      >
                        {isDone ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                      </div>
                      <div className="sm:text-center space-y-0.5">
                        <span className={`text-xs font-bold block ${isDone ? "text-slate-900" : "text-slate-400"}`}>
                          {step.label}
                        </span>
                        <span className="text-[10px] text-slate-500 block max-w-[120px] leading-tight">
                          {step.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Timeline Events & Package Items */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Milestone Log (7 cols) */}
          <div className="md:col-span-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#004D38]" /> Milestone Updates
              </h2>
              <span className="text-xs text-slate-400">{milestoneEvents.length} event(s)</span>
            </div>

            <div className="space-y-4 pt-2">
              {milestoneEvents.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-4 text-center bg-slate-50 rounded-2xl border border-slate-100">
                  Shipment record registered with logistics partner. Scanning updates will stream here.
                </div>
              ) : (
                milestoneEvents.map((event, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-emerald-500 pl-4 py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 uppercase">
                        {event.status || event.title || event.event || "Tracking Event"}
                      </p>
                      <p className="text-slate-600">
                        {event.description || event.notes || "In transit across carrier network"}
                      </p>
                      <div className="text-[11px] text-slate-400">
                        {event.location && <span>{event.location} • </span>}
                        {event.timestamp || event.createdAt
                          ? new Date(event.timestamp || event.createdAt).toLocaleString("en-IN")
                          : "Recorded"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Package Details & Destination (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            {/* Items in this package */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#004D38]" />
                <span>Items in Package ({packageItems.length})</span>
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {packageItems.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {item.name || item.productName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        SKU: {item.sku}
                      </p>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      Qty: {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Destination */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#004D38]" /> Delivery Address
              </h3>
              <div className="text-xs text-slate-700 space-y-0.5 leading-relaxed">
                <p className="font-bold text-slate-900">
                  {selectedShipment?.shippingAddress?.fullName || order.shippingAddress?.fullName}
                </p>
                <p>
                  {selectedShipment?.shippingAddress?.addressLine1 || order.shippingAddress?.addressLine1}
                </p>
                {(selectedShipment?.shippingAddress?.addressLine2 || order.shippingAddress?.addressLine2) && (
                  <p>{selectedShipment?.shippingAddress?.addressLine2 || order.shippingAddress?.addressLine2}</p>
                )}
                <p>
                  {[
                    selectedShipment?.shippingAddress?.city || order.shippingAddress?.city,
                    selectedShipment?.shippingAddress?.state || order.shippingAddress?.state,
                    selectedShipment?.shippingAddress?.postalCode || order.shippingAddress?.postalCode,
                  ].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderTrackingPageView;
