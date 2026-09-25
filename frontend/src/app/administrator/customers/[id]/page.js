"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Clock,
  ExternalLink,
} from "lucide-react";
import { adminCustomerService } from "@/services/admin/admin.service.js";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id;

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCustomer = async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminCustomerService.get(customerId);
      setCustomer(data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load customer profile"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  const handleToggleStatus = async () => {
    if (!customer) return;
    const newStatus = !customer.isActive;
    const action = newStatus ? "reactivate" : "suspend";
    if (
      !confirm(
        `Are you sure you want to ${action} ${customer.firstName} ${customer.lastName}?`
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      await adminCustomerService.updateStatus(customer.id, newStatus);
      setActionSuccess(`Customer ${action}d successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      setCustomer((prev) => (prev ? { ...prev, isActive: newStatus } : null));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to ${action} customer`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link
          href="/administrator/customers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Customers</span>
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error || "Customer profile could not be found."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/administrator/customers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Customer Directory</span>
        </Link>
        <button
          onClick={fetchCustomer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Customer Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold text-xl">
              {customer.firstName?.[0]}
              {customer.lastName?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {customer.firstName} {customer.lastName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    customer.isActive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {customer.isActive ? "Active" : "Suspended"}
                </span>
                {customer.isEmailVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                <Mail className="size-3.5" /> {customer.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleStatus}
              disabled={actionLoading}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                customer.isActive
                  ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              {customer.isActive ? "Suspend Account" : "Reactivate Account"}
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Phone Number
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              {customer.profile?.phone || "Not provided"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Member Since
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Last Login
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              {customer.lastLoginAt
                ? new Date(customer.lastLoginAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Never"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Orders
            </div>
            <div className="text-sm font-bold text-[#004D38] mt-0.5">
              {customer.orders?.length || 0} orders
            </div>
          </div>
        </div>
      </div>

      {/* Orders Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShoppingBag className="size-4 text-[#004D38]" />
          <span>Recent Orders</span>
        </h2>

        {customer.orders?.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No orders found for this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {customer.orders?.map((ord) => (
                  <tr key={ord._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      #{ord.orderNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(ord.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(ord.grandTotal)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ord.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/administrator/operations/orders/${ord._id}`}
                        className="inline-flex items-center gap-1 text-[#004D38] hover:underline font-semibold"
                      >
                        <span>View</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Return Requests Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <RotateCcw className="size-4 text-[#004D38]" />
          <span>Return &amp; Refund History</span>
        </h2>

        {customer.returns?.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No return requests filed by this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Return ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {customer.returns?.map((ret) => (
                  <tr key={ret._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      #{ret._id.slice(-8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(ret.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{ret.type || "refund"}</td>
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
