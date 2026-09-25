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
  Ban,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

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

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    if (!orderId) return;
    setIsCancelling(true);
    try {
      await adminOrderService.cancelOrder(
        orderId,
        cancelReason.trim() || "Administratively cancelled by staff"
      );
      toast.success("Order cancelled successfully", {
        description: "Inventory has been released and cancellation recorded.",
      });
      setShowCancelModal(false);
      setCancelReason("");
      fetchOrder();
    } catch (err) {
      toast.error("Failed to cancel order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsCancelling(false);
    }
  };

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
          href="/administrator/operations/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
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
  const isCancellable = order.status !== "cancelled" && order.status !== "delivered";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Link
            href="/administrator/operations/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to All Orders</span>
          </Link>
          <button
            onClick={fetchOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order #{order.orderNumber || order.secureId}
              </h2>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  order.status === "cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : order.status === "delivered"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {order.status}
              </span>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  order.paymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Payment: {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Placed on{" "}
              {order.placedAt || order.createdAt
                ? new Date(order.placedAt || order.createdAt).toLocaleString("en-IN")
                : "N/A"}
            </p>
          </div>

          {isCancellable && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <Ban className="size-3.5" />
              <span>Cancel Order</span>
            </button>
          )}
        </div>
      </div>

      {order.cancellationReason && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>
            <strong>Cancellation Reason: </strong>
            {order.cancellationReason}
          </span>
        </div>
      )}

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
            <p className="font-mono text-[11px] text-slate-500">
              {customer.phone || address.phone || "N/A"}
            </p>
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
              <span className="font-semibold text-slate-800">
                ₹{Number(order.subtotal || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Discounts:</span>
              <span className="text-rose-600">
                -₹{Number(order.discountTotal || 0).toFixed(2)}
              </span>
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
            <Truck className="size-4 text-emerald-700" />
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
                    <span className="font-mono font-bold text-slate-900">
                      {shp.shipmentNumber}
                    </span>
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
          <h3 className="text-sm font-bold text-slate-900">
            Order Items &amp; Merchant Attribution
          </h3>
          <p className="text-xs text-slate-500">
            Breakdown of products fulfilled by independent marketplace merchants
          </p>
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
                      <Store className="size-3.5 text-emerald-700" />
                      <span>
                        {item.vendorId?.storeName ||
                          item.vendorId?.businessName ||
                          "Marketplace"}
                      </span>
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

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="size-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Ban className="size-5" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900">Cancel Platform Order</h2>
              <p className="text-xs text-slate-500">
                Are you sure you want to administratively cancel Order #{order.orderNumber || order.secureId}? Any reserved stock will be automatically released back to warehouses.
              </p>
            </div>

            <form onSubmit={handleCancelOrder} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows="3"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer requested cancellation, suspect fraud, or merchant stock outage..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
