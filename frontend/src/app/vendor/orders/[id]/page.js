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
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Shipment Creation Modal
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [shipmentForm, setShipmentForm] = useState({
    carrier: "Delhivery",
    warehouseId: "",
    serviceLevel: "Standard Surface",
    trackingNumber: "",
    trackingUrl: "",
    notes: "",
  });

  const loadOrder = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await vendorService.getMyOrderById(orderId);
      const data = res?.data?.data || res?.data?.order || res?.data;
      setOrder(data);
    } catch (err) {
      toast.error("Failed to load order details", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!orderId) return;
      try {
        const [orderRes, whRes] = await Promise.allSettled([
          vendorService.getMyOrderById(orderId),
          vendorService.getMyWarehouses(),
        ]);
        if (!isMounted) return;
        if (orderRes.status === "fulfilled") {
          const data = orderRes.value?.data?.data || orderRes.value?.data?.order || orderRes.value?.data;
          setOrder(data);
        }
        if (whRes.status === "fulfilled") {
          const list = whRes.value?.data?.data || whRes.value?.data?.warehouses || whRes.value?.data || [];
          const whArray = Array.isArray(list) ? list : [];
          setWarehouses(whArray);
          if (whArray.length > 0) {
            setShipmentForm((prev) => (prev.warehouseId ? prev : { ...prev, warehouseId: whArray[0]._id || whArray[0].id }));
          }
        }
      } catch (err) {
        toast.error("Failed to load order details", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleProcessOrder = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.processOrder(order.secureId || order._id);
      toast.success("Order accepted and marked as processing");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to process order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReadyToShip = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.markOrderReadyToShip(order.secureId || order._id);
      toast.success("Order marked ready for dispatch");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to mark order ready to ship", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!shipmentForm.carrier.trim()) {
      toast.error("Carrier name is required");
      return;
    }

    try {
      setIsProcessingAction(true);
      const payload = {
        carrier: shipmentForm.carrier.trim(),
        warehouseId: shipmentForm.warehouseId || undefined,
        serviceLevel: shipmentForm.serviceLevel || undefined,
        trackingNumber: shipmentForm.trackingNumber.trim() || undefined,
        trackingUrl: shipmentForm.trackingUrl.trim() || undefined,
        notes: shipmentForm.notes.trim() || undefined,
      };

      await vendorService.createOrderShipment(order.secureId || order._id, payload);
      toast.success("Courier shipment generated successfully");
      setShowShipmentModal(false);
      await loadOrder();
    } catch (err) {
      toast.error("Failed to generate shipment", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-200 rounded-3xl animate-pulse" />
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
          This order does not exist or contains no items belonging to your vendor account.
        </p>
        <Link
          href="/vendor/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    );
  }

  const address = order.shippingAddress || {};
  const items = order.items || [];
  const shipments = order.shipments || [];

  const hasUnprocessedItems = items.some(
    (it) => !it.fulfillmentStatus || it.fulfillmentStatus === "unfulfilled"
  );
  const hasProcessingItems = items.some((it) => it.fulfillmentStatus === "processing");
  const canShip = items.some((it) => ["processing", "ready_to_ship"].includes(it.fulfillmentStatus)) && order.paymentStatus === "paid";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      {/* Top Bar */}
      <div>
        <Link
          href="/vendor/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Orders</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order {order.orderNumber || order.secureId}
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
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "N/A"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasUnprocessedItems && order.paymentStatus === "paid" && (
              <button
                type="button"
                onClick={handleProcessOrder}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isProcessingAction ? <Loader2 className="size-3.5 animate-spin" /> : <Package className="size-3.5" />}
                <span>Accept & Process</span>
              </button>
            )}

            {hasProcessingItems && (
              <button
                type="button"
                onClick={handleReadyToShip}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isProcessingAction ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                <span>Mark Ready to Ship</span>
              </button>
            )}

            {canShip && (
              <button
                type="button"
                onClick={() => setShowShipmentModal(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Truck className="size-3.5" />
                <span>Create Shipment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shipping Destination */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <MapPin className="size-3.5" />
            <span>Delivery Destination</span>
          </div>
          <div className="text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold text-slate-900">{address.fullName || "Customer"}</p>
            {address.phone && <p className="text-slate-500 font-mono text-[11px]">{address.phone}</p>}
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
            <p>{address.country || "India"}</p>
          </div>
        </div>

        {/* Fulfillment Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Clock className="size-3.5" />
            <span>Fulfillment State</span>
          </div>
          <div className="text-sm font-bold text-slate-900 capitalize mb-1">
            {order.fulfillmentStatus || "Unfulfilled"}
          </div>
          <p className="text-xs text-slate-500 leading-snug">
            All order items displayed are strictly filtered to your merchant inventory allocations.
          </p>
        </div>

        {/* Financial Summary */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Your Scoped Subtotal
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(order.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Excludes line items from other marketplace vendors in multi-vendor checkouts.
          </p>
        </div>
      </div>

      {/* Shipment & Courier Dossier */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="size-4 text-[#004D38]" />
                <span>Courier Shipments & Tracking ({shipments.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Dispatches generated for this order</p>
            </div>
            <Link
              href="/vendor/shipments"
              className="text-xs font-semibold text-[#004D38] hover:underline"
            >
              View All Shipments
            </Link>
          </div>

          <div className="space-y-3">
            {shipments.map((shp) => (
              <div
                key={shp._id || shp.secureId}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {shp.shipmentNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-700">
                      {shp.status}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      Carrier: <strong className="text-slate-900">{shp.carrier || "Courier"}</strong>
                    </span>
                  </div>
                  {shp.trackingNumber && (
                    <p className="text-xs text-slate-500 mt-1">
                      AWB / Tracking Number: <span className="font-mono font-bold text-slate-800">{shp.trackingNumber}</span>
                    </p>
                  )}
                </div>

                {shp.trackingUrl && (
                  <a
                    href={shp.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    <span>Track with Courier</span>
                    <ExternalLink className="size-3 text-slate-400" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Your Scoped Order Items</h3>
          <p className="text-xs text-slate-500">Products fulfilled from your merchant inventory</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">SKU / Item</th>
                <th className="px-6 py-3.5 text-center">Fulfillment Status</th>
                <th className="px-6 py-3.5 text-center">Qty</th>
                <th className="px-6 py-3.5 text-right">Unit Price</th>
                <th className="px-6 py-3.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">
                      {item.productName || item.sku}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      SKU: {item.sku}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {item.fulfillmentStatus || "unfulfilled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-slate-900">
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

      {/* Shipment Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-[#004D38]" />
                <h3 className="font-bold text-slate-900">Create Courier Shipment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShipmentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Courier / Carrier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shipmentForm.carrier}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, carrier: e.target.value })}
                  placeholder="e.g. Delhivery, Shiprocket, BlueDart"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              {warehouses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch Warehouse
                  </label>
                  <select
                    value={shipmentForm.warehouseId}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, warehouseId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh._id || wh.id} value={wh._id || wh.id}>
                        {wh.name} ({wh.code || wh.city || "Primary"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AWB / Tracking Number (Optional)
                </label>
                <input
                  type="text"
                  value={shipmentForm.trackingNumber}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })}
                  placeholder="e.g. 12839481928"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tracking Webpage URL (Optional)
                </label>
                <input
                  type="url"
                  value={shipmentForm.trackingUrl}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, trackingUrl: e.target.value })}
                  placeholder="https://www.delhivery.com/track/package/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dispatch Notes
                </label>
                <textarea
                  rows={2}
                  value={shipmentForm.notes}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, notes: e.target.value })}
                  placeholder="Packaging specifications or handover notes..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Generate Shipment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
