"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Wallet,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Receipt,
  FileText,
  ExternalLink,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminSettlementDetailPage() {
  const params = useParams();
  const settlementId = params?.id;

  const [settlement, setSettlement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!settlementId) return;
    let isMounted = true;

    adminFinanceService
      .getSettlementById(settlementId)
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data || res;
        setSettlement(data);
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load settlement statement", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [settlementId]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Settlement Statement Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This statement was not found in the platform ledger.
        </p>
        <Link
          href="/administrator/finance/settlements"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Settlements</span>
        </Link>
      </div>
    );
  }

  const status = settlement.status || "pending";
  const vendor = settlement.vendorId || {};
  const orders = settlement.orderIds || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <div>
        <Link
          href="/administrator/finance/settlements"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Settlements</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Statement #{settlement.settlementNumber || settlement.secureId}
              </h2>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                status === "paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : status === "payable" || status === "processing"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Period: {settlement.periodStart ? new Date(settlement.periodStart).toLocaleDateString("en-IN") : "Start"} — {settlement.periodEnd ? new Date(settlement.periodEnd).toLocaleDateString("en-IN") : "End"}
            </p>
          </div>

          {settlement.payoutReference && (
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Payout Reference
              </span>
              <span className="font-mono text-xs font-bold text-slate-800">
                {settlement.payoutReference}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Profile & Bank Overview */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
            Merchant Partner
          </span>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <Store className="size-4 text-[#004D38]" />
            <span>{vendor.storeName || vendor.businessName || "Vendor"}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{vendor.email} • {vendor.phone || "No phone"}</p>
        </div>

        {vendor.bankAccount && (
          <div className="text-right text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Bank Details
            </span>
            <span className="font-mono text-slate-800 font-semibold">{vendor.bankAccount.accountNumber}</span>
            <span className="text-slate-500 block font-mono text-[11px]">{vendor.bankAccount.ifscCode}</span>
          </div>
        )}
      </div>

      {/* Accounting Breakdown */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
          <Receipt className="size-4 text-[#004D38]" />
          <span>Accounting Reconciliation</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Gross Volume
            </span>
            <span className="text-xl font-black text-slate-900">
              ₹{Number(settlement.grossSales || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Discounts / Adjustments
            </span>
            <span className="text-xl font-black text-slate-700">
              -₹{Number(settlement.discounts || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Platform Commission
            </span>
            <span className="text-xl font-black text-emerald-700">
              +₹{Number(settlement.platformCommission || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
              Disbursed to Vendor
            </span>
            <span className="text-2xl font-black text-blue-900">
              ₹{Number(settlement.netPayable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Associated Orders */}
      {orders.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200/80">
            <h3 className="text-sm font-bold text-slate-900">Reconciled Marketplace Orders ({orders.length})</h3>
            <p className="text-xs text-slate-500">Orders settled in this billing batch</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">Order Number</th>
                  <th className="px-6 py-3.5">Order Date</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Order Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/administrator/operations/orders/${order.secureId || order._id}`}
                        className="font-mono font-bold text-[#004D38] hover:underline inline-flex items-center gap-1"
                      >
                        <span>{order.orderNumber || order.secureId || order._id}</span>
                        <ExternalLink className="size-3 text-slate-400" />
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {order.placedAt ? new Date(order.placedAt).toLocaleDateString("en-IN") : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {order.status || "delivered"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      ₹{Number(order.grandTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
