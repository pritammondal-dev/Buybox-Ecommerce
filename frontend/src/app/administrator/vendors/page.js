"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  Users,
  Building,
  Mail,
  Phone,
  Package,
  ShoppingBag,
  X,
  Filter,
  Lock,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { adminVendorService } from "../../../services/admin/vendor.service.js";
import { getAdminVendorUrl } from "../../../utils/secure-id.util.js";
import { StatusBadge } from "../../../components/admin/StatusBadge.jsx";
import { ReasonConfirmModal } from "../../../components/admin/ReasonConfirmModal.jsx";
import { VendorIdBadge } from "../../../components/admin/VendorIdBadge.jsx";
import { useAdminAuthStore } from "../../../stores/admin-auth.store.js";

const TABS = [
  { id: "all", label: "All Vendors", key: "total" },
  { id: "pending", label: "Pending Review", icon: Clock, key: "pending" },
  { id: "approved", label: "Approved Merchants", icon: CheckCircle2, key: "approved" },
  { id: "changes_requested", label: "Changes Requested", icon: AlertTriangle, key: "changes_requested" },
  { id: "suspended", label: "Suspended", icon: ShieldAlert, key: "suspended" },
  { id: "rejected", label: "Rejected", icon: XCircle, key: "rejected" },
];

export default function AdminVendorsPage() {
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canSuspend = hasPermission("vendors.suspend");
  const canApprove = hasPermission("vendors.approve");
  const canResetPassword = hasPermission("vendors.reset_password");
  const canDelete = hasPermission("vendors.delete");

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activityFilter, setActivityFilter] = useState("all"); // "all" | "has_products" | "has_orders"
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Reset Password State
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState(null);

  // Soft-Deactivation State
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deactivateModalError, setDeactivateModalError] = useState(null);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    changes_requested: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
    inactive: 0,
    total: 0,
  });

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: activeTab === "all" ? undefined : activeTab,
        search: searchTerm.trim() || undefined,
        activity: activityFilter === "all" ? undefined : activityFilter,
      };

      const result = await adminVendorService.listVendors(params);
      const fetchedVendors = result.vendors || [];

      setVendors(fetchedVendors);
      if (result.statusCounts || result.pagination?.statusCounts) {
        setStatusCounts(result.statusCounts || result.pagination.statusCounts);
      }
      if (result.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
        }));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load vendors from server");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, activityFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchVendors();
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleToggleStatus = (vendor) => {
    setModalError(null);
    setStatusTarget(vendor);
  };

  const handleConfirmStatusChange = async ({ reason }) => {
    if (!statusTarget) return;
    const isSuspending = statusTarget.isActive;
    const action = isSuspending ? "suspend" : "reactivate";
    const targetId = statusTarget.secureId || statusTarget._id;

    setStatusLoading(true);
    setModalError(null);
    try {
      if (isSuspending) {
        await adminVendorService.suspendVendor(targetId, reason);
        toast.success(`Merchant "${statusTarget.businessName}" suspended, store unpublished, and sessions revoked.`);
      } else {
        await adminVendorService.reactivateVendor(targetId, reason);
        toast.success(`Merchant "${statusTarget.businessName}" reactivated and active product catalog published.`);
      }
      setStatusTarget(null);
      fetchVendors();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || `Failed to ${action} vendor`;
      setModalError(msg);
      toast.error(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConfirmResetPassword = async ({ reason }) => {
    if (!passwordTarget) return;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      setPasswordModalError("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordModalError("New password and confirmation password do not match.");
      return;
    }
    const targetId = passwordTarget.secureId || passwordTarget._id;
    setPasswordLoading(true);
    setPasswordModalError(null);
    try {
      await adminVendorService.resetVendorPassword(targetId, newPassword, reason);
      toast.success(`Merchant "${passwordTarget.businessName}" password reset securely. Active sessions invalidated.`);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reset vendor password";
      setPasswordModalError(msg);
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConfirmDeactivate = async ({ reason }) => {
    if (!deactivateTarget) return;
    const targetId = deactivateTarget.secureId || deactivateTarget._id;
    setDeactivateLoading(true);
    setDeactivateModalError(null);
    try {
      await adminVendorService.deleteVendor(targetId, reason);
      toast.success(`Merchant "${deactivateTarget.businessName}" safely soft-deactivated and active sessions invalidated.`);
      setDeactivateTarget(null);
      fetchVendors();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to deactivate vendor";
      setDeactivateModalError(msg);
      toast.error(msg);
    } finally {
      setDeactivateLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Page Title & Operational Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Store className="h-7 w-7 text-emerald-600" />
            <span>Superadmin Vendor Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative platform directory of merchant accounts, seller governance, operational metrics, and application lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVendors}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 shadow-xs transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Authoritative Aggregate KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Vendors on Record */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total On File</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {statusCounts.total || 0}
          </p>
          <span className="text-[10px] text-slate-400">Live database records</span>
        </div>

        {/* Needs Review (Pending) */}
        <div className="p-5 bg-amber-50/70 rounded-2xl border border-amber-200/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-900">
            {statusCounts.pending || 0}
          </p>
          <span className="text-[10px] text-amber-700/80">Requires approval decision</span>
        </div>

        {/* Approved & Active Merchants */}
        <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Approved Merchants</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-900">
            {statusCounts.approved || 0}
          </p>
          <span className="text-[10px] text-emerald-700/80">Authorized seller consoles</span>
        </div>

        {/* Suspended Vendors */}
        <div className="p-5 bg-rose-50/70 rounded-2xl border border-rose-200/70 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Suspended / Inactive</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-900">
            {(statusCounts.suspended || 0) + (statusCounts.rejected || 0)}
          </p>
          <span className="text-[10px] text-rose-700/80">
            {statusCounts.suspended || 0} suspended • {statusCounts.rejected || 0} rejected
          </span>
        </div>
      </div>

      {/* Filter Tabs, Search Bar & Activity Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = statusCounts[tab.key] ?? 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#004D38] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Activity Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Activity dropdown */}
          <div className="relative">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="text-xs font-semibold py-2 pl-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Activity</option>
              <option value="has_products">With Products</option>
              <option value="has_orders">With Orders</option>
            </select>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search store, user, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Vendors Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Querying real vendor directory...</p>
            <p className="text-xs text-slate-400 mt-0.5">Aggregating live products, orders, and governance states</p>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-16 text-center">
            <Building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No vendor records found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchTerm
                ? `No merchant partners match the query "${searchTerm}". Try broadening your search or clearing filters.`
                : "No vendor records currently match the selected status filter."}
            </p>
            {(searchTerm || activeTab !== "all" || activityFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setActiveTab("all");
                  setActivityFilter("all");
                }}
                className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>

                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((vendor) => {
                  const applicant = vendor.userId || {};
                  const applicantName =
                    applicant.firstName || applicant.lastName
                      ? `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim()
                      : "Unassigned";

                  const applicantEmail = vendor.supportEmail || applicant.email || vendor.email || "N/A";
                  const applicantPhone = vendor.phone || applicant.phone || null;
                  const detailUrl = getAdminVendorUrl(vendor);
                  const isSuspended = vendor.onboardingStatus === "suspended" || vendor.isActive === false;

                  return (
                    <tr
                      key={vendor._id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* 1. Store / Merchant */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/60 shadow-2xs mt-0.5">
                            {vendor.businessName?.charAt(0)?.toUpperCase() || "V"}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 text-sm block">
                              {vendor.businessName}
                            </span>
                            {vendor.businessSlug && (
                              <span className="text-slate-400 text-[11px] font-mono block mt-0.5">
                                /{vendor.businessSlug}
                              </span>
                            )}
                            <div className="mt-1.5">
                              <VendorIdBadge id={vendor.secureId || String(vendor._id)} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Linked User & Contact */}
                      <td className="px-5 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 block">
                              {applicantName}
                            </span>
                            {applicant._id && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1 rounded border border-slate-200" title={`Linked User ID: ${applicant._id}`}>
                                User: {String(applicant._id).slice(-6)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {applicant.roles && applicant.roles.length > 1 ? (
                              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                Multi-Role ({applicant.roles.join(", ")})
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Merchant
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={applicantEmail}>
                                {applicantEmail}
                              </span>
                            </span>
                            {applicantPhone && (
                              <span className="flex items-center gap-1.5 font-mono text-slate-600">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                {applicantPhone}
                              </span>
                            )}
                          </div>
                          {vendor.taxInformation?.taxId && (
                            <div className="mt-1">
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                GSTIN: {vendor.taxInformation.taxId}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>


                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <StatusBadge status={vendor.onboardingStatus || "pending"} />
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {applicant.isEmailVerified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                <CheckCircle2 className="size-2.5" /> Email Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <Clock className="size-2.5" /> Email Pending
                              </span>
                            )}

                            {vendor.deletedAt ? (
                              <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                Deactivated
                              </span>
                            ) : vendor.isActive ? (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Products & Orders */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Package className="size-3.5 text-emerald-600" />
                            <span className="font-bold text-slate-900">
                              {vendor.productsCount || 0}
                            </span>
                            <span className="text-slate-400 text-[11px]">products</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ShoppingBag className="size-3.5 text-blue-600" />
                            <span className="font-bold text-slate-900">
                              {vendor.ordersCount || 0}
                            </span>
                            <span className="text-slate-400 text-[11px]">orders</span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Registered */}
                      <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                        {vendor.createdAt ? (
                          <div>
                            <span className="block font-medium text-slate-700">
                              {new Date(vendor.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(vendor.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* 6. Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 relative">
                          <Link
                            href={detailUrl}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs ${
                              vendor.onboardingStatus === "approved"
                                ? "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
                            }`}
                          >
                            <span>{vendor.onboardingStatus === "approved" ? "Inspect" : "Review"}</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>

                          {!vendor.deletedAt && (vendor.onboardingStatus === "approved" || vendor.onboardingStatus === "suspended" || vendor.onboardingStatus === "inactive") && (
                            <div className="relative">
                              <button
                                onClick={() => setOpenActionMenuId(openActionMenuId === vendor._id ? null : vendor._id)}
                                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs"
                                title="More Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>

                              {openActionMenuId === vendor._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setOpenActionMenuId(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-left">
                                    {vendor.isActive && canSuspend && (
                                      <button
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          handleToggleStatus(vendor);
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                      >
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        <span>Suspend Vendor</span>
                                      </button>
                                    )}
                                    {!vendor.isActive && canApprove && (
                                      <button
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          handleToggleStatus(vendor);
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        <span>Reactivate Vendor</span>
                                      </button>
                                    )}
                                    {canResetPassword && (
                                      <button
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setNewPassword("");
                                          setConfirmPassword("");
                                          setPasswordModalError(null);
                                          setPasswordTarget(vendor);
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                      >
                                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Reset Password</span>
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setDeactivateModalError(null);
                                          setDeactivateTarget(vendor);
                                        }}
                                        className="w-full px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-100"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                        <span>Safe Deactivation</span>
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {vendor.deletedAt && (
                            <span className="text-[11px] font-semibold text-slate-400 italic px-2 py-1 bg-slate-50 rounded-lg border border-slate-200/60">
                              Deactivated
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span>
              Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total vendors)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vendor Status Reason Confirmation Modal */}
      <ReasonConfirmModal
        isOpen={Boolean(statusTarget)}
        onClose={() => {
          setStatusTarget(null);
          setModalError(null);
        }}
        onConfirm={handleConfirmStatusChange}
        isLoading={statusLoading}
        errorMessage={modalError}
        targetIdentity={statusTarget ? `${statusTarget.businessName} (${statusTarget.supportEmail || statusTarget.businessSlug || ""})` : ""}
        actionType={statusTarget?.isActive ? "suspend" : "reactivate"}
        title={`${statusTarget?.isActive ? "Suspend" : "Reactivate"} Merchant Partner`}
        description={
          statusTarget?.isActive
            ? "Suspension revokes merchant console tokens immediately, unpublishes all vendor products from the storefront, and marks the account as suspended until reactivated."
            : "Reactivation restores merchant console login privileges and publishes active catalog products back to the storefront."
        }
        confirmLabel={statusTarget?.isActive ? "Confirm Suspension" : "Confirm Reactivation"}
      />

      {/* Vendor Password Reset Modal */}
      <ReasonConfirmModal
        isOpen={Boolean(passwordTarget)}
        onClose={() => {
          setPasswordTarget(null);
          setNewPassword("");
          setConfirmPassword("");
          setPasswordModalError(null);
        }}
        onConfirm={handleConfirmResetPassword}
        isLoading={passwordLoading}
        errorMessage={passwordModalError}
        targetIdentity={passwordTarget ? `${passwordTarget.businessName} (${passwordTarget.supportEmail || passwordTarget.businessSlug || ""})` : ""}
        actionType="reset-password"
        title="Reset Merchant Password"
        description="Administrative password reset will securely write a bcrypt hash to the database, increment the vendor account authVersion, and immediately invalidate all active sessions."
        confirmLabel="Reset Password & Invalidate Sessions"
        extraFields={
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>New Merchant Password</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters with upper, lower, number, and symbol"
                className="w-full text-xs p-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Confirm New Password</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter the new password to confirm"
                className="w-full text-xs p-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[11px] font-semibold text-rose-600">
                  Passwords do not match.
                </p>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Password must be at least 8 characters long with uppercase, lowercase, digit, and special symbol.
            </p>
          </div>
        }
      />

      {/* Vendor Soft-Deactivation Modal */}
      <ReasonConfirmModal
        isOpen={Boolean(deactivateTarget)}
        onClose={() => {
          setDeactivateTarget(null);
          setDeactivateModalError(null);
        }}
        onConfirm={handleConfirmDeactivate}
        isLoading={deactivateLoading}
        errorMessage={deactivateModalError}
        targetIdentity={deactivateTarget ? `${deactivateTarget.businessName} (${deactivateTarget.supportEmail || deactivateTarget.businessSlug || ""})` : ""}
        actionType="deactivate"
        isDestructive={true}
        requireAcknowledgment={true}
        acknowledgmentText="I acknowledge that deactivating this merchant account revokes login access, unpublishes all catalog listings, and preserves historical orders, shipments, customer returns, and financial settlements."
        title="Soft-Deactivate Merchant Account"
        description="Soft-deactivation will immediately terminate merchant console login credentials, revoke active tokens, and hide all catalog products from the storefront. In accordance with tax and legal requirements, all historical orders, shipments, customer returns, and financial ledger settlements are preserved in the platform database."
        confirmLabel="Confirm Merchant Deactivation"
      />
    </div>
  );
}
