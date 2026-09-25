"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Package,
  Boxes,
  CreditCard,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorReturnDetailPage() {
  const params = useParams();
  const returnId = params?.id;

  const [returnReq, setReturnReq] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [restockNotes, setRestockNotes] = useState("");

  const loadReturn = React.useCallback(async () => {
    if (!returnId) return;
    try {
      const res = await vendorService.getMyReturnById(returnId);
      const data = res?.data?.data || res?.data?.returnRequest || res?.data;
      setReturnReq(data);
    } catch (err) {
      toast.error("Failed to load return request details", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!returnId) return;
      try {
        const [returnRes, whRes] = await Promise.allSettled([
          vendorService.getMyReturnById(returnId),
          vendorService.getMyWarehouses(),
        ]);
        if (!isMounted) return;
        if (returnRes.status === "fulfilled") {
          const data = returnRes.value?.data?.data || returnRes.value?.data?.returnRequest || returnRes.value?.data;
          setReturnReq(data);
        }
        if (whRes.status === "fulfilled") {
          const list = whRes.value?.data?.data || whRes.value?.data?.warehouses || whRes.value?.data || [];
          const whArray = Array.isArray(list) ? list : [];
          setWarehouses(whArray);
          if (whArray.length > 0) {
            setSelectedWarehouseId(whArray[0]._id || whArray[0].id);
          }
        }
      } catch (err) {
        toast.error("Failed to load return request details", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [returnId]);

  const handleApprove = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.approveReturn(returnReq.secureId || returnReq._id);
      toast.success("Return request approved successfully");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to approve return", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      setIsProcessingAction(true);
      await vendorService.rejectReturn(returnReq.secureId || returnReq._id, rejectReason.trim());
      toast.success("Return request rejected");
      setRejectModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to reject return", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    try {
      setIsProcessingAction(true);
      await vendorService.receiveReturnAndRestock(returnReq.secureId || returnReq._id, {
        warehouseId: selectedWarehouseId || undefined,
        notes: restockNotes.trim() || undefined,
      });
      toast.success("Return received and items restocked to warehouse");
      setRestockModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to receive & restock items", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRefund = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.refundReturn(returnReq.secureId || returnReq._id);
      toast.success("Customer refund processed successfully");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to process refund", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!returnReq) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Return Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This return request was not found or does not belong to your vendor account.
        </p>
        <Link
          href="/vendor/returns"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Returns</span>
        </Link>
      </div>
    );
  }

  const items = returnReq.items || [];
  const status = returnReq.status;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <div>
        <Link
          href="/vendor/returns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Returns</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Return #{returnReq.returnNumber || returnReq.secureId}
              </h2>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                status === "refunded" || status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : status === "rejected" || status === "cancelled"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Order: <span className="font-semibold text-slate-800">{returnReq.orderNumber}</span> • Type: {returnReq.type || "return"} • Filed: {returnReq.createdAt ? new Date(returnReq.createdAt).toLocaleDateString("en-IN") : "N/A"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {status === "requested" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Approve Return</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <XCircle className="size-3.5" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {["approved", "pickup_scheduled"].includes(status) && (
              <button
                type="button"
                onClick={() => setRestockModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Boxes className="size-3.5" />
                <span>Receive & Restock</span>
              </button>
            )}

            {["received", "approved"].includes(status) && status !== "refunded" && (
              <button
                type="button"
                onClick={handleRefund}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <CreditCard className="size-3.5" />
                <span>Issue Refund</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customer Reason Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Customer Reason & Notes
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
          {returnReq.customerNotes || returnReq.reason || "Standard customer return request."}
        </p>

        {returnReq.resolutionNotes && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-900 mb-1">Merchant Resolution Notes:</h4>
            <p className="text-xs text-slate-600 bg-amber-50/60 p-3 rounded-xl border border-amber-200/60">
              {returnReq.resolutionNotes}
            </p>
          </div>
        )}
      </div>

      {/* Returned Items */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Returned Items</h3>
          <p className="text-xs text-slate-500">Products subjected to inspection and restocking</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Item</th>
                <th className="px-6 py-3.5 text-center">Quantity</th>
                <th className="px-6 py-3.5">Condition</th>
                <th className="px-6 py-3.5 text-right">Refund Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">
                      {item.name || item.productName || item.sku || "Product Item"}
                    </div>
                    {item.sku && <div className="text-[11px] text-slate-400 font-mono">SKU: {item.sku}</div>}
                  </td>
                  <td className="px-6 py-4 text-center font-semibold text-slate-800">
                    {item.quantity || 1}
                  </td>
                  <td className="px-6 py-4 text-slate-600 capitalize">
                    {item.condition || "unopened"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    ₹{Number(item.itemPrice || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Reject Return Request</h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide detailed explanation to customer (e.g. item opened, missing seal, return window expired)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Receive & Restock Items</h3>
              <button
                type="button"
                onClick={() => setRestockModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4">
              {warehouses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Warehouse
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh._id || wh.id} value={wh._id || wh.id}>
                        {wh.name} ({wh.code || wh.city || "Primary"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Inspection Notes
                </label>
                <textarea
                  rows={2}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Goods condition, serial number verification, etc..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Restock Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
