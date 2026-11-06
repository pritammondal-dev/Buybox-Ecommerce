"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Landmark,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Search,
  RefreshCw,
  Filter,
  Eye,
  KeyRound,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  Building,
  User,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { adminBankAccountService } from "../../../services/admin/bank-account.service.js";
import { useAdminAuthStore } from "../../../stores/admin-auth.store.js";
import { ReasonConfirmModal } from "../../../components/admin/ReasonConfirmModal.jsx";
import { PrivilegedUnmaskModal } from "../../../components/admin/bank-accounts/PrivilegedUnmaskModal.jsx";
import { getAdminVendorUrl } from "../../../utils/secure-id.util.js";

const STATUS_TABS = [
  { id: "pending", label: "Pending Review", icon: Clock },
  { id: "under_review", label: "Under Review", icon: ShieldAlert },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Changes Required", icon: XCircle },
  { id: "all", label: "All Applications" },
];

export default function AdminBankApplicationsPage() {
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canReview = hasPermission("vendors.bank_accounts.review");
  const canApprove = hasPermission("vendors.bank_accounts.approve");
  const canReject = hasPermission("vendors.bank_accounts.reject");
  const canUnmask = hasPermission("vendors.bank_accounts.view_unmasked");

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [serverError, setServerError] = useState(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Action targets & modal states
  const [unmaskTarget, setUnmaskTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchApplications = useCallback(
    async (showSuccessToast = false) => {
      try {
        setLoading(true);
        setServerError(null);

        const params = {
          page: pagination.page,
          limit: pagination.limit,
          status: activeTab === "all" ? "all" : activeTab,
          search: searchTerm.trim() || undefined,
        };

        const result = await adminBankAccountService.listApplications(params);
        setApplications(result.items || []);
        if (result.meta) {
          setPagination((prev) => ({
            ...prev,
            total: result.meta.total || 0,
            totalPages: result.meta.totalPages || 1,
          }));
        }

        if (showSuccessToast) {
          toast.success("Review queue updated");
        }
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load bank applications";
        setServerError(msg);
        toast.error("Failed to load review queue", { description: msg });
      } finally {
        setLoading(false);
      }
    },
    [activeTab, searchTerm, pagination.page, pagination.limit]
  );

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Handle Approve
  const handleApproveConfirm = async (reasonArg) => {
    if (!approveTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      const reason = typeof reasonArg === "object" && reasonArg !== null ? reasonArg.reason : reasonArg;
      const accountId = approveTarget.id || approveTarget._id;
      await adminBankAccountService.approveApplication(accountId, reason);
      toast.success("Bank account application approved", {
        description: `${approveTarget.bankName} is now verified for merchant settlements.`,
      });
      setApproveTarget(null);
      await fetchApplications();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to approve bank application";
      setModalError(msg);
      toast.error("Approval failed", { description: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reject
  const handleRejectConfirm = async (reasonArg) => {
    if (!rejectTarget) return;
    setActionLoading(true);
    setModalError(null);
    try {
      const reason = typeof reasonArg === "object" && reasonArg !== null ? reasonArg.reason : reasonArg;
      const accountId = rejectTarget.id || rejectTarget._id;
      await adminBankAccountService.rejectApplication(accountId, reason);
      toast.success("Bank account application rejected", {
        description: "Rejection feedback dispatched to merchant console.",
      });
      setRejectTarget(null);
      await fetchApplications();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to reject bank application";
      setModalError(msg);
      toast.error("Rejection failed", { description: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Mark Under Review
  const handleMarkUnderReview = async (app) => {
    try {
      const accountId = app.id || app._id;
      await adminBankAccountService.markUnderReview(accountId);
      toast.success("Marked under review", {
        description: "Application moved to active compliance investigation.",
      });
      await fetchApplications();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to mark under review";
      toast.error("Action failed", { description: msg });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Landmark className="size-6 text-[#004D38]" />
            <span>Bank Account Application Review Queue</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Review, verify, and moderate merchant settlement banking credentials across marketplace partners.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchApplications(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Status Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Tab pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shadow-xs ${
                  isSelected
                    ? "bg-[#004D38] text-white shadow-emerald-950/10"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80"
                }`}
              >
                {Icon && <Icon className="size-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Search bank, IFSC, vendor..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004D38]/20 focus:border-[#004D38] transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Error loading applications</p>
              <p className="text-rose-700 mt-0.5">{serverError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchApplications()}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Applications Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Applications
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {pagination.total} Total
            </span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
        </div>

        {loading && applications.length === 0 ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : applications.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Landmark className="size-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">
              No Applications Found
            </h4>
            <p className="mt-1 max-w-sm mx-auto text-slate-500">
              There are no bank account applications matching the selected status or search query.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Target Merchant</th>
                  <th className="py-3.5 px-5">Bank Details</th>
                  <th className="py-3.5 px-5">Account Number</th>
                  <th className="py-3.5 px-5">IFSC</th>
                  <th className="py-3.5 px-5">Submitted</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {applications.map((app) => {
                  const vendor = app.vendorId || {};
                  const isAppApproved = app.status === "approved";
                  const isAppPending = app.status === "pending";
                  const isAppUnderReview = app.status === "under_review";
                  const isAppRejected = app.status === "rejected";
                  const vendorUrl = vendor._id || vendor.id
                    ? getAdminVendorUrl(vendor.secureId || vendor._id || vendor.id)
                    : "#";

                  return (
                    <tr
                      key={app._id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Merchant */}
                      <td className="py-4 px-5">
                        <div className="min-w-0">
                          <Link
                            href={vendorUrl}
                            className="font-bold text-slate-900 hover:text-[#004D38] inline-flex items-center gap-1 group"
                          >
                            <span className="truncate">
                              {vendor.businessName || vendor.storeName || "Unknown Merchant"}
                            </span>
                            <ExternalLink className="size-3 text-slate-400 group-hover:text-[#004D38] shrink-0" />
                          </Link>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {vendor.email || vendor.phone || "No contact info"}
                          </div>
                        </div>
                      </td>

                      {/* Bank Details */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900">
                          {app.bankName}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {app.accountType || "Current"} • {app.accountHolderName}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Branch: {app.branchName || "Not provided"} {app.country ? `• ${app.country}` : ""}{app.state ? ` (${app.state})` : ""}
                        </div>
                      </td>

                      {/* Masked Account Number */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800">
                            {app.accountNumberMasked || "••••••••••••••••"}
                          </span>
                          {canUnmask && (
                            <button
                              type="button"
                              onClick={() => setUnmaskTarget(app)}
                              title="Privileged Unmask"
                              className="p-1 rounded-md text-amber-700 hover:bg-amber-100 transition-colors"
                            >
                              <KeyRound className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* IFSC */}
                      <td className="py-4 px-5 font-mono font-bold uppercase text-slate-700">
                        {app.ifscCode}
                      </td>

                      {/* Submitted Date */}
                      <td className="py-4 px-5 text-slate-600 whitespace-nowrap">
                        {formatDate(app.submittedAt || app.createdAt)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isAppApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3 text-emerald-600" /> Approved
                          </span>
                        )}
                        {isAppPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="size-3 text-amber-600" /> Pending Review
                          </span>
                        )}
                        {isAppUnderReview && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <ShieldAlert className="size-3 text-indigo-600" /> Under Review
                          </span>
                        )}
                        {isAppRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="size-3 text-rose-600" /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Action Controls */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canApprove && !isAppApproved && (
                            <button
                              type="button"
                              onClick={() => setApproveTarget(app)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                            >
                              Approve
                            </button>
                          )}

                          {canReject && !isAppRejected && (
                            <button
                              type="button"
                              onClick={() => setRejectTarget(app)}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                            >
                              Reject
                            </button>
                          )}

                          {canReview && isAppPending && (
                            <button
                              type="button"
                              onClick={() => handleMarkUnderReview(app)}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold text-[11px] transition-colors"
                            >
                              Review
                            </button>
                          )}

                          <Link
                            href={vendorUrl}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Inspect in Vendor Detail"
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {applications.length} of {pagination.total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors disabled:opacity-40"
              >
                Previous
              </button>
              <span className="font-semibold text-slate-700 px-2">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    page: Math.min(pagination.totalPages, p.page + 1),
                  }))
                }
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Privileged Unmask Modal */}
      <PrivilegedUnmaskModal
        isOpen={!!unmaskTarget}
        account={unmaskTarget}
        onClose={() => setUnmaskTarget(null)}
      />

      {/* Reject Application Modal */}
      <ReasonConfirmModal
        isOpen={!!rejectTarget}
        onClose={() => {
          setRejectTarget(null);
          setModalError(null);
        }}
        onConfirm={handleRejectConfirm}
        title="Reject Bank Account Application"
        description="State the operational reason for rejecting this bank account. Feedback will be presented directly to the merchant for resubmission."
        targetIdentity={rejectTarget ? `${rejectTarget.bankName} (${rejectTarget.accountNumberMasked})` : ""}
        actionType="deactivate"
        isDestructive={true}
        confirmLabel="Confirm Rejection"
        isLoading={actionLoading}
        errorMessage={modalError}
        placeholder="Explain what must be corrected (e.g. IFSC code invalid, legal entity name mismatch with GST certificate)..."
        minChars={10}
        maxChars={500}
      />

      {/* Approve Application Confirmation Modal */}
      <ReasonConfirmModal
        isOpen={!!approveTarget}
        onClose={() => {
          setApproveTarget(null);
          setModalError(null);
        }}
        onConfirm={handleApproveConfirm}
        title="Approve Bank Account Application"
        description="Verify and approve this bank account for marketplace settlement payouts. Note: If the merchant has no live payout destination, this account will be automatically activated."
        targetIdentity={approveTarget ? `${approveTarget.bankName} (${approveTarget.accountNumberMasked})` : ""}
        actionType="reactivate"
        isDestructive={false}
        confirmLabel="Approve Bank Account"
        isLoading={actionLoading}
        errorMessage={modalError}
        placeholder="Optional approval compliance notes (e.g. Verified against bank passbook and PAN)..."
        minChars={0}
        maxChars={500}
      />
    </div>
  );
}

