"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Package,
  ArrowRight,
  ExternalLink,
  Warehouse,
} from "lucide-react";
import { adminOperationsService, adminInventoryService } from "@/services/admin/admin.service.js";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Action Modals
  const [activeModal, setActiveModal] = useState(null); // 'approve' | 'reject' | 'receive' | 'refund'
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminOperationsService.listReturns(params);
      const items = res?.items || res || [];
      setReturns(Array.isArray(items) ? items : []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load return requests"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await adminInventoryService.listWarehouses();
      const items = res?.items || res || [];
      setWarehouses(Array.isArray(items) ? items : []);
      if (items.length > 0) {
        setSelectedWarehouseId(items[0]._id);
      }
    } catch {
      // Warehouses load fail silent
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchWarehouses();
  }, [statusFilter]);

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setSubmitting(true);
    setError(null);
    try {
      const returnId = selectedReturn._id;
      if (activeModal === "approve") {
        await adminOperationsService.approveReturn(returnId, actionNotes.trim());
        setSuccess("Return approved successfully");
      } else if (activeModal === "reject") {
        await adminOperationsService.rejectReturn(returnId, actionNotes.trim());
        setSuccess("Return rejected");
      } else if (activeModal === "receive") {
        await adminOperationsService.receiveReturn(
          returnId,
          selectedWarehouseId,
          actionNotes.trim()
        );
        setSuccess("Return received and inventory restocked");
      } else if (activeModal === "refund") {
        await adminOperationsService.refundReturn(returnId, actionNotes.trim());
        setSuccess("Return refund processed successfully");
      }

      setTimeout(() => setSuccess(null), 4000);
      setActiveModal(null);
      setSelectedReturn(null);
      setActionNotes("");
      fetchReturns();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to execute return action"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <RotateCcw className="size-6 text-[#004D38]" />
            <span>Customer Return Requests</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage product returns, inspections, warehouse restock allocations, and customer refunds
          </p>
        </div>

        <button
          onClick={fetchReturns}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {[
          "all",
          "requested",
          "under_review",
          "approved",
          "rejected",
          "item_received",
          "completed",
        ].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              statusFilter === st
                ? "bg-[#004D38] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {st.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Return List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-3xl">
            Loading return requests...
          </div>
        ) : returns.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-3xl space-y-2">
            <RotateCcw className="size-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No return requests found.</p>
          </div>
        ) : (
          returns.map((ret) => (
            <div
              key={ret._id}
              className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      Return #{ret._id.slice(-8).toUpperCase()}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {ret.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      • {new Date(ret.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Order Ref: #{ret.orderId?.orderNumber || ret.orderNumber || "Order"} • Type: {ret.type}
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2">
                  {ret.status === "requested" && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("approve");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold transition-colors"
                      >
                        Approve Return
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("reject");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {ret.status === "approved" && (
                    <button
                      onClick={() => {
                        setSelectedReturn(ret);
                        setActiveModal("receive");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-semibold transition-colors"
                    >
                      Receive &amp; Restock
                    </button>
                  )}

                  {ret.status === "item_received" && (
                    <button
                      onClick={() => {
                        setSelectedReturn(ret);
                        setActiveModal("refund");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-semibold transition-colors"
                    >
                      Issue Refund
                    </button>
                  )}
                </div>
              </div>

              {/* Items List */}
              {ret.items?.length > 0 && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-slate-400">
                    Return Items
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {ret.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">
                            {it.title || "Product item"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Reason: {it.reason || ret.customerNotes || "Not specified"}
                          </div>
                        </div>
                        <div className="font-bold text-slate-700">
                          Qty: {it.quantity || 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Action Dialog */}
      {activeModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {activeModal === "receive"
                ? "Receive & Restock Items"
                : `${activeModal} Return Request`}
            </h3>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              {activeModal === "receive" && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Select Restock Warehouse *
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  >
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Operational Notes / Reason
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Notes recorded for internal audit and customer notification..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedReturn(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#004D38] hover:bg-[#003829] rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
