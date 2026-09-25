"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, Download, ShieldCheck, CheckCircle2 } from "lucide-react";
import { orderService } from "../../../../../services/order.service.js";
import { formatCurrency } from "../../../../../utils/formatCurrency.js";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export function OrderInvoicePageView({ orderId }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await orderService.getOrderById(orderId);
        if (!isMounted) return;
        setOrder(res?.data?.order || res?.data);
      } catch (err) {
        if (isMounted) setError("Could not load invoice data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <p className="font-bold text-slate-800">Invoice Unavailable</p>
          <p className="text-xs text-slate-500">{error || "Could not retrieve order."}</p>
          <Link href="/orders" className="text-xs font-bold text-[#004D38] hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const invoiceNumber = `INV-${order.orderNumber || orderId.slice(-8)}`;
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Actions bar (hidden in print) */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Order
          </Link>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>

        {/* Invoice Paper Document */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-8">
            <div className="space-y-1.5">
              <span className="text-2xl font-black tracking-tight text-[#004D38]">
                BUYBOX
              </span>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Tax Invoice / Bill of Supply
              </p>
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                <p className="font-semibold text-slate-700">Buybox Retail Pvt. Ltd.</p>
                <p>CIN: U51909DL2024PTC123456</p>
                <p>GSTIN: 07AAACB1234C1Z5</p>
                <p>Support: support@buybox.in | 1800-BUYBOX-HELP</p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 text-xs">
              <p className="text-sm font-black text-slate-900">{invoiceNumber}</p>
              <p className="text-slate-500">Order ID: #{order.orderNumber || orderId}</p>
              <p className="text-slate-500">Date: {orderDate}</p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-[#004D38] border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" /> Paid & Confirmed
                </span>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
            <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                Billed To
              </span>
              <p className="font-bold text-slate-900">{order.shippingAddress?.name || "Customer"}</p>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {order.shippingAddress?.street || order.shippingAddress?.addressLine1}
                <br />
                {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.postalCode}
                <br />
                Phone: {order.shippingAddress?.phone}
              </p>
            </div>

            <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                Shipped To
              </span>
              <p className="font-bold text-slate-900">{order.shippingAddress?.name || "Customer"}</p>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {order.shippingAddress?.street || order.shippingAddress?.addressLine1}
                <br />
                {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.postalCode}
                <br />
                Country: {order.shippingAddress?.country || "India"}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Taxable</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(order.items || []).map((item, idx) => {
                  const unitRate = Number(item.unitPrice ?? item.price ?? 0);
                  const qty = Number(item.quantity || 1);
                  const lineTotal = Number(item.totalPrice ?? (unitRate * qty));
                  const itemName = item.productName || item.name || "Purchased Item";
                  return (
                    <tr key={idx}>
                      <td className="p-3 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{itemName}</p>
                        {item.sku && <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</p>}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-800">{qty}</td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(unitRate)}</td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(lineTotal)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-100 text-xs">
            <div className="max-w-xs space-y-2 text-slate-500 text-[11px]">
              <p className="font-bold text-slate-700">Payment Information:</p>
              <p>Method: {order.paymentMethod || "Online (Razorpay / UPI)"}</p>
              {order.paymentId && <p className="font-mono">Reference: {order.paymentId}</p>}
              <p className="text-slate-400">All prices include applicable GST under Indian tax regulations.</p>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span>{formatCurrency(order.subtotal ?? order.totalAmount ?? 0)}</span>
              </div>
              {Number(order.shippingTotal ?? order.shippingCost ?? 0) > 0 ? (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping & Delivery:</span>
                  <span>{formatCurrency(order.shippingTotal ?? order.shippingCost)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Shipping & Delivery:</span>
                  <span className="text-emerald-700 font-semibold">FREE</span>
                </div>
              )}
              {Number(order.discountTotal ?? order.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount Applied:</span>
                  <span>-{formatCurrency(order.discountTotal ?? order.discountAmount)}</span>
                </div>
              )}
              {Number(order.taxTotal ?? order.taxAmount ?? order.taxDetails?.taxAmount ?? 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>GST (Included):</span>
                  <span>{formatCurrency(order.taxTotal ?? order.taxAmount ?? order.taxDetails?.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-sm font-extrabold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-[#004D38]">{formatCurrency(order.grandTotal ?? order.totalAmount ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Footer Declaration */}
          <div className="border-t border-slate-200 pt-6 text-[11px] text-slate-400 leading-relaxed text-center">
            This is a computer generated invoice and does not require a physical signature.
            <br />
            Buybox E-Commerce • Certified Audio Marketplace Platform • Made for Audiophiles
          </div>
        </div>
      </div>
    </div>
  );
}
