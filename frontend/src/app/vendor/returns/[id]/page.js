"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Truck,
  RefreshCw,
  Camera,
  Eye,
  Check,
  Building,
  Send,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { formatCurrency } from "@/utils/formatCurrency";

export default function VendorReturnDetailPage() {
  const params = useParams();
  const returnId = params?.id;

  const [returnReq, setReturnReq] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    carrier: "DELHIVERY",
    scheduledDate: "",
    timeSlot: "10:00 AM - 01:00 PM",
    notes: "",
  });

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectForm, setInspectForm] = useState({
    outcome: "passed",
    condition: "unopened",
    restock: true,
    warehouseId: "",
    notes: "",
  });

  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeForm, setExchangeForm] = useState({
    carrier: "DELHIVERY",
    trackingNumber: "",
    expectedDeliveryDays: 3,
  });

  // Refund Governance Application Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    merchantRemarks: "",
    deductionExplanation: "",
    supportingDocuments: "",
    certifiedAccurate: false,
  });

  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitForm, setResubmitForm] = useState({
    merchantRemarks: "",
    deductionExplanation: "",
    supportingDocuments: "",
  });

  const [previewImage, setPreviewImage] = useState(null);
  const [warehouses, setWarehouses] = useState([]);

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
            setInspectForm((prev) => ({ ...prev, warehouseId: whArray[0]._id || whArray[0].id }));
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

  const handleSchedulePickup = async (e) => {
    e.preventDefault();
    try {
      setIsProcessingAction(true);
      await vendorService.scheduleReturnPickup(returnReq.secureId || returnReq._id, {
        carrier: pickupForm.carrier,
        scheduledDate: pickupForm.scheduledDate || undefined,
        timeSlot: pickupForm.timeSlot,
        notes: pickupForm.notes.trim() || undefined,
      });
      toast.success("Reverse courier pickup scheduled successfully");
      setPickupModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to schedule pickup", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmPickup = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.confirmReturnPickup(returnReq.secureId || returnReq._id, {
        notes: "Doorstep reverse pickup handed over to courier partner",
      });
      toast.success("Reverse pickup marked as collected");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to confirm pickup handover", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    try {
      setIsProcessingAction(true);
      await vendorService.inspectReturn(returnReq.secureId || returnReq._id, {
        outcome: inspectForm.outcome,
        condition: inspectForm.condition,
        restock: inspectForm.restock,
        warehouseId: inspectForm.restock ? inspectForm.warehouseId || undefined : undefined,
        notes: inspectForm.notes.trim() || undefined,
      });
      toast.success("Inspection completed and inventory updated");
      setInspectModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to complete inspection", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleFulfillExchange = async (e) => {
    e.preventDefault();
    try {
      setIsProcessingAction(true);
      await vendorService.fulfillExchange(returnReq.secureId || returnReq._id, {
        carrier: exchangeForm.carrier,
        trackingNumber: exchangeForm.trackingNumber.trim() || undefined,
        expectedDeliveryDays: Number(exchangeForm.expectedDeliveryDays) || 3,
      });
      toast.success("Replacement fulfillment confirmed and dispatched");
      setExchangeModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to fulfill exchange", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSubmitRefundApplication = async (e) => {
    e.preventDefault();
    if (!applyForm.merchantRemarks.trim()) {
      toast.error("Merchant inspection remarks are required");
      return;
    }
    if (!applyForm.certifiedAccurate) {
      toast.error("Please certify that the physical goods were inspected and findings are accurate");
      return;
    }

    try {
      setIsProcessingAction(true);
      const docs = applyForm.supportingDocuments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await vendorService.submitRefundApplication(returnReq.secureId || returnReq._id, {
        merchantRemarks: applyForm.merchantRemarks.trim(),
        deductionExplanation: applyForm.deductionExplanation.trim() || undefined,
        supportingDocuments: docs.length > 0 ? docs : undefined,
      });

      toast.success("Refund application submitted for administrator review");
      setApplyModalOpen(false);
      setApplyForm({
        merchantRemarks: "",
        deductionExplanation: "",
        supportingDocuments: "",
        certifiedAccurate: false,
      });
      await loadReturn();
    } catch (err) {
      toast.error("Failed to submit refund application", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleResubmitRefundApplication = async (e) => {
    e.preventDefault();
    if (!resubmitForm.merchantRemarks.trim()) {
      toast.error("Updated merchant remarks are required");
      return;
    }

    try {
      setIsProcessingAction(true);
      const docs = resubmitForm.supportingDocuments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await vendorService.resubmitRefundApplication(returnReq.secureId || returnReq._id, {
        merchantRemarks: resubmitForm.merchantRemarks.trim(),
        deductionExplanation: resubmitForm.deductionExplanation.trim() || undefined,
        supportingDocuments: docs.length > 0 ? docs : undefined,
      });

      toast.success("Revised refund application resubmitted for administrator review");
      setResubmitModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to resubmit refund application", {
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
  const isExchange = returnReq.type === "exchange";
  const evidencePhotos = returnReq.images || [];
  const refundApp = returnReq.refundApplication || null;
  const totalRefundAmount = Number(
    returnReq.refundBreakdown?.finalRefund?.netRefundableAmount ||
    returnReq.financialSummary?.totalRefund ||
    returnReq.refundAmount ||
    0
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-24">
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
              <span
                className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  status === "refunded" || status === "exchange_completed" || status === "completed"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : status === "rejected" || status === "cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {status?.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Order: <span className="font-semibold text-slate-800">#{returnReq.orderNumber}</span> • Type:{" "}
              <strong className="uppercase text-[#004D38]">{returnReq.type || "return"}</strong> • Filed:{" "}
              {returnReq.createdAt ? new Date(returnReq.createdAt).toLocaleDateString("en-IN") : "N/A"}
            </p>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {status === "requested" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Approve Request</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="size-3.5" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {status === "approved" && (
              <button
                type="button"
                onClick={() => setPickupModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Truck className="size-3.5" />
                <span>Schedule Reverse Pickup</span>
              </button>
            )}

            {status === "pickup_scheduled" && (
              <button
                type="button"
                onClick={handleConfirmPickup}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Package className="size-3.5" />
                <span>Confirm Handover (Picked Up)</span>
              </button>
            )}

            {["picked_up", "item_received"].includes(status) && (
              <button
                type="button"
                onClick={() => setInspectModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Boxes className="size-3.5" />
                <span>Technical Quality Inspection</span>
              </button>
            )}

            {status === "inspected" && isExchange && (
              <button
                type="button"
                onClick={() => setExchangeModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Fulfill Exchange &amp; Dispatch</span>
              </button>
            )}

            {["inspected", "refund_pending"].includes(status) && !isExchange && (
              <>
                {!refundApp && (
                  <button
                    type="button"
                    onClick={() => setApplyModalOpen(true)}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>Apply for Refund Disbursement</span>
                  </button>
                )}
                {refundApp?.applicationStatus === "revision_requested" && (
                  <button
                    type="button"
                    onClick={() => {
                      setResubmitForm({
                        merchantRemarks: refundApp.merchantRemarks || "",
                        deductionExplanation: refundApp.deductionExplanation || "",
                        supportingDocuments: (refundApp.supportingDocuments || []).join(", "),
                      });
                      setResubmitModalOpen(true);
                    }}
                    disabled={isProcessingAction}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Revise &amp; Resubmit Application</span>
                  </button>
                )}
                {["submitted", "under_review"].includes(refundApp?.applicationStatus) && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                    <Clock className="size-3.5 animate-pulse" />
                    <span>Refund Application Under Review</span>
                  </div>
                )}
                {refundApp?.applicationStatus === "approved" && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="size-3.5" />
                    <span>Refund Approved (Disbursement Queued)</span>
                  </div>
                )}
                {refundApp?.applicationStatus === "pending_confirmation" && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    <Clock className="size-3.5 animate-pulse" />
                    <span>Gateway Settlement In Progress</span>
                  </div>
                )}
                {refundApp?.applicationStatus === "disbursed" && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CreditCard className="size-3.5" />
                    <span>Refund Disbursed to Customer</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Reason & Reverse Pickup Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Customer Reason Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Customer Stated Reason &amp; Notes
          </h3>
          <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            {returnReq.customerNotes || returnReq.reason || "Standard customer return request."}
          </p>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
            <span>Eligibility Deadline:</span>
            <span className="font-semibold text-slate-800">
              {returnReq.eligibilityDeadline
                ? new Date(returnReq.eligibilityDeadline).toLocaleDateString("en-IN")
                : "7-day window"}
            </span>
          </div>
        </div>

        {/* Reverse Logistics / Pickup Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Truck className="size-4 text-blue-600" />
            Reverse Logistics &amp; Doorstep Address
          </h3>
          {returnReq.reversePickupSchedule ? (
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Carrier:</span>
                <strong className="text-slate-900">{returnReq.reversePickupSchedule.carrier}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Pickup Token:</span>
                <strong className="font-mono text-blue-800">{returnReq.reversePickupSchedule.pickupToken}</strong>
              </div>
              {returnReq.reversePickupSchedule.trackingNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Reverse AWB:</span>
                  <strong className="font-mono">{returnReq.reversePickupSchedule.trackingNumber}</strong>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic bg-slate-50 p-4 rounded-2xl">
              Reverse pickup has not yet been scheduled. Click &quot;Schedule Reverse Pickup&quot; after approval.
            </p>
          )}

          {returnReq.pickupAddress && (
            <div className="text-[11px] text-slate-600 pt-1">
              <strong>Pickup Location: </strong>
              {returnReq.pickupAddress.street || returnReq.pickupAddress.addressLine1},{" "}
              {returnReq.pickupAddress.city}, {returnReq.pickupAddress.state} - {returnReq.pickupAddress.postalCode}
              {returnReq.pickupAddress.phone && ` (Ph: ${returnReq.pickupAddress.phone})`}
            </div>
          )}
        </div>
      </div>

      {/* Customer Defect Photographs Gallery */}
      {evidencePhotos.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Camera className="size-4 text-slate-400" /> Customer Defect Photographs ({evidencePhotos.length})
            </h3>
            <span className="text-[11px] text-slate-400">Click any image to enlarge and inspect</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {evidencePhotos.map((photo, pIdx) => {
              const url = typeof photo === "string" ? photo : photo.url;
              return (
                <div
                  key={pIdx}
                  onClick={() => setPreviewImage(url)}
                  className="relative size-24 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity group"
                >
                  <Image src={url} alt={`Evidence ${pIdx + 1}`} fill className="object-cover" sizes="96px" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="size-5 text-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Returned Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Returned Items &amp; Valuation</h3>
            <p className="text-xs text-slate-500">Products subjected to inspection and restocking</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Total Refund</span>
            <span className="text-sm font-black text-slate-900">
              {formatCurrency(Number(returnReq.refundAmount?.toString?.() || 0))}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Item</th>
                <th className="px-6 py-3.5 text-center">Quantity</th>
                <th className="px-6 py-3.5">Condition</th>
                <th className="px-6 py-3.5 text-right">Value</th>
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
                    {formatCurrency(Number(item.itemPrice?.toString?.() || 0) * (item.quantity || 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Bank / COD Details */}
      {returnReq.bankDetails && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CreditCard className="size-4 text-emerald-600" /> Customer Bank Details for Refund Disbursement
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-2xl">
            {returnReq.bankDetails.accountHolderName && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Holder</span>
                <strong className="text-slate-900">{returnReq.bankDetails.accountHolderName}</strong>
              </div>
            )}
            {returnReq.bankDetails.accountNumberMasked && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Account Number</span>
                <strong className="font-mono text-slate-900">{returnReq.bankDetails.accountNumberMasked}</strong>
              </div>
            )}
            {returnReq.bankDetails.ifscCode && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">IFSC Code</span>
                <strong className="font-mono text-slate-900">{returnReq.bankDetails.ifscCode}</strong>
              </div>
            )}
            {returnReq.bankDetails.upiId && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">UPI ID</span>
                <strong className="font-mono text-slate-900">{returnReq.bankDetails.upiId}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REFUND DISBURSEMENT APPLICATION & ADMINISTRATIVE GOVERNANCE CARD */}
      {!isExchange && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Refund Disbursement Authority &amp; Application
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial disbursement to customer payment methods is audited and released exclusively by marketplace administrators.
              </p>
            </div>

            {refundApp ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border self-start sm:self-auto ${
                  refundApp.applicationStatus === "disbursed"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : refundApp.applicationStatus === "approved"
                    ? "bg-teal-50 text-teal-800 border-teal-200"
                    : refundApp.applicationStatus === "revision_requested" || refundApp.applicationStatus === "pending_confirmation"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : refundApp.applicationStatus === "rejected"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : refundApp.applicationStatus === "disbursement_failed"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {refundApp.applicationStatus === "disbursed" && <CheckCircle2 className="size-3" />}
                {refundApp.applicationStatus === "revision_requested" && <AlertTriangle className="size-3" />}
                {refundApp.applicationStatus === "rejected" && <XCircle className="size-3" />}
                {["submitted", "under_review"].includes(refundApp.applicationStatus) && <Clock className="size-3" />}
                <span>Status: {refundApp.applicationStatus.replace(/_/g, " ")}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 self-start sm:self-auto">
                Application Not Submitted
              </span>
            )}
          </div>

          {!refundApp ? (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-800">
                  {["inspected", "refund_pending"].includes(status)
                    ? "Quality Inspection Recorded — Ready to Apply"
                    : "Awaiting Warehouse Quality Inspection"}
                </h4>
                <p className="text-xs text-slate-500 max-w-xl">
                  {["inspected", "refund_pending"].includes(status)
                    ? `Physical inspection has been verified. You may now apply for administrative refund disbursement of ${formatCurrency(totalRefundAmount)} based on authoritative ledger calculation.`
                    : "Complete customer return receipt and technical inspection before applying for customer refund disbursement."}
                </p>
              </div>

              {["inspected", "refund_pending"].includes(status) && (
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(true)}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  <span>Submit Refund Application</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Application ID
                  </span>
                  <strong className="font-mono text-slate-900 block mt-0.5 text-xs">
                    {refundApp.applicationNumber}
                  </strong>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Submitted: {new Date(refundApp.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Requested Refund
                  </span>
                  <strong className="text-sm font-black text-slate-900 block mt-0.5">
                    {formatCurrency(refundApp.requestedAmount)}
                  </strong>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Authoritative Net Payable
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Approved Amount
                  </span>
                  <strong className={`text-sm font-black block mt-0.5 ${refundApp.approvedAmount ? "text-emerald-700" : "text-slate-400"}`}>
                    {refundApp.approvedAmount ? formatCurrency(refundApp.approvedAmount) : "Pending Review"}
                  </strong>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {refundApp.approvedAt ? `Approved ${new Date(refundApp.approvedAt).toLocaleDateString("en-IN")}` : "Awaiting admin sign-off"}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Disbursed Amount
                  </span>
                  <strong className={`text-sm font-black block mt-0.5 ${refundApp.disbursedAmount ? "text-emerald-700" : "text-slate-400"}`}>
                    {refundApp.disbursedAmount ? formatCurrency(refundApp.disbursedAmount) : "Pending Gateway"}
                  </strong>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {refundApp.disbursedAt ? `Disbursed ${new Date(refundApp.disbursedAt).toLocaleDateString("en-IN")}` : "Customer payment release"}
                  </span>
                </div>
              </div>

              {/* Revision Instructions Banner */}
              {refundApp.applicationStatus === "revision_requested" && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <span>Administrator Revision Request</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResubmitForm({
                          merchantRemarks: refundApp.merchantRemarks || "",
                          deductionExplanation: refundApp.deductionExplanation || "",
                          supportingDocuments: (refundApp.supportingDocuments || []).join(", "),
                        });
                        setResubmitModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <RefreshCw className="size-3.5" />
                      <span>Revise &amp; Resubmit Application</span>
                    </button>
                  </div>
                  <blockquote className="text-xs text-amber-950 font-medium italic bg-white/70 p-3 rounded-xl border border-amber-200/60">
                    &ldquo;{refundApp.revisionInstructions}&rdquo;
                  </blockquote>
                </div>
              )}

              {/* Rejection Banner */}
              {refundApp.applicationStatus === "rejected" && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <XCircle className="size-4 text-rose-600" />
                    <span>Refund Application Rejected</span>
                  </div>
                  <blockquote className="text-rose-950 font-medium italic bg-white/70 p-3 rounded-xl border border-rose-200/60">
                    &ldquo;{refundApp.rejectionReason}&rdquo;
                  </blockquote>
                </div>
              )}

              {/* Gateway Settlement Pending Banner */}
              {refundApp.applicationStatus === "pending_confirmation" && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <Clock className="size-4 text-amber-600 animate-pulse" />
                    <span>Payment Gateway Settlement In Progress</span>
                  </div>
                  <p className="text-amber-800">
                    Customer refund disbursement has been initiated by platform administration and is currently pending settlement confirmation from the banking network.
                    {refundApp.gatewayRefundId && (
                      <span className="font-mono font-bold ml-1">
                        Gateway ID: {refundApp.gatewayRefundId}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Disbursement Success Banner */}
              {refundApp.applicationStatus === "disbursed" && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Customer Refund Disbursed</span>
                  </div>
                  <p className="text-emerald-800">
                    The refund was successfully executed via payment gateway.
                    {refundApp.disbursementReference && (
                      <span className="font-mono font-bold ml-1">
                        Ref: {refundApp.disbursementReference}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Merchant Submitted Remarks & Certified Deductions */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Merchant Inspection Notes Submitted with Application
                </span>
                <p className="text-slate-800 italic">
                  &ldquo;{refundApp.merchantRemarks || "Physical inspection verified as complete."}&rdquo;
                </p>
                {refundApp.deductionExplanation && (
                  <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                    <strong className="text-slate-800">Deduction Justification:</strong> {refundApp.deductionExplanation}
                  </div>
                )}
                {Array.isArray(refundApp.supportingDocuments) && refundApp.supportingDocuments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="text-slate-500 font-semibold">Supporting Docs:</span>
                    {refundApp.supportingDocuments.map((doc, dIdx) => (
                      <a
                        key={dIdx}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline font-mono text-[10px] hover:text-blue-800"
                      >
                        Doc #{dIdx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Application Timeline Audit */}
              {Array.isArray(refundApp.timeline) && refundApp.timeline.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-2">
                    Governance Audit Trail
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {refundApp.timeline.map((evt, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] space-y-0.5"
                      >
                        <div className="font-bold text-slate-800 capitalize flex items-center gap-1">
                          <Check className="size-3 text-emerald-600" />
                          <span>{evt.action ? evt.action.replace(/_/g, " ") : "Action"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {evt.performedAt ? new Date(evt.performedAt).toLocaleString("en-IN") : "Recorded"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Reject Return Request</h3>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Reverse Pickup Modal */}
      {pickupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Truck className="size-4 text-blue-600" /> Schedule Reverse Pickup
              </h3>
              <button
                type="button"
                onClick={() => setPickupModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSchedulePickup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Carrier Partner</label>
                <select
                  value={pickupForm.carrier}
                  onChange={(e) => setPickupForm({ ...pickupForm, carrier: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                >
                  <option value="DELHIVERY">Delhivery Logistics</option>
                  <option value="BLUEDART">Blue Dart Express</option>
                  <option value="EKART">Ekart Logistics</option>
                  <option value="SHADOWFAX">Shadowfax Reverse</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={pickupForm.scheduledDate}
                  onChange={(e) => setPickupForm({ ...pickupForm, scheduledDate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Time Slot</label>
                <select
                  value={pickupForm.timeSlot}
                  onChange={(e) => setPickupForm({ ...pickupForm, timeSlot: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                >
                  <option value="10:00 AM - 01:00 PM">Morning (10:00 AM - 01:00 PM)</option>
                  <option value="02:00 PM - 06:00 PM">Afternoon (02:00 PM - 06:00 PM)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Generate Pickup Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quality Inspection Modal */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Boxes className="size-4 text-purple-600" /> Technical Quality Inspection
              </h3>
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleInspect} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Outcome</label>
                <select
                  value={inspectForm.outcome}
                  onChange={(e) =>
                    setInspectForm({
                      ...inspectForm,
                      outcome: e.target.value,
                      restock: e.target.value === "passed",
                    })
                  }
                  className="w-full p-2.5 rounded-xl border bg-white"
                >
                  <option value="passed">Passed (Resellable condition)</option>
                  <option value="failed">Failed (Damaged / defective, Quarantine)</option>
                  <option value="partial">Partial Pass</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Verified Condition</label>
                <select
                  value={inspectForm.condition}
                  onChange={(e) => setInspectForm({ ...inspectForm, condition: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                >
                  <option value="unopened">Unopened / Sealed box</option>
                  <option value="opened_unused">Opened but unused</option>
                  <option value="defective">Defective / Malfunctioning</option>
                  <option value="damaged">Damaged / Scratched</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border">
                <input
                  type="checkbox"
                  id="restockCheck"
                  checked={inspectForm.restock}
                  onChange={(e) => setInspectForm({ ...inspectForm, restock: e.target.checked })}
                  className="rounded text-[#004D38] focus:ring-[#004D38]"
                />
                <label htmlFor="restockCheck" className="text-slate-800 font-semibold cursor-pointer">
                  Restock resellable units to warehouse sellable inventory
                </label>
              </div>

              {inspectForm.restock && warehouses.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Restock Destination Warehouse</label>
                  <select
                    value={inspectForm.warehouseId}
                    onChange={(e) => setInspectForm({ ...inspectForm, warehouseId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-white"
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
                <label className="block font-semibold text-slate-700 mb-1">Inspector Notes</label>
                <textarea
                  rows={2}
                  value={inspectForm.notes}
                  onChange={(e) => setInspectForm({ ...inspectForm, notes: e.target.value })}
                  placeholder="Verification details, serial numbers, seal checks..."
                  className="w-full p-2.5 rounded-xl border bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Record Inspection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fulfill Exchange Modal */}
      {exchangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <RefreshCw className="size-4 text-[#004D38]" /> Fulfill Replacement Shipment
              </h3>
              <button
                type="button"
                onClick={() => setExchangeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleFulfillExchange} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Carrier Partner</label>
                <select
                  value={exchangeForm.carrier}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, carrier: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                >
                  <option value="DELHIVERY">Delhivery Logistics</option>
                  <option value="BLUEDART">Blue Dart Express</option>
                  <option value="EKART">Ekart Logistics</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tracking Number / AWB</label>
                <input
                  type="text"
                  placeholder="e.g. DEL-EX-998271"
                  value={exchangeForm.trackingNumber}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, trackingNumber: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Delivery Days</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={exchangeForm.expectedDeliveryDays}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, expectedDeliveryDays: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExchangeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Dispatch Replacement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Refund Application Modal */}
      {applyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600" /> Apply for Refund Disbursement
              </h3>
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 space-y-1">
              <span className="font-bold block">Authoritative Refund Payable: {formatCurrency(totalRefundAmount)}</span>
              <p className="text-[11px] text-emerald-800">
                Disbursement is authorized and executed exclusively by marketplace administrators following review of your inspection evidence.
              </p>
            </div>

            <form onSubmit={handleSubmitRefundApplication} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Merchant Inspection Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={applyForm.merchantRemarks}
                  onChange={(e) => setApplyForm({ ...applyForm, merchantRemarks: e.target.value })}
                  placeholder="Detail your warehouse inspection findings, condition verified, serial numbers, and why customer refund is approved..."
                  className="w-full p-2.5 rounded-xl border bg-white resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deduction Justification (Optional)
                </label>
                <input
                  type="text"
                  value={applyForm.deductionExplanation}
                  onChange={(e) => setApplyForm({ ...applyForm, deductionExplanation: e.target.value })}
                  placeholder="If deductions were applied, specify policy reason..."
                  className="w-full p-2.5 rounded-xl border bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supporting Document URLs (Optional)
                </label>
                <input
                  type="text"
                  value={applyForm.supportingDocuments}
                  onChange={(e) => setApplyForm({ ...applyForm, supportingDocuments: e.target.value })}
                  placeholder="Comma-separated image or PDF links..."
                  className="w-full p-2.5 rounded-xl border bg-white font-mono text-[11px]"
                />
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="certifyAccurate"
                  required
                  checked={applyForm.certifiedAccurate}
                  onChange={(e) => setApplyForm({ ...applyForm, certifiedAccurate: e.target.checked })}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="certifyAccurate" className="text-slate-700 text-[11px] font-medium cursor-pointer">
                  I certify that returned units were received and verified in accordance with marketplace quality standards.
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApplyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Submit for Administrator Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise & Resubmit Application Modal */}
      {resubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <RefreshCw className="size-4 text-amber-600" /> Revise &amp; Resubmit Application
              </h3>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {refundApp?.revisionInstructions && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <span className="font-bold block text-amber-900">Administrator Instructions:</span>
                <p className="italic">&ldquo;{refundApp.revisionInstructions}&rdquo;</p>
              </div>
            )}

            <form onSubmit={handleResubmitRefundApplication} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Updated Inspection Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={resubmitForm.merchantRemarks}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, merchantRemarks: e.target.value })}
                  placeholder="Address the administrator's revision points and provide clarified findings..."
                  className="w-full p-2.5 rounded-xl border bg-white resize-none focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Updated Deduction Explanation (Optional)
                </label>
                <input
                  type="text"
                  value={resubmitForm.deductionExplanation}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, deductionExplanation: e.target.value })}
                  placeholder="Clarify deductions or fee adjustments..."
                  className="w-full p-2.5 rounded-xl border bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Updated Supporting Document URLs (Optional)
                </label>
                <input
                  type="text"
                  value={resubmitForm.supportingDocuments}
                  onChange={(e) => setResubmitForm({ ...resubmitForm, supportingDocuments: e.target.value })}
                  placeholder="Comma-separated image or PDF links..."
                  className="w-full p-2.5 rounded-xl border bg-white font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Resubmit Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Inspection */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[85vh] w-full h-[70vh] bg-black rounded-3xl overflow-hidden p-2">
            <Image src={previewImage} alt="Defect preview" fill className="object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/40"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
