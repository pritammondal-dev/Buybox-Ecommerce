"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Landmark,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Loader2,
  X,
  AlertCircle,
  Eye,
  Send,
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminWithdrawalsQueuePage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [approveModalItem, setApproveModalItem] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const [processModalItem, setProcessModalItem] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [markPaidModalItem, setMarkPaidModalItem] = useState(null);
  const [providerReference, setProviderReference] = useState("");
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const [markFailedModalItem, setMarkFailedModalItem] = useState(null);
  const [failureReason, setFailureReason] = useState("");
  const [isMarkingFailed, setIsMarkingFailed] = useState(false);

  const [detailModalItem, setDetailModalItem] = useState(null);

  const loadWithdrawals = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const res = await adminFinanceService.getWithdrawals({
          page,
          limit: 20,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
        });

        const list = res?.data || res?.items || [];
        setWithdrawals(Array.isArray(list) ? list : []);
        if (res?.meta) {
          setMeta(res.meta);
        }
      } catch (err) {
        toast.error("Failed to load withdrawal queue", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    loadWithdrawals(1);
  }, [loadWithdrawals]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadWithdrawals(1);
  };

  // Actions
  const handleApprove = async () => {
    if (!approveModalItem) return;
    setIsApproving(true);
    try {
      await adminFinanceService.approveWithdrawal(approveModalItem._id || approveModalItem.id);
      toast.success("Withdrawal approved successfully", {
        description: "Linked to VendorPayout and queued for bank transfer processing.",
      });
      setApproveModalItem(null);
      await loadWithdrawals(meta.page);
    } catch (err) {
      toast.error("Approval failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectModalItem) return;
    if (rejectionReason.trim().length < 10) {
      toast.error("Rejection justification must be at least 10 characters long");
      return;
    }
    setIsRejecting(true);
    try {
      await adminFinanceService.rejectWithdrawal(rejectModalItem._id || rejectModalItem.id, {
        rejectionReason: rejectionReason.trim(),
      });
      toast.success("Withdrawal rejected and funds released", {
        description: "Reserved funds atomically returned to vendor available balance.",
      });
      setRejectModalItem(null);
      setRejectionReason("");
      await loadWithdrawals(meta.page);
    } catch (err) {
      toast.error("Rejection failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleProcessTransfer = async () => {
    if (!processModalItem) return;
    setIsProcessing(true);
    try {
      await adminFinanceService.processWithdrawal(processModalItem._id || processModalItem.id);
      toast.success("Transfer initiated via banking sandbox adapter", {
        description: "Status moved to PROCESSING.",
      });
      setProcessModalItem(null);
      await loadWithdrawals(meta.page);
    } catch (err) {
      toast.error("Processing failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!markPaidModalItem) return;
    setIsMarkingPaid(true);
    try {
      await adminFinanceService.markWithdrawalPaid(markPaidModalItem._id || markPaidModalItem.id, {
        providerReference: providerReference.trim() || undefined,
      });
      toast.success("Withdrawal marked as COMPLETED", {
        description: "Double-entry disbursement journal posted and clearing accounts updated.",
      });
      setMarkPaidModalItem(null);
      setProviderReference("");
      await loadWithdrawals(meta.page);
    } catch (err) {
      toast.error("Action failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleMarkFailed = async (e) => {
    e.preventDefault();
    if (!markFailedModalItem) return;
    if (!failureReason.trim()) {
      toast.error("Please provide a failure reason");
      return;
    }
    setIsMarkingFailed(true);
    try {
      await adminFinanceService.markWithdrawalFailed(markFailedModalItem._id || markFailedModalItem.id, {
        failureReason: failureReason.trim(),
      });
      toast.success("Withdrawal marked as FAILED", {
        description: "Reserved funds released back to vendor available balance.",
      });
      setMarkFailedModalItem(null);
      setFailureReason("");
      await loadWithdrawals(meta.page);
    } catch (err) {
      toast.error("Action failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsMarkingFailed(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return "₹0.00";
    const num = Number(val?.toString?.() || val);
    return isNaN(num) ? "₹0.00" : `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Disbursed (Paid)
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/administrator/dashboard" className="hover:text-slate-800">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Finance & Withdrawals</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Landmark className="w-7 h-7 text-emerald-600" />
            Vendor Withdrawal & Payout Review Queue
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Review vendor withdrawal requests, verify approved bank destinations, and trigger banking disbursements.
          </p>
        </div>

        <button
          onClick={() => loadWithdrawals(meta.page)}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm shadow-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Queue
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: "all", label: "All Requests" },
            { id: "pending_review", label: "Pending Review" },
            { id: "approved", label: "Approved" },
            { id: "processing", label: "Processing" },
            { id: "completed", label: "Completed" },
            { id: "rejected", label: "Rejected" },
            { id: "failed", label: "Failed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-72">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by WTH # or vendor..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {withdrawals.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Landmark className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">No withdrawal requests found</p>
              <p className="text-xs text-slate-500">No records match the current filter criteria.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Withdrawal #</th>
                  <th className="py-3.5 px-6">Vendor</th>
                  <th className="py-3.5 px-6">Requested Amount</th>
                  <th className="py-3.5 px-6">Destination Bank (Masked)</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {withdrawals.map((w) => (
                  <tr key={w._id || w.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-6 font-mono text-xs font-semibold text-emerald-700">
                      {w.withdrawalNumber}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">
                          {w.vendorId?.businessName || w.vendorId?.name || "Vendor"}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ID: {String(w.vendorId?._id || w.vendorId || "").slice(-8)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900 font-mono">
                      {formatCurrency(w.amount)}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-800">
                          {w.bankSnapshot?.bankName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {w.bankSnapshot?.accountNumberMasked} • {w.bankSnapshot?.ifscCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">{getStatusBadge(w.status)}</td>
                    <td className="py-3.5 px-6 text-xs text-slate-500">
                      {new Date(w.requestedAt || w.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailModalItem(w)}
                          title="View Details"
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {w.status === "pending_review" && (
                          <>
                            <button
                              onClick={() => setApproveModalItem(w)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectModalItem(w)}
                              className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {w.status === "approved" && (
                          <button
                            onClick={() => setProcessModalItem(w)}
                            className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                          >
                            Process Transfer
                          </button>
                        )}

                        {w.status === "processing" && (
                          <>
                            <button
                              onClick={() => setMarkPaidModalItem(w)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => setMarkFailedModalItem(w)}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg transition"
                            >
                              Mark Failed
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1} to{" "}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} requests
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadWithdrawals(meta.page - 1)}
                disabled={meta.page <= 1}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => loadWithdrawals(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Approve Withdrawal Request</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to approve withdrawal{" "}
              <span className="font-mono font-bold text-slate-800">{approveModalItem.withdrawalNumber}</span> for{" "}
              <span className="font-bold text-slate-900">{formatCurrency(approveModalItem.amount)}</span>?
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div><strong>Destination:</strong> {approveModalItem.bankSnapshot?.bankName} ({approveModalItem.bankSnapshot?.accountNumberMasked})</div>
              <div><strong>Account Holder:</strong> {approveModalItem.bankSnapshot?.accountHolderName}</div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                disabled={isApproving}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                {isApproving ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reject Withdrawal & Release Escrow</h3>
            <p className="text-xs text-slate-600">
              Rejecting will automatically release the reserved funds back to the vendor&apos;s available balance via a balanced reversal journal.
            </p>
            <form onSubmit={handleReject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Rejection Justification (min 10 chars)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is rejected (e.g. Account name mismatch with KYC documents)..."
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalItem(null);
                    setRejectionReason("");
                  }}
                  disabled={isRejecting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting || rejectionReason.trim().length < 10}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {isRejecting ? "Rejecting..." : "Reject & Release Funds"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Sandbox Modal */}
      {processModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Initiate Banking Transfer</h3>
            <p className="text-xs text-slate-600">
              Dispatch withdrawal transfer of <span className="font-bold text-slate-900">{formatCurrency(processModalItem.amount)}</span> to{" "}
              {processModalItem.bankSnapshot?.bankName} ({processModalItem.bankSnapshot?.accountNumberMasked}) via the banking adapter.
            </p>
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
              Transfer is executed via the marked banking sandbox adapter.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProcessModalItem(null)}
                disabled={isProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessTransfer}
                disabled={isProcessing}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                {isProcessing ? "Processing..." : "Confirm & Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {markPaidModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Payout Settlement (Mark Paid)</h3>
            <p className="text-xs text-slate-600">
              Confirm that the bank transfer of <span className="font-bold text-slate-900">{formatCurrency(markPaidModalItem.amount)}</span> has settled.
            </p>
            <form onSubmit={handleMarkPaid} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank UTR / Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  placeholder="e.g. UTR-20261030-9872134"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMarkPaidModalItem(null)}
                  disabled={isMarkingPaid}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMarkingPaid}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {isMarkingPaid ? "Submitting..." : "Confirm Payout Settled"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Failed Modal */}
      {markFailedModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Banking Failure</h3>
            <p className="text-xs text-slate-600">
              Mark transfer as failed and return reserved funds back to vendor available balance.
            </p>
            <form onSubmit={handleMarkFailed} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Failure Reason from Bank
                </label>
                <input
                  type="text"
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  placeholder="e.g. Account number invalid / Beneficiary branch offline"
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs text-slate-800"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMarkFailedModalItem(null)}
                  disabled={isMarkingFailed}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMarkingFailed}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  {isMarkingFailed ? "Submitting..." : "Confirm Bank Failure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <span className="text-[11px] font-mono text-emerald-700 uppercase">Audit Record</span>
                <h3 className="text-base font-bold text-slate-900">{detailModalItem.withdrawalNumber}</h3>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span>{getStatusBadge(detailModalItem.status)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900">{formatCurrency(detailModalItem.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Bank Destination</span>
                <span className="font-semibold text-slate-800">
                  {detailModalItem.bankSnapshot?.bankName} ({detailModalItem.bankSnapshot?.accountNumberMasked})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Account Holder</span>
                <span className="text-slate-800">{detailModalItem.bankSnapshot?.accountHolderName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">IFSC Code</span>
                <span className="font-mono text-slate-700">{detailModalItem.bankSnapshot?.ifscCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Reservation Journal ID</span>
                <span className="font-mono text-emerald-700">{detailModalItem.reservationJournalId}</span>
              </div>
              {detailModalItem.disbursementJournalId && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Disbursement Journal ID</span>
                  <span className="font-mono text-emerald-700">{detailModalItem.disbursementJournalId}</span>
                </div>
              )}
              {detailModalItem.releaseJournalId && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Release Journal ID</span>
                  <span className="font-mono text-amber-700">{detailModalItem.releaseJournalId}</span>
                </div>
              )}
              {detailModalItem.payoutId && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Linked VendorPayout ID</span>
                  <span className="font-mono text-indigo-700">
                    {detailModalItem.payoutId?._id || detailModalItem.payoutId}
                  </span>
                </div>
              )}
              {detailModalItem.rejectionReason && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <strong>Rejection Justification:</strong>
                  <p>{detailModalItem.rejectionReason}</p>
                </div>
              )}
              {detailModalItem.failureReason && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 space-y-1">
                  <strong>Failure Reason:</strong>
                  <p>{detailModalItem.failureReason}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailModalItem(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

