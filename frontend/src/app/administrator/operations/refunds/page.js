"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Receipt,
  RefreshCw,
  Search,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Boxes,
  Package,
  CreditCard,
  XCircle,
  Eye,
  Check,
  X,
  FileText,
  AlertCircle,
  Loader2,
  Filter,
  ArrowRight,
  Send,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { adminOperationsService } from "@/services/admin/admin.service.js";
import { useAdminAuthStore } from "@/stores/admin-auth.store.js";
import { formatCurrency, parsePrice } from "@/utils/formatCurrency";

export default function AdminRefundsPage() {
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canViewApps = hasPermission("refund_applications.view");
  const canReviewApps = hasPermission("refund_applications.review");
  const canApproveApps = hasPermission("refund_applications.approve");
  const canRejectApps = hasPermission("refund_applications.reject");
  const canReviseApps = hasPermission("refund_applications.revise");
  const canDisburse = hasPermission("refund_disbursements.initiate") || hasPermission("refunds.create");

  // Active Tab: "applications" or "ledger"
  const [activeTab, setActiveTab] = useState("applications");

  // Applications State
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsKpis, setApplicationsKpis] = useState(null);
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [appSearch, setAppSearch] = useState("");

  // Ledger State
  const [refunds, setRefunds] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [error, setError] = useState(null);

  // Selected Application for Detail Modal / Drawer
  const [selectedApp, setSelectedApp] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Sub-action Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionInstructions, setRevisionInstructions] = useState("");

  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [disburseRemarks, setDisburseRemarks] = useState("");

  const [previewImage, setPreviewImage] = useState(null);

  // Fetch Applications Queue
  const fetchApplications = useCallback(async () => {
    setApplicationsLoading(true);
    setError(null);
    try {
      const params = {};
      if (appStatusFilter !== "all") params.status = appStatusFilter;
      if (appSearch.trim()) params.search = appSearch.trim();

      const res = await adminOperationsService.listRefundApplications(params);
      const data = res?.data?.data || res?.data || res;
      setApplications(Array.isArray(data?.applications) ? data.applications : []);
      if (data?.kpis) {
        setApplicationsKpis(data.kpis);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load refund applications");
      toast.error("Failed to load refund applications", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setApplicationsLoading(false);
    }
  }, [appStatusFilter, appSearch]);

  // Fetch Processed Ledger
  const fetchRefunds = useCallback(async () => {
    setLedgerLoading(true);
    setError(null);
    try {
      const res = await adminOperationsService.listRefunds();
      const list = res?.refunds || res?.data?.refunds || res?.data || res || [];
      setRefunds(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load processed refunds");
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "applications") {
      fetchApplications();
    } else {
      fetchRefunds();
    }
  }, [activeTab, fetchApplications, fetchRefunds]);

  // Load single application details
  const handleOpenDetail = async (appId) => {
    setIsDetailLoading(true);
    setSelectedApp(null);
    try {
      const res = await adminOperationsService.getRefundApplication(appId);
      const data = res?.data?.data || res?.data || res;
      setSelectedApp(data);
    } catch (err) {
      toast.error("Failed to load application details", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Mark Under Review
  const handleMarkReview = async () => {
    if (!selectedApp) return;
    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.reviewRefundApplication(
        selectedApp._id || selectedApp.id,
        { remarks: "Application under formal administrative verification" }
      );
      toast.success("Application marked under administrative review");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
    } catch (err) {
      toast.error("Failed to update application review state", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Approve Application
  const handleApprove = async () => {
    if (!selectedApp) return;
    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.approveRefundApplication(
        selectedApp._id || selectedApp.id,
        { remarks: "Refund calculation and inspection findings audited and approved" }
      );
      toast.success("Refund application approved successfully");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
    } catch (err) {
      toast.error("Failed to approve application", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Reject Application
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedApp || !rejectReason.trim()) {
      toast.error("Rejection reason is required (min 5 characters)");
      return;
    }

    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.rejectRefundApplication(
        selectedApp._id || selectedApp.id,
        { rejectionReason: rejectReason.trim() }
      );
      toast.success("Refund application rejected");
      setRejectModalOpen(false);
      setRejectReason("");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
    } catch (err) {
      toast.error("Failed to reject application", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Request Revision
  const handleConfirmRevision = async (e) => {
    e.preventDefault();
    if (!selectedApp || !revisionInstructions.trim()) {
      toast.error("Revision instructions are required (min 5 characters)");
      return;
    }

    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.requestRefundApplicationRevision(
        selectedApp._id || selectedApp.id,
        { revisionInstructions: revisionInstructions.trim() }
      );
      toast.success("Revision requested from merchant");
      setRevisionModalOpen(false);
      setRevisionInstructions("");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
    } catch (err) {
      toast.error("Failed to request revision", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Disburse Refund (Execute Gateway Reversal)
  const handleConfirmDisburse = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.disburseRefundApplication(
        selectedApp._id || selectedApp.id,
        { remarks: disburseRemarks.trim() || undefined }
      );
      toast.success("Payment gateway refund disbursed successfully");
      setDisburseModalOpen(false);
      setDisburseRemarks("");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
      // Also update ledger
      fetchRefunds();
    } catch (err) {
      toast.error("Gateway disbursement failed", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Retry Failed Disbursement
  const handleRetryDisburse = async () => {
    if (!selectedApp) return;
    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.retryRefundApplicationDisbursement(
        selectedApp._id || selectedApp.id
      );
      toast.success("Disbursement retried successfully");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
      fetchRefunds();
    } catch (err) {
      toast.error("Retry disbursement failed", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Reconcile with Gateway
  const handleReconcile = async () => {
    if (!selectedApp) return;
    try {
      setIsProcessingAction(true);
      const res = await adminOperationsService.reconcileRefundApplication(
        selectedApp._id || selectedApp.id
      );
      toast.success("Authoritative gateway reconciliation completed successfully");
      const updated = res?.data?.data || res?.data || res;
      setSelectedApp(updated);
      await fetchApplications();
      fetchRefunds();
    } catch (err) {
      toast.error("Reconciliation failed", {
        description: err?.response?.data?.message || err?.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Filtered Ledger List
  const filteredLedger = refunds.filter((r) => {
    if (!ledgerSearch.trim()) return true;
    const s = ledgerSearch.toLowerCase();
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
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Refund Disbursement &amp; Financial Governance
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-vendor refund application audit queue, administrative approval controls, and gateway payment reversals
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (activeTab === "applications" ? fetchApplications() : fetchRefunds())}
            disabled={applicationsLoading || ledgerLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${(applicationsLoading || ledgerLoading) ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("applications")}
          className={`pb-3.5 px-4 text-xs font-extrabold uppercase tracking-wider transition-colors relative cursor-pointer ${
            activeTab === "applications"
              ? "text-emerald-800 border-b-2 border-emerald-700 font-black"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="size-4" />
            <span>Disbursement Applications Queue</span>
            {applicationsKpis?.pendingReview > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {applicationsKpis.pendingReview}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveTab("ledger")}
          className={`pb-3.5 px-4 text-xs font-extrabold uppercase tracking-wider transition-colors relative cursor-pointer ${
            activeTab === "ledger"
              ? "text-emerald-800 border-b-2 border-emerald-700 font-black"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="size-4" />
            <span>Processed Gateway Ledger</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              {refunds.length}
            </span>
          </div>
        </button>
      </div>

      {/* TAB 1: DISBURSEMENT APPLICATIONS QUEUE */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          {/* Operational KPI Cards */}
          {applicationsKpis && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Total Applications
                </span>
                <strong className="text-xl font-black text-slate-900 block mt-1">
                  {applicationsKpis.totalApplications || 0}
                </strong>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Marketplace wide</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                  Pending Review
                </span>
                <strong className="text-xl font-black text-blue-700 block mt-1">
                  {applicationsKpis.pendingReview || 0}
                </strong>
                <span className="text-[10px] text-blue-500 mt-0.5 block">Needs admin action</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
                  Revision Req.
                </span>
                <strong className="text-xl font-black text-amber-700 block mt-1">
                  {applicationsKpis.revisionRequested || 0}
                </strong>
                <span className="text-[10px] text-amber-500 mt-0.5 block">With merchant</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-teal-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-teal-700 block tracking-wider">
                  Ready to Disburse
                </span>
                <strong className="text-xl font-black text-teal-700 block mt-1">
                  {applicationsKpis.approved || 0}
                </strong>
                <span className="text-[10px] text-teal-600 mt-0.5 block">Approved &amp; queued</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                  Disbursed
                </span>
                <strong className="text-xl font-black text-emerald-700 block mt-1">
                  {applicationsKpis.disbursed || 0}
                </strong>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">Executed refunds</span>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-emerald-950 p-4 rounded-2xl text-white shadow-xs">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block tracking-wider">
                  Total Liability
                </span>
                <strong className="text-lg font-black text-white block mt-1">
                  {formatCurrency(applicationsKpis.totalLiability || 0)}
                </strong>
                <span className="text-[10px] text-emerald-300/80 mt-0.5 block">Requested volume</span>
              </div>
            </div>
          )}

          {/* Filter Bar & Search */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: "all", label: "All" },
                { id: "submitted", label: "Submitted" },
                { id: "under_review", label: "Under Review" },
                { id: "revision_requested", label: "Revision Req." },
                { id: "approved", label: "Approved" },
                { id: "disbursed", label: "Disbursed" },
                { id: "disbursement_failed", label: "Failed" },
                { id: "rejected", label: "Rejected" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setAppStatusFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                    appStatusFilter === pill.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search application #, return #, vendor..."
                className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
              />
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-semibold">
                Showing {applications.length} applications
              </div>
            </div>

            {applicationsLoading ? (
              <div className="p-16 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="size-6 animate-spin mx-auto text-slate-400" />
                <p>Loading refund applications queue...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <ShieldCheck className="size-8 mx-auto text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No refund applications found</p>
                <p className="text-xs">Applications submitted by merchants following inspection will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Application #</th>
                      <th className="py-3.5 px-4">Return / Order #</th>
                      <th className="py-3.5 px-4">Merchant / Vendor</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4 text-right">Requested</th>
                      <th className="py-3.5 px-4 text-right">Approved</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4">Submitted At</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {applications.map((app) => (
                      <tr key={app._id || app.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <strong className="font-mono text-slate-900 block text-xs">
                            {app.applicationNumber}
                          </strong>
                          <span className="text-[10px] text-slate-400 uppercase">
                            {app.currency || "INR"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            #{app.returnId?.returnNumber || (app.returnId?.toString?.() || "").slice(-8).toUpperCase()}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Order: #{app.orderId?.orderNumber || (app.orderId?.toString?.() || "").slice(-8).toUpperCase()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {app.merchantId?.storeName || app.merchantId?.businessName || app.merchantId?.name || "Merchant"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {app.merchantId?.email || ""}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800">
                            {app.customerId?.firstName ? `${app.customerId.firstName} ${app.customerId.lastName || ""}` : (app.customerId?.name || "Customer")}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {app.customerId?.email || ""}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(app.requestedAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 text-xs">
                          {app.approvedAmount !== null && app.approvedAmount !== undefined ? formatCurrency(app.approvedAmount) : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              app.applicationStatus === "disbursed"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : app.applicationStatus === "approved"
                                ? "bg-teal-50 text-teal-800 border-teal-200"
                                : app.applicationStatus === "revision_requested" || app.applicationStatus === "pending_confirmation"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : app.applicationStatus === "rejected" || app.applicationStatus === "disbursement_failed"
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                          >
                            {app.applicationStatus?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-IN") : "N/A"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenDetail(app._id || app.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="size-3" />
                            <span>Audit &amp; Act</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROCESSED REFUNDS LEDGER */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search by Order #, Gateway ID, or customer..."
                className="w-full text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#004D38]"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              {filteredLedger.length} executed refunds
            </div>
          </div>

          {ledgerLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Loading refunds ledger...
            </div>
          ) : filteredLedger.length === 0 ? (
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
                  {filteredLedger.map((ref) => (
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
      )}

      {/* AUDIT & ACTION MODAL / DRAWER */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full my-8 p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    Audit Application #{selectedApp.applicationNumber}
                  </h3>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      selectedApp.applicationStatus === "disbursed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : selectedApp.applicationStatus === "approved"
                        ? "bg-teal-50 text-teal-800 border-teal-200"
                        : selectedApp.applicationStatus === "revision_requested" || selectedApp.applicationStatus === "pending_confirmation"
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : selectedApp.applicationStatus === "rejected" || selectedApp.applicationStatus === "disbursement_failed"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-blue-50 text-blue-800 border-blue-200"
                    }`}
                  >
                    {selectedApp.applicationStatus?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Return: <strong className="font-mono text-slate-800">#{selectedApp.returnId?.returnNumber || selectedApp.returnId?._id || selectedApp.returnId}</strong> • Order: <strong className="font-mono text-slate-800">#{selectedApp.orderId?.orderNumber || selectedApp.orderId?._id || selectedApp.orderId}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors self-start sm:self-auto cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Authoritative 5-Pillar Breakdown Hero */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-slate-700/60">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Authoritative Net Payable Calculation
                  </span>
                  <div className="text-3xl font-black text-white">
                    {formatCurrency(selectedApp.requestedAmount)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <span>Approved: </span>
                  <strong className="text-emerald-400">
                    {selectedApp.approvedAmount ? formatCurrency(selectedApp.approvedAmount) : "Pending"}
                  </strong>
                </div>
              </div>

              {selectedApp.authoritativeRefundBreakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Product</span>
                    <strong className="text-white block mt-0.5">
                      {formatCurrency(selectedApp.authoritativeRefundBreakdown.productRefund?.customerPaidAmount || 0)}
                    </strong>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block">2. Tax / GST</span>
                    <strong className="text-emerald-400 block mt-0.5">
                      +{formatCurrency(selectedApp.authoritativeRefundBreakdown.taxRefund?.refundableTax || 0)}
                    </strong>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-300 uppercase font-bold block">3. Shipping</span>
                    <strong className="text-slate-300 block mt-0.5">
                      +{formatCurrency(selectedApp.authoritativeRefundBreakdown.shippingRefund?.refundableShipping || 0)}
                    </strong>
                  </div>
                  <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-emerald-300 uppercase font-bold block">4. Deductions</span>
                    <strong className="text-emerald-300 block mt-0.5">
                      -{formatCurrency(selectedApp.authoritativeRefundBreakdown.deductions?.amount || 0)}
                    </strong>
                  </div>
                  <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-300 uppercase font-bold block">5. Final Net</span>
                    <strong className="text-emerald-400 block mt-0.5">
                      {formatCurrency(selectedApp.authoritativeRefundBreakdown.finalRefund?.netRefundableAmount || selectedApp.requestedAmount)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Merchant Inspection & Verification Panel */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Merchant Inspection Evidence &amp; Findings
                </span>
                <span className="font-semibold text-slate-700">
                  Merchant: {selectedApp.merchantId?.storeName || selectedApp.merchantId?.name || "Merchant"}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted Remarks</span>
                <p className="text-slate-900 italic">
                  &ldquo;{selectedApp.merchantRemarks}&rdquo;
                </p>
              </div>

              {selectedApp.deductionExplanation && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950">
                  <strong className="block text-[11px] text-amber-900">Deduction Explanation:</strong>
                  <span>{selectedApp.deductionExplanation}</span>
                </div>
              )}

              {/* Inspection Snapshot Details */}
              {selectedApp.inspectionSnapshot && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <div className="bg-white p-2.5 rounded-xl border text-[11px]">
                    <span className="text-slate-400 block text-[10px] uppercase">Outcome</span>
                    <strong className="capitalize text-slate-900">{selectedApp.inspectionSnapshot.outcome || "passed"}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border text-[11px]">
                    <span className="text-slate-400 block text-[10px] uppercase">Condition</span>
                    <strong className="capitalize text-slate-900">{selectedApp.inspectionSnapshot.receivedCondition || "unopened"}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border text-[11px]">
                    <span className="text-slate-400 block text-[10px] uppercase">Packaging</span>
                    <strong className="capitalize text-slate-900">{selectedApp.inspectionSnapshot.packagingCondition || "intact"}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border text-[11px]">
                    <span className="text-slate-400 block text-[10px] uppercase">Missing Accessories</span>
                    <strong className="capitalize text-slate-900">
                      {selectedApp.inspectionSnapshot.missingAccessories ? "Flagged" : "None"}
                    </strong>
                  </div>
                </div>
              )}

              {/* Supporting Document Links */}
              {Array.isArray(selectedApp.supportingDocuments) && selectedApp.supportingDocuments.length > 0 && (
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 font-semibold">Supporting Documents:</span>
                  {selectedApp.supportingDocuments.map((doc, dIdx) => (
                    <a
                      key={dIdx}
                      href={doc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-mono text-[11px] hover:bg-blue-100"
                    >
                      Document #{dIdx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Original Payment Context */}
            {selectedApp.paymentSnapshot && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Payment Gateway Capture Context
                </span>
                <div className="flex flex-wrap items-center gap-4 text-slate-800 pt-1">
                  <div>
                    Method: <strong className="capitalize">{selectedApp.paymentSnapshot.originalPaymentMethod || "Prepaid"}</strong>
                  </div>
                  <div>
                    Captured Amount: <strong>{formatCurrency(selectedApp.paymentSnapshot.capturedAmount || 0)}</strong>
                  </div>
                  <div>
                    Previous Order Refunds: <strong>{formatCurrency(selectedApp.paymentSnapshot.previouslyRefundedTotal || 0)}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Revision Instructions Banner */}
            {selectedApp.applicationStatus === "revision_requested" && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Revision Instructions Sent to Merchant</span>
                </div>
                <blockquote className="italic bg-white/70 p-3 rounded-xl border border-amber-200">
                  &ldquo;{selectedApp.revisionInstructions}&rdquo;
                </blockquote>
              </div>
            )}

            {/* Rejection Banner */}
            {selectedApp.applicationStatus === "rejected" && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                  <XCircle className="size-4 text-rose-600" />
                  <span>Application Rejection Reason</span>
                </div>
                <blockquote className="italic bg-white/70 p-3 rounded-xl border border-rose-200">
                  &ldquo;{selectedApp.rejectionReason}&rdquo;
                </blockquote>
              </div>
            )}

            {/* Disbursed Success Banner */}
            {selectedApp.applicationStatus === "disbursed" && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Gateway Disbursement Completed</span>
                </div>
                <p className="text-emerald-800">
                  Payment reversal executed successfully.
                  {selectedApp.disbursementReference && (
                    <span className="font-mono font-bold ml-1">
                      Gateway Reference: {selectedApp.disbursementReference}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* ACTION CONTROLS PANEL */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Administrative Governance Authority
                </span>
                <span className="text-xs text-slate-200">
                  Select an authorized operational action for this application
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {selectedApp.applicationStatus === "submitted" && canReviewApps && (
                  <button
                    type="button"
                    onClick={handleMarkReview}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="size-3.5" />
                    <span>Mark Under Review</span>
                  </button>
                )}

                {["submitted", "under_review"].includes(selectedApp.applicationStatus) && (
                  <>
                    {canApproveApps && (
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={isProcessingAction}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Approve Application</span>
                      </button>
                    )}

                    {canReviseApps && (
                      <button
                        type="button"
                        onClick={() => setRevisionModalOpen(true)}
                        disabled={isProcessingAction}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="size-3.5" />
                        <span>Request Revision</span>
                      </button>
                    )}

                    {canRejectApps && (
                      <button
                        type="button"
                        onClick={() => setRejectModalOpen(true)}
                        disabled={isProcessingAction}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="size-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </>
                )}

                {selectedApp.applicationStatus === "approved" && canDisburse && (
                  <button
                    type="button"
                    onClick={() => setDisburseModalOpen(true)}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="size-3.5" />
                    <span>Disburse Customer Refund</span>
                  </button>
                )}

                {(selectedApp.applicationStatus === "pending_confirmation" ||
                  Boolean(selectedApp.gatewayRefundId)) && (
                  <button
                    type="button"
                    onClick={handleReconcile}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Reconcile Gateway</span>
                  </button>
                )}

                {selectedApp.applicationStatus === "disbursement_failed" && canDisburse && (
                  <button
                    type="button"
                    onClick={handleRetryDisburse}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Retry Disbursement</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <XCircle className="size-4 text-rose-600" /> Reject Refund Application
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this refund application is rejected (minimum 5 characters)..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white resize-none focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || rejectReason.trim().length < 5}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVISION MODAL */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <RefreshCw className="size-4 text-amber-600" /> Request Application Revision
              </h3>
              <button
                type="button"
                onClick={() => setRevisionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRevision} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Revision Instructions for Merchant <span className="text-amber-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={revisionInstructions}
                  onChange={(e) => setRevisionInstructions(e.target.value)}
                  placeholder="Specify what clarification or documentation the merchant must provide (minimum 5 characters)..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white resize-none focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRevisionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction || revisionInstructions.trim().length < 5}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Send Revision Instructions</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSEMENT CONFIRMATION MODAL */}
      {disburseModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="size-4 text-emerald-600" /> Initiate Gateway Disbursement
              </h3>
              <button
                type="button"
                onClick={() => setDisburseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
              <span className="font-bold block">
                Disbursement Amount: {formatCurrency(selectedApp.approvedAmount || selectedApp.requestedAmount)}
              </span>
              <p className="text-[11px] text-emerald-800">
                This operation will call the payment gateway API to execute the actual money reversal to the customer.
              </p>
            </div>

            <form onSubmit={handleConfirmDisburse} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Disbursement Audit Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={disburseRemarks}
                  onChange={(e) => setDisburseRemarks(e.target.value)}
                  placeholder="Optional audit log note..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisburseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Authorize &amp; Execute Gateway Reversal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
