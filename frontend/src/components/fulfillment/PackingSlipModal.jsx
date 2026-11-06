"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Printer,
  X,
  Package,
  Truck,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle2,
  Download,
  Building2,
  FileText,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/lib/api/axios";
import Code128Barcode from "./Code128Barcode";

export default function PackingSlipModal({
  isOpen,
  onClose,
  orderId = null,
  shipmentId = null,
  warehouseId = null,
  fetchPackingSlipFn,
  fetchSlip,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSlip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = fetchPackingSlipFn || fetchSlip;
      let res;
      if (typeof fetcher === "function") {
        res = await fetcher({ orderId, shipmentId, warehouseId });
      } else if (shipmentId) {
        res = await apiClient.get(`/shipments/${shipmentId}/packing-slip`);
      } else if (orderId) {
        res = await apiClient.get(`/orders/${orderId}/packing-slip`, {
          params: warehouseId ? { warehouseId } : {},
        });
      } else {
        throw new Error("No order or shipment reference provided for packing slip");
      }

      const slip = res?.data?.data || res?.data || res;
      if (slip && typeof slip === "object" && (slip.packingSlipNumber || slip.orderNumber)) {
        setData(slip);
      } else {
        throw new Error("Invalid packing slip format received from server");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load authoritative packing slip"
      );
    } finally {
      setLoading(false);
    }
  }, [fetchPackingSlipFn, fetchSlip, orderId, shipmentId, warehouseId]);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      return;
    }

    loadSlip();
  }, [isOpen, loadSlip]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Global Print Styles for High-Quality A4 Output */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-packing-slip,
          #printable-packing-slip * {
            visibility: visible !important;
          }
          #printable-packing-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Screen Header (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Warehouse Packing Slip</h2>
              <p className="text-xs text-slate-500">
                Authoritative dispatch slip for warehouse fulfillment and customer delivery
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || error || !data}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100/50">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Generating authoritative packing slip...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-700 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-base font-bold">Unable to Load Packing Slip</h3>
              <p className="text-sm text-rose-600 max-w-md mx-auto">{error}</p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={loadSlip}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Retry</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {data && !loading && !error && (
            <div
              id="printable-packing-slip"
              className="bg-white p-8 md:p-10 rounded-2xl border border-slate-200 shadow-sm text-slate-900 font-sans"
            >
              {/* Slip Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-black tracking-tight text-indigo-700">BUYBOX</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider border border-slate-200">
                      Fulfillment Slip
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Authoritative Order Dispatch Manifest</p>
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="text-sm font-mono font-bold text-slate-900">
                    Slip #: {data.packingSlipNumber}
                  </div>
                  <div className="text-xs text-slate-500">
                    Generated: {new Date(data.generatedAt || Date.now()).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {/* Order & Shipment Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block uppercase font-medium tracking-wider text-[10px]">Order Number</span>
                  <span className="font-bold font-mono text-sm text-slate-900">{data.orderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium tracking-wider text-[10px]">Order Date</span>
                  <span className="font-medium text-slate-800">
                    {data.orderDate ? new Date(data.orderDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }) : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium tracking-wider text-[10px]">Shipment Reference</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {data.shipmentReference || "Full Order Dispatch"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium tracking-wider text-[10px]">Carrier / Tracking</span>
                  <span className="font-semibold text-slate-800">
                    {data.carrier ? `${data.carrier} ${data.trackingNumber ? `(${data.trackingNumber})` : ""}` : "Standard Surface"}
                  </span>
                </div>
              </div>

              {/* Dispatch from & Ship to Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-slate-200">
                {/* Warehouse Dispatch */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Dispatched From</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {data.warehouse?.name} ({data.warehouse?.code})
                  </h4>
                  <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                    <p>{data.warehouse?.address?.addressLine1}</p>
                    {data.warehouse?.address?.addressLine2 && <p>{data.warehouse?.address?.addressLine2}</p>}
                    <p>
                      {[data.warehouse?.address?.city, data.warehouse?.address?.state, data.warehouse?.address?.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p>{data.warehouse?.address?.country || "India"}</p>
                    {data.warehouse?.phone && <p className="mt-1 font-mono text-[11px]">Tel: {data.warehouse.phone}</p>}
                  </div>
                </div>

                {/* Recipient Shipping Address */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Deliver To</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{data.recipient?.fullName}</h4>
                  <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                    <p>{data.recipient?.addressLine1}</p>
                    {data.recipient?.addressLine2 && <p>{data.recipient?.addressLine2}</p>}
                    <p>
                      {[data.recipient?.city, data.recipient?.state, data.recipient?.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p>{data.recipient?.country || "India"}</p>
                    {data.recipient?.phone && (
                      <p className="mt-1 font-mono text-[11px] font-semibold text-slate-800">
                        Phone: {data.recipient.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Package Items Snapshot ({data.items?.length || 0} Products)
                  </h3>
                  {data.isSplitShipment && (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">
                      Partial Shipment
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-4">Item &amp; Variant Description</th>
                        <th className="py-2.5 px-3">Seller / Merchant</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(data.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.sku}</td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            {item.variantName && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.variantName}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {item.merchantName || "Buybox Merchant"}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-4 text-right uppercase text-[11px] text-slate-700">
                          Total Quantity Dispatched:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900">
                          {data.totalQuantity}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Fulfillment Notes & Authentic Code 128 Barcode */}
              <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                <div className="sm:col-span-2 text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Fulfillment Instructions:</p>
                  <p className="leading-relaxed">{data.fulfillmentNotes}</p>
                  <p className="text-[11px] text-slate-400 italic">
                    Delivery Method: {data.deliveryOption} {data.estimatedDays ? `(${data.estimatedDays})` : ""}
                  </p>
                  {data.carrier && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-medium">
                      <Truck className="size-3 text-indigo-600" />
                      <span>Carrier: <strong>{data.carrier}</strong></span>
                      {data.trackingNumber && (
                        <span> | Tracking / AWB: <strong className="font-mono">{data.trackingNumber}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <Code128Barcode
                    value={data.shipmentReference || data.packingSlipNumber || data.orderNumber}
                    moduleWidth={1.5}
                    barHeight={38}
                    showText={true}
                    altText={`Internal Package Barcode: ${data.shipmentReference || data.orderNumber}`}
                  />
                  <span className="text-[9px] text-slate-400 font-mono mt-1">Package Verification Scan (Code 128)</span>
                </div>
              </div>

              {/* Sign-off dock */}
              <div className="mt-8 pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 text-xs text-slate-500">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Packed By (Staff Sign / ID):</span>
                  <div className="mt-4 border-b border-slate-400 w-48" />
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Quality Checked:</span>
                  <div className="mt-4 border-b border-slate-400 w-48 ml-auto" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Screen only) */}
        <div className="no-print px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || error || !data}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Packing Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
