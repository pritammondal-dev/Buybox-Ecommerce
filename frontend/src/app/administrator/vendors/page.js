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
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Users,
  Building,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { adminVendorService } from "../../../services/admin/vendor.service.js";
import { getAdminVendorUrl } from "../../../utils/secure-id.util.js";
import { StatusBadge } from "../../../components/admin/StatusBadge.jsx";

const TABS = [
  { id: "all", label: "All Vendors" },
  { id: "pending", label: "Pending Review", icon: Clock },
  { id: "changes_requested", label: "Changes Requested", icon: AlertTriangle },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle },
  { id: "suspended", label: "Suspended", icon: ShieldAlert },
];

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: activeTab === "all" ? undefined : activeTab,
        search: searchTerm.trim() || undefined,
      };

      const result = await adminVendorService.listVendors(params);
      setVendors(result.vendors || []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load vendor applications");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, pagination.page, pagination.limit]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      try {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          status: activeTab === "all" ? undefined : activeTab,
          search: searchTerm.trim() || undefined,
        };

        const result = await adminVendorService.listVendors(params);
        if (!isMounted) return;
        setVendors(result.vendors || []);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } catch (err) {
        if (isMounted) toast.error(err.response?.data?.message || "Failed to load vendor applications");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [activeTab, searchTerm, pagination.page, pagination.limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchVendors();
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Counts summary
  const pendingCount = vendors.filter((v) => v.onboardingStatus === "pending").length;
  const changesCount = vendors.filter((v) => v.onboardingStatus === "changes_requested").length;
  const approvedCount = vendors.filter((v) => v.onboardingStatus === "approved").length;
  const rejectedCount = vendors.filter((v) => v.onboardingStatus === "rejected").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Store className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Vendor Onboarding & Governance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review merchant partner applications, manage approval lifecycles, and inspect seller credentials.
          </p>
        </div>
        <button
          onClick={fetchVendors}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total On File</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {pagination.total || vendors.length}
          </p>
        </div>

        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/70 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Needs Review</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-900 dark:text-amber-300">
            {activeTab === "pending" ? pagination.total : pendingCount}
          </p>
        </div>

        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/70 dark:border-emerald-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active Merchants</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-900 dark:text-emerald-300">
            {activeTab === "approved" ? pagination.total : approvedCount}
          </p>
        </div>

        <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200/70 dark:border-rose-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Action Required / Rej</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-rose-900 dark:text-rose-300">
            {activeTab === "rejected" ? pagination.total : rejectedCount + changesCount}
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative min-w-[260px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search store, applicant, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </form>
      </div>

      {/* Vendors Table / List */}
      <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading vendor applications...</p>
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center">
            <Building className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No vendor applications found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {searchTerm ? "Try broadening your search query." : "No applications currently match this status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Vendor / Store</th>
                  <th className="px-5 py-3.5">Vendor Name / Contact</th>
                  <th className="px-5 py-3.5">GSTIN</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {vendors.map((vendor) => {
                  const applicantName =
                    vendor.userId?.firstName || vendor.userId?.lastName
                      ? `${vendor.userId?.firstName || ""} ${vendor.userId?.lastName || ""}`.trim()
                      : "Unassigned";

                  const applicantEmail = vendor.userId?.email || vendor.supportEmail || "N/A";
                  const detailUrl = getAdminVendorUrl(vendor);

                  return (
                    <tr
                      key={vendor._id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200/50 dark:border-emerald-800/40">
                            {vendor.businessName?.charAt(0)?.toUpperCase() || "V"}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-sm block">
                              {vendor.businessName}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">
                              /{vendor.businessSlug}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200 block">
                            {applicantName}
                          </span>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-400" />
                              {applicantEmail}
                            </span>
                            {(vendor.phone || vendor.userId?.phone) && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {vendor.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={vendor.onboardingStatus || "pending"} />
                        {vendor.onboardingStatus === "rejected" && vendor.rejectionReason && (
                          <span className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs truncate" title={vendor.rejectionReason}>
                            Reason: {vendor.rejectionReason}
                          </span>
                        )}
                        {vendor.onboardingStatus === "changes_requested" && vendor.changesRequestedReason && (
                          <span className="block text-[11px] text-amber-600 dark:text-amber-400 mt-1 max-w-xs truncate" title={vendor.changesRequestedReason}>
                            Notes: {vendor.changesRequestedReason}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {vendor.createdAt
                          ? new Date(vendor.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={detailUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/60 transition-colors"
                        >
                          Review Application
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
