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

  const primaryShipment = shipments[0] || null;
  const currentStatus = primaryShipment?.status || order.status || "processing";

  // Map status to milestone index
  const getActiveMilestoneIndex = (status) => {
    switch (status) {
      case "delivered":
      case "completed":
        return 4;
      case "out_for_delivery":
        return 3;
      case "shipped":
      case "in_transit":
        return 2;
      case "packed":
      case "processing":
        return 1;
      case "pending":
      default:
        return 0;
    }
  };

  const activeIndex = getActiveMilestoneIndex(currentStatus);

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation */}
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#004D38] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Order #{order.orderNumber || orderId.slice(-8)}
        </Link>

        {/* Tracking Header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Shipment Tracking
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Order #{order.orderNumber || orderId}
              </h1>
              <p className="text-xs text-slate-500">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {primaryShipment?.trackingNumber && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs">
                <span className="text-slate-500 block">AWB / Tracking Number</span>
                <span className="font-mono font-bold text-[#004D38] text-sm">
                  {primaryShipment.trackingNumber}
                </span>
                {primaryShipment.carrier && (
                  <span className="text-[11px] text-slate-600 block mt-0.5">
                    Carrier: {primaryShipment.carrier}
                  </span>
                )}
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

        {/* Detailed Timeline Events */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Milestone Log (7 cols) */}
          <div className="md:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#004D38]" /> Milestone Updates
            </h2>

            <div className="space-y-4 pt-2">
              {(primaryShipment?.timeline || order.timeline || []).length === 0 ? (
                <div className="text-xs text-slate-500 italic py-2">
                  Order details registered with logistics carrier. Awaiting scan events.
                </div>
              ) : (
                (primaryShipment?.timeline || order.timeline || []).map((event, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-emerald-500 pl-4 py-1">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800 capitalize">
                        {event.status?.replace(/_/g, " ") || event.action}
                      </p>
                      {event.note && <p className="text-slate-500 text-[11px]">{event.note}</p>}
                      <span className="text-[10px] text-slate-400">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Delivery & Items Summary (5 cols) */}
          <div className="md:col-span-5 space-y-6">
            {/* Delivery Address */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-[#004D38]" />
                <span>Delivery Destination</span>
              </div>
              {order.shippingAddress ? (
                <div className="text-slate-600 leading-relaxed text-[11px] space-y-0.5">
                  <p className="font-semibold text-slate-800">{order.shippingAddress.name}</p>
                  <p>{order.shippingAddress.street || order.shippingAddress.addressLine1}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.postalCode}
                  </p>
                  <p className="text-slate-400">Phone: {order.shippingAddress.phone}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">Address on file</p>
              )}
            </div>

            {/* Packages / Items */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Package className="h-4 w-4 text-[#004D38]" />
                <span>Package Contents ({order.items?.length || 0})</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2.5">
                    {item.image && (
                      <div className="relative h-12 w-12 shrink-0 rounded-lg border border-slate-100 overflow-hidden bg-slate-50">
                        <Image src={item.image} alt={item.name} fill className="object-contain p-1" sizes="48px" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
