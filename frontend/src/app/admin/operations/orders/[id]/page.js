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
import AdminOrderStatusControl from "@/components/admin/orders/AdminOrderStatusControl";
import OrderTimeline from "@/components/admin/orders/OrderTimeline";
import AdminShipmentStatusModal from "@/components/admin/orders/AdminShipmentStatusModal";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusModalShipment, setStatusModalShipment] = useState(null);

  const fetchOrder = () => {
    if (!orderId) return;
    setIsLoading(true);
    adminOrderService
      .getOrderById(orderId)
      .then((res) => {
        const data = res?.data || res;
        setOrder(data);
      })
      .catch((err) => {
        toast.error("Failed to load order dossier", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchOrder();
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
            <span>Authoritative Financial Breakdown</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Item Subtotal:</span>
              <span className="font-semibold text-slate-800">₹{Number(order.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discounts:</span>
              <span className="text-rose-600">-₹{Number(order.discountTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping Charges:</span>
              <span>₹{Number(order.shippingTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax Total:</span>
              <span>₹{Number(order.taxTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900 text-sm">
              <span>Grand Total (INR):</span>
              <span className="text-[#004D38]">₹{Number(order.grandTotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-50">
              <span>Settlement:</span>
              <span className="capitalize font-medium">
                {order.paymentStatus || "pending"} (Paid: ₹{Number(order.amountPaid || 0).toFixed(2)})
              </span>
            </div>
            {Number(order.amountRefunded || 0) > 0 && (
              <div className="flex justify-between text-[11px] text-rose-600">
                <span>Refunded:</span>
                <span>-₹{Number(order.amountRefunded).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Superadmin Order Lifecycle & Status Control */}
      <AdminOrderStatusControl order={order} onStatusUpdated={() => fetchOrder()} />

      {/* Multi-Vendor Dispatches & Shipments */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Truck className="size-4 text-[#004D38]" />
            <span>Courier Shipments ({shipments.length})</span>
          </h3>

          <div className="space-y-3">
            {shipments.map((shp) => (
              <div
                key={shp._id || shp.secureId}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{shp.shipmentNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        shp.status === "delivered"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : shp.status === "in_transit" || shp.status === "out_for_delivery"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : shp.status === "cancelled" || shp.status === "failed"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {shp.status?.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-slate-600">
                      Carrier: <strong>{shp.carrier || "Courier"}</strong>
                    </span>
                    {shp.warehouseId?.name && (
                      <span className="text-slate-400">
                        • WH: <strong className="text-slate-600">{shp.warehouseId.name}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500 font-mono">
                    {shp.trackingNumber ? (
                      <div>
                        AWB: <strong className="text-slate-700">{shp.trackingNumber}</strong>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">AWB Pending</div>
                    )}
                    {shp.createdAt && (
                      <div>
                        Created: {new Date(shp.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusModalShipment(shp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Truck className="size-3.5" />
                    <span>Manage Status</span>
                  </button>

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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line Items Table with Complete Pricing Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Order Items &amp; Pricing Breakdown</h3>
            <p className="text-xs text-slate-500">Authoritative historical pricing snapshots, variant configurations, and fulfilling merchant details</p>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600">
            {items.length} Line Item{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">Product &amp; Variant</th>
                <th className="px-5 py-3.5">Fulfilling Merchant</th>
                <th className="px-5 py-3.5 text-center">Fulfillment</th>
                <th className="px-5 py-3.5 text-center">Qty</th>
                <th className="px-5 py-3.5 text-right">Unit Price (Historical)</th>
                <th className="px-5 py-3.5 text-right">Item Subtotal</th>
                <th className="px-5 py-3.5 text-right">Discount / Tax</th>
                <th className="px-5 py-3.5 text-right">Final Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const hasUnitPrice = item.unitPrice !== null && item.unitPrice !== undefined && !isNaN(Number(item.unitPrice));
                const hasLineTotal = item.lineTotal !== null && item.lineTotal !== undefined && !isNaN(Number(item.lineTotal));
                const itemSubtotal = hasUnitPrice ? (Number(item.unitPrice) * (item.quantity || 1)).toFixed(2) : null;
                const hasDiscount = item.discountTotal && Number(item.discountTotal) > 0;
                const hasTax = item.taxTotal && Number(item.taxTotal) > 0;

                const displayName = item.productName || item.productId?.title || item.productId?.name || "Product";
                const variantInfo = item.variantName || item.productVariantId?.name;

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    {/* Product & Variant */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={displayName}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Package className="size-5 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 leading-snug">
                            {displayName}
                          </div>
                          {variantInfo && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mr-1.5">
                              {variantInfo}
                            </span>
                          )}
                          <div className="font-mono text-[10px] text-slate-400">
                            SKU: {item.sku || "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Merchant Attribution */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Store className="size-3.5 text-[#004D38] shrink-0" />
                        <span className="truncate max-w-[140px]">
                          {item.vendor?.name || item.vendorId?.storeName || item.vendorId?.businessName || "Marketplace"}
                        </span>
                      </div>
                      {item.warehouse && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          WH: {item.warehouse.name || item.warehouse.code}
                        </div>
                      )}
                    </td>

                    {/* Fulfillment Status */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        item.fulfillmentStatus === "delivered"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : item.fulfillmentStatus === "shipped"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : item.fulfillmentStatus === "cancelled"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {item.fulfillmentStatus || "unfulfilled"}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-5 py-4 text-center font-bold text-slate-900">
                      {item.quantity}
                    </td>

                    {/* Unit Price (Historical snapshot) */}
                    <td className="px-5 py-4 text-right">
                      {hasUnitPrice ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            ₹{Number(item.unitPrice).toFixed(2)}
                          </span>
                          <span className="block text-[9px] text-slate-400 uppercase tracking-tight">
                            historical
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Price Missing
                        </span>
                      )}
                    </td>

                    {/* Item Subtotal */}
                    <td className="px-5 py-4 text-right font-medium text-slate-700">
                      {itemSubtotal !== null ? (
                        `₹${itemSubtotal}`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Item-Level Discount & Tax */}
                    <td className="px-5 py-4 text-right space-y-0.5">
                      {hasDiscount && (
                        <div className="text-[11px] text-rose-600 font-semibold">
                          -₹{Number(item.discountTotal).toFixed(2)}
                        </div>
                      )}
                      {hasTax && (
                        <div className="text-[10px] text-slate-500 font-medium">
                          +₹{Number(item.taxTotal).toFixed(2)} tax
                        </div>
                      )}
                      {!hasDiscount && !hasTax && (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="px-5 py-4 text-right">
                      {hasLineTotal ? (
                        <div className="font-black text-slate-900 text-sm">
                          ₹{Number(item.lineTotal).toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Unrecorded
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Status History & Audit Trail */}
      <OrderTimeline
        timeline={order.timeline}
        createdAt={order.createdAt}
        placedAt={order.placedAt}
      />

      {/* Admin Shipment Status Management Modal */}
      {statusModalShipment && (
        <AdminShipmentStatusModal
          isOpen={Boolean(statusModalShipment)}
          onClose={() => setStatusModalShipment(null)}
          shipment={statusModalShipment}
          onUpdated={async () => {
            fetchOrder();
          }}
        />
      )}
    </div>
  );
}
