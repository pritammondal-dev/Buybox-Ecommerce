"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Clock,
  Shield,
} from "lucide-react";
import { adminCustomerService } from "@/services/admin/admin.service.js";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchCustomers = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (activeFilter) params.isActive = activeFilter;
      if (verifiedFilter) params.isEmailVerified = verifiedFilter;

      const result = await adminCustomerService.list(params);
      setCustomers(result?.customers || []);
      setPagination({
        page: result?.page || 1,
        total: result?.total || 0,
        totalPages: result?.totalPages || 1,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load customers"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
  }, [activeFilter, verifiedFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers(1);
  };

  const handleToggleStatus = async (customer) => {
    const newStatus = !customer.isActive;
    const action = newStatus ? "reactivate" : "suspend";
    if (!confirm(`Are you sure you want to ${action} ${customer.firstName} ${customer.lastName}?`)) return;

    try {
      await adminCustomerService.updateStatus(customer.id, newStatus);
      setActionSuccess(`Customer ${action}d successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchCustomers(pagination.page);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || `Failed to ${action} customer`);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="size-6 text-emerald-600" />
            <span>Customer Directory</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered customer accounts, orders, and account statuses
          </p>
        </div>

        <div className="text-xs text-slate-500 font-semibold bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
          Total Customers: <span className="text-slate-900 font-bold">{pagination.total}</span>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">Account: All</option>
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>

          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="text-xs font-semibold py-2 px-3 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            <option value="">Email: All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>

          <button
            onClick={() => fetchCustomers(pagination.page)}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Email Verified</th>
                <th className="px-6 py-3.5">Orders</th>
                <th className="px-6 py-3.5">Total Spent</th>
                <th className="px-6 py-3.5">Registered</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-slate-400 text-[11px]">{c.email}</div>
                      {c.phone && (
                        <div className="text-slate-500 text-[10px]">{c.phone}</div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                          c.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            c.isActive ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                        {c.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {c.isEmailVerified ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle className="size-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="size-3.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-slate-700 font-semibold">
                      {c.totalOrders} orders
                    </td>

                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrency(c.totalSpent)}
                    </td>

                    <td className="px-6 py-4 text-slate-500 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          c.isActive
                            ? "text-rose-600 hover:bg-rose-50"
                            : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {c.isActive ? "Suspend" : "Reactivate"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400 text-xs">
                    {loading ? "Loading customers..." : "No customers found matching criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => fetchCustomers(pagination.page - 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => fetchCustomers(pagination.page + 1)}
                className="px-3 py-1 bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
