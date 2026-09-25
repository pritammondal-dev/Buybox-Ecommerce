"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Store,
  CreditCard,
  User,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let isMounted = true;

    adminOrderService
      .getOrderById(orderId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        setOrder(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load order dossier", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested platform order does not exist or has been removed.
        </p>
        <Link
          href="/admin/operations/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    );
  }

  const customer = order.customerId || {};
  const address = order.shippingAddress || {};
  const items = order.items || [];
  const shipments = order.shipments || [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      <div>
        <Link
          href="/admin/operations/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to All Orders</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order #{order.orderNumber || order.secureId}
              </h2>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {order.status}
              </span>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                order.paymentStatus === "paid"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                Payment: {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Placed on {order.placedAt || order.createdAt ? new Date(order.placedAt || order.createdAt).toLocaleString("en-IN") : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Customer & Shipping Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <User className="size-3.5" />
            <span>Customer Details</span>
          </div>
          <div className="text-xs text-slate-700 space-y-1">
            <p className="font-semibold text-slate-900 text-sm">
              {customer.firstName || address.fullName} {customer.lastName || ""}
            </p>
            <p className="text-slate-500">{customer.email || "N/A"}</p>
            <p className="font-mono text-[11px] text-slate-500">{customer.phone || address.phone || "N/A"}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <MapPin className="size-3.5" />
            <span>Shipping Destination</span>
          </div>
          <div className="text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold text-slate-900">{address.fullName || "Customer"}</p>
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
            <p>{address.country || "India"}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <CreditCard className="size-3.5" />
            <span>Financial Breakdown</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800">₹{Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discounts:</span>
              <span className="text-rose-600">-₹{Number(order.discountTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax Total:</span>
              <span>₹{Number(order.taxTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900 text-sm">
              <span>Grand Total:</span>
              <span>₹{Number(order.grandTotal || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Vendor Dispatches & Shipments */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Truck className="size-4 text-[#004D38]" />
            <span>Courier Shipments ({shipments.length})</span>
          </h3>

          <div className="space-y-2">
            {shipments.map((shp) => (
              <div
                key={shp._id || shp.secureId}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{shp.shipmentNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white border border-slate-200">
                      {shp.status}
                    </span>
                    <span className="font-medium text-slate-600">
                      Carrier: <strong>{shp.carrier || "Courier"}</strong>
                    </span>
                  </div>
                  {shp.trackingNumber && (
                    <div className="text-slate-500 font-mono mt-1">
                      AWB: <strong>{shp.trackingNumber}</strong>
                    </div>
                  )}
                </div>

                {shp.trackingUrl && (
                  <a
                    href={shp.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-colors"
                  >
                    <span>Courier Tracking</span>
                    <ExternalLink className="size-3 text-slate-400" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line Items Table with Vendor Attribution */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Order Items & Merchant Attribution</h3>
          <p className="text-xs text-slate-500">Breakdown of products fulfilled by independent marketplace merchants</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Product / Variant</th>
                <th className="px-6 py-3.5">Fulfilling Merchant</th>
                <th className="px-6 py-3.5 text-center">Fulfillment Status</th>
                <th className="px-6 py-3.5 text-center">Qty</th>
                <th className="px-6 py-3.5 text-right">Unit Price</th>
                <th className="px-6 py-3.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">
                      {item.productName || item.sku}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      SKU: {item.sku}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Store className="size-3.5 text-[#004D38]" />
                      <span>{item.vendorId?.storeName || item.vendorId?.businessName || "Marketplace"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      {item.fulfillmentStatus || "unfulfilled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-700">
                    ₹{Number(item.unitPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    ₹{Number(item.lineTotal || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
