"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { adminOperationsService } from "@/services/admin/admin.service.js";

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const fetchRefunds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminOperationsService.listRefunds();
      const list = res?.refunds || res?.data?.refunds || res?.data || res || [];
      setRefunds(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load processed refunds"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const filtered = refunds.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const ordNum = r.order?.orderNumber || "";
    const gatewayId = r.gatewayRefundId || "";
    const custEmail = r.customer?.email || "";
    return (
      ordNum.toLowerCase().includes(s) ||
      gatewayId.toLowerCase().includes(s) ||
      custEmail.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Receipt className="size-6 text-[#004D38]" />
            <span>Customer Refunds Ledger</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative financial transaction logs for payment gateway reversals and order compensations
          </p>
        </div>

        <button
          onClick={fetchRefunds}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Refunds Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Gateway ID, or customer..."
              className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
            />
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {filtered.length} refunds
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading refunds ledger...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Receipt className="size-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No refunds recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Refund ID / Gateway</th>
                  <th className="py-3.5 px-4">Order Number</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((ref) => (
                  <tr key={ref.id || ref._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">
                        {ref.gatewayRefundId || `REF-${(ref.id || ref._id).slice(-8).toUpperCase()}`}
                      </div>
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                        {ref.gateway || "Razorpay"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800">
                      {ref.order?.orderNumber ? `#${ref.order.orderNumber}` : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>
                        {ref.customer?.firstName} {ref.customer?.lastName}
                      </div>
                      <div className="text-[11px] text-slate-400">{ref.customer?.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                      {formatCurrency(ref.amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ref.status === "processed" || ref.status === "succeeded"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : ref.status === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ref.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(ref.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
