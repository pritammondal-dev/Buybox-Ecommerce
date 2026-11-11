"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Quote,
  ShieldCheck,
  ShieldAlert,
  FileText,
  HelpCircle,
  Layers,
  Store,
  User,
  ExternalLink,
  Ban,
  Calendar,
  AlertCircle,
  History,
  DollarSign,
  Receipt,
  CheckCircle,
  ArrowRightLeft,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { adminOperationsService, adminInventoryService } from "@/services/admin/admin.service.js";
import { formatCurrency, parsePrice } from "@/utils/formatCurrency.js";

export default function AdminReturnDetailPage() {
  const params = useParams();
  const returnId = params?.id;

  const [returnReq, setReturnReq] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Standard Lifecycle Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

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
    packagingCondition: "intact",
    productCondition: "resellable",
    missingAccessories: false,
    missingAccessoriesNotes: "",
    deductionAmount: 0,
    deductionReason: "",
    deductionCategory: "none",
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

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundNotes, setRefundNotes] = useState("");

  // Superadmin Governance Override & Retry Modals
  const [overrideModal, setOverrideModal] = useState({
    open: false,
    action: "approve", // 'approve' (override rejection) | 'reject' (override approval)
    reason: "",
  });

  const [retryRefundModal, setRetryRefundModal] = useState({
    open: false,
    notes: "",
  });

  const [previewImage, setPreviewImage] = useState(null);

  const loadReturn = useCallback(async () => {
    if (!returnId) return;
    try {
      const res = await adminOperationsService.getReturn(returnId);
      const data = res?.data || res;
      setReturnReq(data);
    } catch (err) {
      toast.error("Failed to load return dossier", {
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
          adminOperationsService.getReturn(returnId),
          adminInventoryService.listWarehouses(),
        ]);
        if (!isMounted) return;
        if (returnRes.status === "fulfilled") {
          const data = returnRes.value?.data || returnRes.value;
          setReturnReq(data);
        }
        if (whRes.status === "fulfilled") {
          const list = whRes.value?.items || whRes.value?.warehouses || whRes.value?.data || whRes.value || [];
          const whArray = Array.isArray(list) ? list : [];
          setWarehouses(whArray);
          if (whArray.length > 0) {
            setInspectForm((prev) => ({ ...prev, warehouseId: whArray[0]._id || whArray[0].id }));
          }
        }
      } catch (err) {
        toast.error("Failed to load return details", {
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

  // Handlers for Standard Actions
  const handleApprove = async () => {
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.approveReturn(returnReq.secureId || returnReq._id, "Authorized by Superadmin");
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
    if (!returnReq || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setIsProcessingAction(true);
    try {
      await adminOperationsService.rejectReturn(returnReq.secureId || returnReq._id, rejectReason.trim());
      toast.success("Return request declined");
      setRejectModalOpen(false);
      setRejectReason("");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to decline return", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!returnReq || !cancelReason.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }
    setIsProcessingAction(true);
    try {
      await adminOperationsService.cancelReturn(returnReq.secureId || returnReq._id, cancelReason.trim());
      toast.success("Return request cancelled");
      setCancelModalOpen(false);
      setCancelReason("");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to cancel return", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSchedulePickup = async (e) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.scheduleReturnPickup(returnReq.secureId || returnReq._id, {
        carrier: pickupForm.carrier,
        scheduledDate: pickupForm.scheduledDate || undefined,
        timeSlot: pickupForm.timeSlot,
        notes: pickupForm.notes.trim() || undefined,
      });
      toast.success("Reverse courier pickup scheduled successfully");
      setPickupModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to schedule reverse pickup", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmPickup = async () => {
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.confirmReturnPickup(returnReq.secureId || returnReq._id, {
        notes: "Handover confirmed by Superadmin",
      });
      toast.success("Reverse pickup handover confirmed");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to confirm pickup handover", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleInspectSubmit = async (e) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.inspectReturn(returnReq.secureId || returnReq._id, {
        passed: inspectForm.outcome === "passed",
        outcome: inspectForm.outcome,
        condition: inspectForm.condition,
        receivedCondition: inspectForm.condition,
        packagingCondition: inspectForm.packagingCondition,
        productCondition: inspectForm.productCondition,
        missingAccessories: inspectForm.missingAccessories,
        missingAccessoriesNotes: inspectForm.missingAccessoriesNotes.trim() || undefined,
        deductionAmount: Number(inspectForm.deductionAmount) || 0,
        deductionReason: inspectForm.deductionReason.trim() || undefined,
        deductionCategory: inspectForm.deductionCategory,
        restock: inspectForm.restock,
        warehouseId: inspectForm.restock ? inspectForm.warehouseId || undefined : undefined,
        notes: inspectForm.notes.trim() || undefined,
      });
      toast.success("Quality inspection recorded and restocked");
      setInspectModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to record quality inspection", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.fulfillExchange(returnReq.secureId || returnReq._id, {
        carrier: exchangeForm.carrier,
        trackingNumber: exchangeForm.trackingNumber.trim() || undefined,
        expectedDeliveryDays: Number(exchangeForm.expectedDeliveryDays) || 3,
      });
      toast.success("Replacement order dispatched and exchange fulfilled");
      setExchangeModalOpen(false);
      await loadReturn();
    } catch (err) {
      toast.error("Failed to fulfill exchange replacement", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDisburseRefund = async (e) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.refundReturn(
        returnReq.secureId || returnReq._id,
        refundNotes.trim() || "Refund authorized by Superadmin"
      );
      toast.success("Customer refund processed successfully");
      setRefundModalOpen(false);
      setRefundNotes("");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to process refund", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handlers for Superadmin Overrides & Safe Retry
  const handleExecuteOverride = async (e) => {
    e.preventDefault();
    if (!returnReq || !overrideModal.reason.trim()) {
      toast.error("A mandatory reason is required for Superadmin override");
      return;
    }
    setIsProcessingAction(true);
    try {
      await adminOperationsService.overrideReturn(returnReq.secureId || returnReq._id, {
        action: overrideModal.action,
        reason: overrideModal.reason.trim(),
      });
      toast.success(
        overrideModal.action === "approve"
          ? "Superadmin override successful: Vendor rejection reversed to Approved"
          : "Superadmin override successful: Vendor approval revoked to Rejected"
      );
      setOverrideModal({ open: false, action: "approve", reason: "" });
      await loadReturn();
    } catch (err) {
      toast.error("Failed to execute override", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleExecuteRetryRefund = async (e) => {
    e.preventDefault();
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.retryRefundReturn(
        returnReq.secureId || returnReq._id,
        retryRefundModal.notes.trim() || "Superadmin safe refund retry initiated"
      );
      toast.success("Refund retry initiated successfully");
      setRetryRefundModal({ open: false, notes: "" });
      await loadReturn();
    } catch (err) {
      toast.error("Failed to retry refund", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReconcileRefund = async () => {
    if (!returnReq) return;
    setIsProcessingAction(true);
    try {
      await adminOperationsService.reconcileReturnRefund(returnReq.secureId || returnReq._id);
      toast.success("Gateway refund status reconciled successfully");
      await loadReturn();
    } catch (err) {
      toast.error("Failed to reconcile gateway refund", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-44 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-72 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!returnReq) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Return Request Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested return record could not be located in the marketplace database.
        </p>
        <Link
          href="/administrator/operations/returns"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Return Operations</span>
        </Link>
      </div>
    );
  }

  const items = returnReq.items || [];
  const status = returnReq.status;
  const isExchange = returnReq.type === "exchange";

  const customerInfo = returnReq.customerInformation || {};
  const selectedReason = customerInfo.selectedReason || returnReq.reason || returnReq.items?.[0]?.reason || "other";
  const selectedReasonLabel =
    customerInfo.selectedReasonLabel || returnReq.reasonLabel || returnReq.items?.[0]?.reasonLabel || selectedReason.replace(/_/g, " ");
  const customerComments =
    customerInfo.customerComments || returnReq.customerComments || returnReq.customerNotes || items[0]?.customerComments || null;
  const evidencePhotos = customerInfo.evidenceImages || returnReq.images || [];

  const finSummary = returnReq.financialSummary || {};
  const refundBreakdown = returnReq.refundBreakdown || {};
  const productRefund = refundBreakdown.productRefund || {};
  const taxRefund = refundBreakdown.taxRefund || {};
  const shippingRefund = refundBreakdown.shippingRefund || {};
  const deductions = refundBreakdown.deductions || {};
  const finalRefund = refundBreakdown.finalRefund || {};
  const merchantInspection = returnReq.merchantInspection || returnReq.inspection || null;

  const originalPayment = returnReq.originalPayment || {};
  const refundTransactions = returnReq.refundTransactions || [];
  const previousRefunds = returnReq.previousRefunds || [];
  const vendorDecision = returnReq.vendorDecision || {};
  const auditHistory = returnReq.auditHistory || [];

  const totalRefundAmount = parsePrice(finalRefund.netRefundableAmount || finSummary.totalRefund || returnReq.refundAmount);

  let baseItemSubtotal = parsePrice(productRefund.customerPaidAmount || finSummary.itemSubtotal || finSummary.netItemRefundTotal);
  if (baseItemSubtotal === 0 && items.length > 0) {
    baseItemSubtotal = items.reduce((acc, it) => {
      const unit = parsePrice(it.itemPrice || it.originalUnitPrice || it.customerPaidAmount);
      return acc + unit * (it.quantity || 1);
    }, 0);
  }

  let taxRefundAmount = parsePrice(taxRefund.refundableTax || finSummary.taxRefundTotal || returnReq.taxRefundTotal);
  if (taxRefundAmount === 0 && items.length > 0) {
    taxRefundAmount = items.reduce((acc, it) => {
      const tax = parsePrice(it.taxRefund);
      return acc + tax;
    }, 0);
  }

  const shippingRefundAmount = parsePrice(
    shippingRefund.refundableShipping || finSummary.shippingRefundTotal || returnReq.shippingRefundTotal
  );
  const deductionsAmount = parsePrice(
    deductions.amount || finSummary.customerDeductionsTotal || returnReq.customerDeductionsTotal
  );
  const previouslyRefundedAmount = parsePrice(
    finalRefund.previouslyRefunded || returnReq.previouslyRefundedTotal || 0
  );
  const remainingRefundableAmount = parsePrice(
    finalRefund.remainingRefundableAmount || 0
  );

  const customerName =
    returnReq.customer?.name ||
    (returnReq.customerId?.firstName ? `${returnReq.customerId.firstName} ${returnReq.customerId.lastName}` : "Customer");
  const customerEmail = returnReq.customer?.email || returnReq.customerId?.email;
  const customerPhone = returnReq.customer?.phone || returnReq.customerId?.phone;

  const vendor = returnReq.vendor || returnReq.vendorId || items[0]?.vendor || items[0]?.vendorId || null;
  const vendorName = vendor?.storeName || vendor?.businessName || "Marketplace Vendor";
  const vendorStatus = returnReq.vendorStatus || vendor?.accountStatus || (vendor?.isActive ? "active" : "inactive");
  const isVendorUnavailable = ["suspended", "inactive", "unavailable"].includes(vendorStatus);

  const refundLifecycleStatus =
    finalRefund.status ||
    (status === "refunded"
      ? "processed"
      : status === "refund_pending"
      ? "initiated"
      : ["approved", "inspected", "received"].includes(status)
      ? "authorized"
      : "estimated");

  const latestRefundTx = refundTransactions[0] || null;
  const hasFailedRefund =
    refundLifecycleStatus === "failed" ||
    latestRefundTx?.status === "failed" ||
    /failed/i.test(returnReq.resolutionNotes || "");

  const timelineEvents = returnReq.timeline || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 pb-28">
      {/* Navigation Header */}
      <div>
        <Link
          href="/administrator/operations/returns"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Return Operations</span>
        </Link>

        {/* SECTION 1: RETURN OVERVIEW HERO */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <RotateCcw className="size-6 text-[#004D38]" />
                <span>Return #{returnReq.returnNumber || returnReq.secureId}</span>
              </h1>

              {/* Lifecycle Acceptance Status Badge */}
              <span
                className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  status === "refunded" || status === "exchange_completed" || status === "exchange_fulfilled"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : status === "rejected" || status === "cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                RMA: {status?.replace(/_/g, " ")}
              </span>

              {/* Return Type Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#004D38] border border-emerald-200">
                {returnReq.type || "return"}
              </span>

              {/* Refund Authorization Status Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  refundLifecycleStatus === "processed"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : refundLifecycleStatus === "authorized"
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : refundLifecycleStatus === "initiated"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : refundLifecycleStatus === "failed"
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                Refund Auth: {refundLifecycleStatus}
              </span>

              {/* Original Payment Status Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  originalPayment.paymentStatus === "paid" || originalPayment.paymentStatus === "captured"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : originalPayment.paymentStatus === "refunded"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Payment: {originalPayment.paymentStatus || "unverified"}
              </span>

              {/* Physical Return Status Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200">
                Pickup: {returnReq.reversePickupSchedule?.status || (returnReq.reversePickupSchedule ? "scheduled" : "unassigned")}
              </span>

              {/* Inspection Status Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  merchantInspection && (merchantInspection.passed || merchantInspection.status === "completed")
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                QC: {merchantInspection?.status || (merchantInspection?.passed !== undefined ? (merchantInspection.passed ? "passed" : "quarantined") : "pending")}
              </span>
            </div>

            {/* Contextual Sub-bar */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
              <span>
                Order:{" "}
                <Link
                  href={`/admin/operations/orders/${returnReq.orderId?._id || returnReq.orderId}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  #{returnReq.orderNumber}
                </Link>
              </span>
              <span>•</span>
              <span>
                Customer: <strong className="text-slate-800 font-semibold">{customerName}</strong>
                {customerEmail && <span className="text-slate-400 font-mono text-[11px]"> ({customerEmail})</span>}
                {customerPhone && <span className="text-slate-400 text-[11px]"> • {customerPhone}</span>}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Store className="size-3.5 text-slate-400" />
                <span>
                  Store: <strong className="text-slate-800 font-semibold">{vendorName}</strong>
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                    vendorStatus === "suspended"
                      ? "bg-rose-100 text-rose-800"
                      : vendorStatus === "inactive" || vendorStatus === "unavailable"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {vendorStatus}
                </span>
              </span>
              <span>•</span>
              <span>
                Filed: {returnReq.createdAt ? new Date(returnReq.createdAt).toLocaleString("en-IN") : "N/A"}
              </span>
            </div>
          </div>

          {/* Superadmin Governance Action Center */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {status === "requested" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Authorize Return</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(true)}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <XCircle className="size-3.5" />
                  <span>Decline</span>
                </button>
              </>
            )}

            {/* Superadmin Override Controls */}
            {status === "rejected" && (
              <button
                type="button"
                onClick={() => setOverrideModal({ open: true, action: "approve", reason: "" })}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="size-3.5" />
                <span>Override Rejection (Approve)</span>
              </button>
            )}

            {status === "approved" && (
              <>
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(true)}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Truck className="size-3.5" />
                  <span>Schedule Reverse Pickup</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideModal({ open: true, action: "reject", reason: "" })}
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ShieldAlert className="size-3.5" />
                  <span>Override Approval (Decline)</span>
                </button>
              </>
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

            {["picked_up", "received", "item_received"].includes(status) && (
              <button
                type="button"
                onClick={() => setInspectModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Boxes className="size-3.5" />
                <span>Quality Inspection</span>
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
                <span>Dispatch Replacement</span>
              </button>
            )}

            {status === "inspected" && !isExchange && (
              <button
                type="button"
                onClick={() => setRefundModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CreditCard className="size-3.5" />
                <span>Disburse Refund</span>
              </button>
            )}

            {status === "refund_pending" && !isExchange && (
              <button
                type="button"
                onClick={handleReconcileRefund}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isProcessingAction ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                <span>Verify Gateway Status</span>
              </button>
            )}

            {hasFailedRefund && !isExchange && (
              <button
                type="button"
                onClick={() => setRetryRefundModal({ open: true, notes: "" })}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Retry Failed Refund</span>
              </button>
            )}

            {!["refunded", "exchange_completed", "exchange_fulfilled", "cancelled", "rejected"].includes(status) && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Ban className="size-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Special Vendor Unavailable Governance Notice */}
      {isVendorUnavailable && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold">Superadmin Intervention Active — Vendor Account {vendorStatus.toUpperCase()}</h4>
            <p className="text-amber-800 leading-relaxed">
              The assigned merchant (<strong>{vendorName}</strong>) is currently {vendorStatus}. As Superadmin, you have full administrative authority to inspect items, authorize reverse logistics, disburse authoritative customer refunds, or dispatch replacement units to protect customer satisfaction and marketplace SLA obligations.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 7: ORIGINAL PAYMENT INFORMATION (PHASE 3) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-[#004D38]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Authoritative Original Payment Information
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
              originalPayment.isAvailable
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {originalPayment.isAvailable ? "Payment Record Verified" : "Payment Information Unavailable"}
          </span>
        </div>

        {originalPayment.isAvailable ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Method</span>
              <strong className="text-slate-900 text-sm capitalize block mt-1">
                {originalPayment.paymentMethod ? originalPayment.paymentMethod.replace(/_/g, " ") : "N/A"}
              </strong>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block uppercase">
                Gateway: {originalPayment.paymentGateway || "Internal"}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Transaction Reference ID</span>
              <strong className="text-slate-900 font-mono text-xs block mt-1 break-all">
                {originalPayment.transactionId || originalPayment.referenceId || "N/A"}
              </strong>
              {originalPayment.referenceId && originalPayment.transactionId && (
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Order ID: {originalPayment.referenceId}
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Captured Payment Value</span>
              <strong className="text-emerald-700 text-sm font-black block mt-1">
                {formatCurrency(originalPayment.amountCaptured)}
              </strong>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Total Order: {formatCurrency(originalPayment.orderAmount)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Payment Capture Date</span>
              <strong className="text-slate-800 text-xs block mt-1">
                {originalPayment.paymentDate
                  ? new Date(originalPayment.paymentDate).toLocaleString("en-IN")
                  : "N/A"}
              </strong>
              {originalPayment.isCod ? (
                <span
                  className={`text-[10px] font-bold uppercase mt-1 inline-block px-2 py-0.5 rounded ${
                    originalPayment.codReconciled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  COD: {originalPayment.codCollectionStatus?.replace(/_/g, " ") || "Pending Reconciliation"}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 block capitalize">
                  Status: {originalPayment.paymentStatus}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <p>
              Authoritative payment gateway record was not found for this order. Payment status is unverified. Manual bank verification is required before issuing financial credits.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 8: AUTHORITATIVE 5-PILLAR REFUND BREAKDOWN & RECONCILIATION HERO */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-700/60 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 size-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-700/60">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                Authoritative Refund Breakdown &amp; Financial Reconciliation
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  refundLifecycleStatus === "processed"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : refundLifecycleStatus === "authorized"
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    : refundLifecycleStatus === "initiated"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    : refundLifecycleStatus === "failed"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                }`}
              >
                Status: {refundLifecycleStatus}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {formatCurrency(totalRefundAmount)}
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {returnReq.orderId?.currency || "INR"} Net Authoritative Payable
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Computed strictly from customer-paid line-item valuation net of item discounts, proportional cart coupon allocation, statutory GST input reversal, and documented inspection deductions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700 px-4 py-2.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Disbursement Destination
              </span>
              <span className="text-xs font-bold text-white capitalize">
                {returnReq.refundMethod ? returnReq.refundMethod.replace(/_/g, " ") : "Original Source"}
              </span>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700 px-4 py-2.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Line Items &amp; Physical Units
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {items.length} Product Line(s) · {items.reduce((acc, it) => acc + (it.quantity || 1), 0)} Total Unit(s)
              </span>
            </div>

            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700 px-4 py-2.5 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Available Refund Pool
              </span>
              <span className="text-xs font-bold text-white">
                {formatCurrency(finalRefund.availableRefundableBalance != null ? finalRefund.availableRefundableBalance : remainingRefundableAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* 4-Pillar Refund Pool Accounting Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">1. Original Captured</span>
            <span className="text-sm font-black text-white block mt-0.5">
              {formatCurrency(finalRefund.originalRefundableAmount || originalPayment.amountCaptured || totalRefundAmount)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">2. Successfully Refunded</span>
            <span className="text-sm font-black text-emerald-400 block mt-0.5">
              {formatCurrency(finalRefund.successfullyRefundedAmount || previouslyRefundedAmount || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">3. In-Flight / Reserved</span>
            <span className="text-sm font-black text-amber-300 block mt-0.5">
              {formatCurrency(finalRefund.pendingReservedAmount || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">4. Available Balance</span>
            <span className="text-sm font-black text-emerald-300 block mt-0.5">
              {formatCurrency(finalRefund.availableRefundableBalance != null ? finalRefund.availableRefundableBalance : remainingRefundableAmount)}
            </span>
          </div>
        </div>

        {/* 5-Column Itemized Financial Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-6">
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              1. Product Refund
            </span>
            <span className="text-base sm:text-lg font-black text-white block mt-1">
              {formatCurrency(baseItemSubtotal)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Net customer-paid unit value
            </span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              2. GST Reversal
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-400 block mt-1">
              + {formatCurrency(taxRefundAmount)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              CGST/SGST/IGST tax reversal
            </span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              3. Shipping Refund
            </span>
            <span className="text-base sm:text-lg font-black text-slate-200 block mt-1">
              + {formatCurrency(shippingRefundAmount)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {shippingRefundAmount > 0 ? "Eligible freight reversal" : "Policy non-refundable"}
            </span>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              4. Deductions &amp; Prior
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-300 block mt-1">
              - {formatCurrency(deductionsAmount + previouslyRefundedAmount)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {deductionsAmount > 0
                ? `${deductions.category || "Inspection deduction"}`
                : previouslyRefundedAmount > 0
                ? `Prior refund: ${formatCurrency(previouslyRefundedAmount)}`
                : "₹0.00 (Zero deduction)"}
            </span>
          </div>

          <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 block">
              5. Final Payable
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-400 block mt-1">
              {formatCurrency(totalRefundAmount)}
            </span>
            <span className="text-[11px] text-emerald-300/80 mt-0.5 block uppercase font-mono text-[10px]">
              {refundLifecycleStatus}
            </span>
          </div>
        </div>

        {/* Balanced Reconciliation Formula Bar */}
        <div className="mt-5 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-mono text-[11px] flex-wrap">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
            <span>
              Reconciliation: Product ({formatCurrency(baseItemSubtotal)}) + Tax ({formatCurrency(taxRefundAmount)}) + Shipping ({formatCurrency(shippingRefundAmount)}) - Prior ({formatCurrency(previouslyRefundedAmount)}) - Deductions ({formatCurrency(deductionsAmount)}) = Net Payable ({formatCurrency(totalRefundAmount)})
            </span>
          </div>
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-400 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-700/50 self-start sm:self-auto shrink-0">
            100% Balanced &amp; Authoritative
          </span>
        </div>
      </div>

      {/* SECTION 9: PREVIOUS REFUND HISTORY (PHASE 4) */}
      {previousRefunds.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <DollarSign className="size-4 text-purple-600" /> Previous Refund History for Order #{returnReq.orderNumber}
            </h3>
            <span className="text-[10px] font-bold text-slate-500">
              {previousRefunds.length} Prior Refund(s) Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Gateway Refund ID</th>
                  <th className="px-4 py-2.5">Gateway</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previousRefunds.map((rf, rfIdx) => (
                  <tr key={rfIdx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700">
                      {rf.createdAt ? new Date(rf.createdAt).toLocaleDateString("en-IN") : "N/A"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-800">
                      {rf.gatewayRefundId || rf._id}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-600 font-mono text-[10px]">
                      {rf.gateway}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">
                      {formatCurrency(rf.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rf.status === "processed"
                            ? "bg-emerald-100 text-emerald-800"
                            : rf.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {rf.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {rf.reason || "Order return refund"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 14: REFUND TRANSACTION HISTORY & GATEWAY STATUS (PHASE 6) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Gateway Refund Transaction Ledger
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                status === "refunded"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : hasFailedRefund
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              {status === "refunded" ? "Authoritative Settlement Confirmed" : hasFailedRefund ? "Refund Failed — Retry Available" : "Awaiting Gateway Initiation"}
            </span>
          </div>
        </div>

        {refundTransactions.length === 0 ? (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-500 italic">
            No gateway refund transaction has been initiated yet for this return request.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Gateway / Internal ID</th>
                  <th className="px-4 py-2.5">Provider</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-4 py-2.5">Gateway Status</th>
                  <th className="px-4 py-2.5">Administrator Notes</th>
                  <th className="px-4 py-2.5">Gateway Diagnostic / Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refundTransactions.map((tx, txIdx) => (
                  <tr key={txIdx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-IN") : "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 text-[11px]">
                        {tx.gatewayRefundId || <span className="text-amber-600 italic">Pending Gateway ID</span>}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        Internal: {tx.id || tx._id}
                      </div>
                      {tx.arn && (
                        <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-semibold border border-blue-200">
                          ARN: {tx.arn}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-700 font-mono text-[10px]">
                      {tx.gateway}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          tx.status === "processed"
                            ? "bg-emerald-100 text-emerald-800"
                            : tx.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : tx.status === "reversed"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {tx.status === "processed"
                          ? "Processed"
                          : tx.status === "pending"
                          ? "Pending Confirmation"
                          : tx.status === "reversed"
                          ? "Reversed"
                          : "Failed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs text-xs">
                      {tx.reason ? (
                        <span className="text-slate-700 italic">“{tx.reason}”</span>
                      ) : (
                        <span className="text-slate-400 italic">No notes</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-sm text-xs">
                      {tx.failureReason ? (
                        <span className="text-rose-600 font-semibold">{tx.failureReason}</span>
                      ) : tx.normalizedGatewayMessage ? (
                        <span className="text-slate-700">{tx.normalizedGatewayMessage}</span>
                      ) : tx.status === "pending" ? (
                        <span className="text-amber-700 font-medium">Awaiting settlement confirmation from gateway</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Gateway settlement confirmed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 13: VENDOR DECISION & INTERVENTION HISTORY (PHASE 5) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Building className="size-4 text-blue-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Vendor Decision &amp; Administrative Intervention Summary
            </h3>
          </div>
          {vendorDecision.isOverridden && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
              <ShieldCheck className="size-3" /> Superadmin Overridden
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-2xl">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Merchant</span>
            <strong className="text-slate-900 text-sm mt-1 block">{vendorName}</strong>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Status: {vendorStatus}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Vendor Decision</span>
            <strong className="text-slate-900 text-sm mt-1 block capitalize">
              {vendorDecision.decision || "Pending Decision"}
            </strong>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {vendorDecision.decisionDate
                ? new Date(vendorDecision.decisionDate).toLocaleString("en-IN")
                : "No response recorded"}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Vendor Feedback / Reason</span>
            <p className="text-slate-700 italic mt-1">
              {vendorDecision.notes ? `“${vendorDecision.notes}”` : "No notes logged by merchant."}
            </p>
          </div>
        </div>

        {vendorDecision.isOverridden && vendorDecision.overrideDetails && (
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="size-4 text-purple-700" />
              <span>Superadmin Override Recorded</span>
            </div>
            <p className="text-purple-800 text-xs">
              {vendorDecision.overrideDetails.reason} (
              {new Date(vendorDecision.overrideDetails.timestamp).toLocaleString("en-IN")})
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2 & SECTION 6: CUSTOMER REASON & REVERSE LOGISTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECTION 2: Customer Stated Return Information (Immutable) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Quote className="size-3.5 text-[#004D38]" /> Customer Return Reason &amp; Comments
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
              Customer Submitted (Immutable)
            </span>
          </div>

          {/* Structured Reason Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Customer Selected Structured Reason
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#004D38]/10 text-[#004D38] border border-[#004D38]/20">
                <AlertTriangle className="size-3.5" />
                {selectedReasonLabel}
              </span>
              <span className="text-[11px] font-mono text-slate-400">({selectedReason})</span>
            </div>
          </div>

          {/* Customer Comments Blockquote */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Additional Customer Comments / Explanation
            </span>
            {customerComments ? (
              <blockquote className="text-xs text-slate-800 leading-relaxed bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60 italic relative">
                &ldquo;{customerComments}&rdquo;
              </blockquote>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                No additional free-text comments were provided by the customer.
              </p>
            )}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Eligibility Window:</span>
            <span className="font-semibold text-slate-800">
              {returnReq.eligibilityDeadline
                ? new Date(returnReq.eligibilityDeadline).toLocaleDateString("en-IN")
                : "Standard 7-Day Window"}
            </span>
          </div>
        </div>

        {/* SECTION 6: Reverse Logistics Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Truck className="size-4 text-blue-600" /> Doorstep Logistics &amp; Reverse AWB
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Courier Dispatch
            </span>
          </div>

          {returnReq.reversePickupSchedule ? (
            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Carrier Partner:</span>
                <strong className="text-slate-900">{returnReq.reversePickupSchedule.carrier}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Pickup Token:</span>
                <strong className="font-mono text-blue-800">
                  {returnReq.reversePickupSchedule.pickupToken || "Generated"}
                </strong>
              </div>
              {returnReq.reversePickupSchedule.trackingNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Reverse AWB Tracking:</span>
                  <strong className="font-mono">{returnReq.reversePickupSchedule.trackingNumber}</strong>
                </div>
              )}
              {returnReq.reversePickupSchedule.scheduledDate && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Scheduled Date:</span>
                  <span className="text-slate-800 font-semibold">
                    {new Date(returnReq.reversePickupSchedule.scheduledDate).toLocaleDateString("en-IN")}
                  </span>
                </div>
              )}
              {returnReq.reversePickupSchedule.timeSlot && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Pickup Window:</span>
                  <span className="text-slate-800 font-semibold">
                    {returnReq.reversePickupSchedule.timeSlot}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-500 italic space-y-2">
              <p>Reverse courier pickup has not yet been scheduled.</p>
              {status === "approved" && (
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 not-italic cursor-pointer"
                >
                  <Truck className="size-3" />
                  <span>Schedule Reverse Pickup</span>
                </button>
              )}
            </div>
          )}

          {returnReq.pickupAddress && (
            <div className="text-[11px] text-slate-600 pt-1 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Customer Doorstep Collection Address
              </span>
              <p className="font-medium text-slate-800">
                {returnReq.pickupAddress.fullName && <span>{returnReq.pickupAddress.fullName} • </span>}
                {returnReq.pickupAddress.street || returnReq.pickupAddress.addressLine1},{" "}
                {returnReq.pickupAddress.city}, {returnReq.pickupAddress.state} - {returnReq.pickupAddress.postalCode}
                {returnReq.pickupAddress.phone && ` (Ph: ${returnReq.pickupAddress.phone})`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5: QUALITY INSPECTION PANEL */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Boxes className="size-4 text-purple-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Quality Inspection &amp; Technical Verification Findings
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
              merchantInspection && (status === "inspected" || merchantInspection.inspectedAt)
                ? merchantInspection.passed
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}
          >
            {merchantInspection && (status === "inspected" || merchantInspection.inspectedAt)
              ? `Inspection Complete (${merchantInspection.passed ? "Passed" : "Quarantined"})`
              : "Pending Warehouse Inspection"}
          </span>
        </div>

        {merchantInspection && (status === "inspected" || merchantInspection.inspectedAt) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Inspection Outcome</span>
              <strong
                className={`capitalize mt-1 block font-black text-sm ${
                  merchantInspection.passed ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {merchantInspection.outcome || (merchantInspection.passed ? "Resellable" : "Defective")}
              </strong>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {merchantInspection.inspectedAt
                  ? new Date(merchantInspection.inspectedAt).toLocaleString("en-IN")
                  : "Verified"}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified Received Condition</span>
              <strong className="capitalize mt-1 block font-bold text-slate-800">
                {merchantInspection.receivedCondition ? merchantInspection.receivedCondition.replace(/_/g, " ") : "Inspected"}
              </strong>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Packaging: {merchantInspection.packagingCondition || "intact"}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Missing Accessories</span>
              <strong
                className={`mt-1 block font-bold ${
                  merchantInspection.missingAccessories ? "text-rose-600" : "text-slate-800"
                }`}
              >
                {merchantInspection.missingAccessories ? "Missing Parts Documented" : "All Components Intact"}
              </strong>
              {merchantInspection.missingAccessoriesNotes && (
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {merchantInspection.missingAccessoriesNotes}
                </span>
              )}
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Documented Deductions</span>
              <strong
                className={`mt-1 block font-black text-sm ${
                  deductionsAmount > 0 ? "text-amber-700" : "text-slate-800"
                }`}
              >
                {deductionsAmount > 0 ? `- ${formatCurrency(deductionsAmount)}` : "₹0.00 (Zero Penalty)"}
              </strong>
              {merchantInspection.deductionReason && (
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {merchantInspection.deductionReason}
                </span>
              )}
            </div>

            {merchantInspection.notes && (
              <div className="sm:col-span-2 lg:col-span-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 text-xs">
                <span className="text-[10px] uppercase font-bold text-purple-700 block mb-1">
                  Inspector Verification Notes
                </span>
                <p className="text-slate-800 italic">{merchantInspection.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-800">Physical Quality Inspection Pending</h4>
              <p className="text-xs text-slate-500">
                Package is in transit or awaiting physical unboxing at the fulfillment warehouse. Superadmin can record administrative inspection on behalf of merchant.
              </p>
            </div>
            {["picked_up", "received", "item_received"].includes(status) && (
              <button
                type="button"
                onClick={() => setInspectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <Boxes className="size-3.5" />
                <span>Perform Technical Inspection</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Defect Photograph Gallery */}
      {evidencePhotos.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Camera className="size-4 text-slate-400" /> Customer Submitted Photographs ({evidencePhotos.length})
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

      {/* SECTION 4: RETURNED PRODUCTS & VALUATION TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Returned Products &amp; Line Valuation</h3>
            <p className="text-xs text-slate-500">
              Complete itemization with merchant attribution, pre-tax unit price, discount reversal, GST tax refund, and net payable.
            </p>
          </div>
          <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-100">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Total Authoritative Refund
            </span>
            <span className="text-base font-black text-slate-900">
              {formatCurrency(totalRefundAmount)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Product &amp; SKU</th>
                <th className="px-6 py-3.5">Vendor / Store</th>
                <th className="px-6 py-3.5 text-center">Quantity</th>
                <th className="px-6 py-3.5">Condition</th>
                <th className="px-6 py-3.5 text-right">Unit Value</th>
                <th className="px-6 py-3.5 text-right">GST Refund</th>
                <th className="px-6 py-3.5 text-right">Total Line Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const qty = item.quantity || 1;
                const unitVal = parsePrice(item.itemPrice || item.originalUnitPrice || item.customerPaidAmount);
                const taxVal = parsePrice(item.taxRefund);
                const itemLineRefund = parsePrice(item.customerPaidAmount) || unitVal * qty;
                const itemVendorName = item.vendor?.storeName || item.vendor?.businessName || vendorName;

                return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {item.name || item.productName || item.sku || "Product Item"}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.sku && <span className="text-[11px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                        {item.reason && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded capitalize">
                            {item.reason.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{itemVendorName}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-800">{qty}</td>
                    <td className="px-6 py-4 text-slate-600 capitalize">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {item.condition ? item.condition.replace(/_/g, " ") : "unopened"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-700">
                      {formatCurrency(unitVal)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-700">
                      {taxVal > 0 ? `+ ${formatCurrency(taxVal)}` : "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(itemLineRefund)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER BANK / DISBURSEMENT DESTINATION */}
      {returnReq.bankDetails && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CreditCard className="size-4 text-emerald-600" /> Customer Bank Account / Payout Destination
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

      {/* SECTION 15: ADMINISTRATIVE AUDIT HISTORY (PHASE 7) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#004D38]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Immutable Administrative Audit History
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {auditHistory.length} Cryptographically Sealed Log(s)
          </span>
        </div>

        {auditHistory.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No administrative governance logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Actor Identity</th>
                  <th className="px-4 py-2.5">Reason / Justification</th>
                  <th className="px-4 py-2.5">State Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditHistory.map((log, logIdx) => (
                  <tr key={logIdx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("en-IN") : "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          log.action.includes("OVERRIDE")
                            ? "bg-purple-100 text-purple-800"
                            : log.action.includes("APPROVED")
                            ? "bg-emerald-100 text-emerald-800"
                            : log.action.includes("REJECTED")
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <strong className="text-slate-900 block font-semibold">{log.actor?.name || "Admin"}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.actor?.email} ({log.actor?.role})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-sm">
                      {log.reason ? <span className="italic">“{log.reason}”</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                      {log.beforeState?.status} &rarr; {log.afterState?.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 12: CHRONOLOGICAL AUDIT ACTIVITY TIMELINE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <History className="size-4 text-slate-500" /> Operational Audit Trail &amp; Lifecycle Timeline
          </h3>
          <span className="text-[10px] font-bold text-slate-400">
            {timelineEvents.length} Recorded Milestone(s)
          </span>
        </div>

        {timelineEvents.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No historical milestone logs recorded yet.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineEvents.map((evt, idx) => {
              const actorRole = evt.actor?.actorType || "system";
              const isEventAdmin = actorRole === "admin";
              const isEventVendor = actorRole === "vendor";

              return (
                <div key={idx} className="relative group">
                  <div
                    className={`absolute -left-6 top-1 size-3 rounded-full border-2 bg-white ${
                      isEventAdmin
                        ? "border-[#004D38] ring-4 ring-[#004D38]/10"
                        : isEventVendor
                        ? "border-blue-600"
                        : "border-slate-400"
                    }`}
                  />
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="capitalize text-slate-900 font-bold">
                        {evt.status ? evt.status.replace(/_/g, " ") : "Action Recorded"}
                      </strong>
                      <span
                        className={`px-2 py-0.2 rounded text-[10px] font-extrabold uppercase ${
                          isEventAdmin
                            ? "bg-[#004D38]/10 text-[#004D38]"
                            : isEventVendor
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {actorRole}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString("en-IN") : "N/A"}
                      </span>
                    </div>
                    {evt.notes && (
                      <p className="text-slate-600 text-xs leading-relaxed pt-0.5">
                        {evt.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTION MODAL: REJECT RETURN */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="size-5 text-rose-600" />
                <span>Decline Return Request</span>
              </h3>
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
                  Mandatory Rejection Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain policy reason for declination (e.g. return window expired, customer physical damage, seal tampered)..."
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
                  <span>Confirm Declination</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: CANCEL RETURN */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Ban className="size-5 text-slate-600" />
                <span>Cancel Return Request</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCancel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="State reason for administrative return cancellation (e.g. customer withdrew request, fraud check failed)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Execute Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: SCHEDULE REVERSE PICKUP */}
      {pickupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Truck className="size-5 text-blue-600" />
                <span>Schedule Reverse Courier Pickup</span>
              </h3>
              <button
                type="button"
                onClick={() => setPickupModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSchedulePickup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier Partner</label>
                <select
                  value={pickupForm.carrier}
                  onChange={(e) => setPickupForm((prev) => ({ ...prev, carrier: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="DELHIVERY">Delhivery Reverse Express</option>
                  <option value="BLUEDART">Blue Dart Express</option>
                  <option value="EKART">Ekart Logistics</option>
                  <option value="SHADOWFAX">Shadowfax Hyperlocal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Date</label>
                <input
                  type="date"
                  value={pickupForm.scheduledDate}
                  onChange={(e) => setPickupForm((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot</label>
                <select
                  value={pickupForm.timeSlot}
                  onChange={(e) => setPickupForm((prev) => ({ ...prev, timeSlot: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="10:00 AM - 01:00 PM">Morning (10:00 AM - 01:00 PM)</option>
                  <option value="01:00 PM - 04:00 PM">Afternoon (01:00 PM - 04:00 PM)</option>
                  <option value="04:00 PM - 07:00 PM">Evening (04:00 PM - 07:00 PM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Courier Dispatch Notes</label>
                <textarea
                  rows={2}
                  value={pickupForm.notes}
                  onChange={(e) => setPickupForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special instructions for reverse courier rider..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Dispatch Reverse Pickup</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: TECHNICAL QUALITY INSPECTION */}
      {inspectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="size-5 text-purple-600" />
                <span>Perform Technical Quality Inspection</span>
              </h3>
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inspection Outcome</label>
                  <select
                    value={inspectForm.outcome}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, outcome: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="passed">Passed (Resellable Grade A)</option>
                    <option value="quarantined">Quarantined (Defective/Damaged)</option>
                    <option value="failed">Failed (Counterfeit/Scam)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Received Condition</label>
                  <select
                    value={inspectForm.condition}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, condition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="unopened">Unopened / Sealed</option>
                    <option value="opened_unused">Opened but Unused</option>
                    <option value="defective_in_box">Defective in Box</option>
                    <option value="damaged">Physical Damage</option>
                    <option value="missing_parts">Missing Parts</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Packaging Condition</label>
                  <select
                    value={inspectForm.packagingCondition}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, packagingCondition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="intact">Intact &amp; Original</option>
                    <option value="damaged">Damaged / Torn Box</option>
                    <option value="missing">Missing Original Box</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Condition</label>
                  <select
                    value={inspectForm.productCondition}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, productCondition: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  >
                    <option value="resellable">Like New / Resellable</option>
                    <option value="minor_scratches">Minor Scratches</option>
                    <option value="damaged">Non-Functional</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="missingAcc"
                  checked={inspectForm.missingAccessories}
                  onChange={(e) => setInspectForm((prev) => ({ ...prev, missingAccessories: e.target.checked }))}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="missingAcc" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Missing accessories or box components
                </label>
              </div>

              {inspectForm.missingAccessories && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Missing Components Notes</label>
                  <input
                    type="text"
                    value={inspectForm.missingAccessoriesNotes}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, missingAccessoriesNotes: e.target.value }))}
                    placeholder="List missing cables, charger, manual..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Restocking Deduction (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inspectForm.deductionAmount}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, deductionAmount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deduction Reason</label>
                  <input
                    type="text"
                    value={inspectForm.deductionReason}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, deductionReason: e.target.value }))}
                    placeholder="e.g. Missing power cable (-₹250)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="restockWarehouse"
                    checked={inspectForm.restock}
                    onChange={(e) => setInspectForm((prev) => ({ ...prev, restock: e.target.checked }))}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="restockWarehouse" className="text-xs font-semibold text-purple-900 cursor-pointer">
                    Restock items into central warehouse inventory
                  </label>
                </div>

                {inspectForm.restock && warehouses.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-purple-800 mb-1">Target Warehouse</label>
                    <select
                      value={inspectForm.warehouseId}
                      onChange={(e) => setInspectForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    >
                      {warehouses.map((wh) => (
                        <option key={wh._id || wh.id} value={wh._id || wh.id}>
                          {wh.name || wh.code} ({wh.location?.city || "Central Hub"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Inspection Notes</label>
                <textarea
                  rows={2}
                  value={inspectForm.notes}
                  onChange={(e) => setInspectForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Technical findings, IMEI verification, hardware notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Save Inspection &amp; Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: FULFILL EXCHANGE REPLACEMENT */}
      {exchangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="size-5 text-[#004D38]" />
                <span>Dispatch Exchange Replacement</span>
              </h3>
              <button
                type="button"
                onClick={() => setExchangeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExchangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Carrier Partner</label>
                <select
                  value={exchangeForm.carrier}
                  onChange={(e) => setExchangeForm((prev) => ({ ...prev, carrier: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                >
                  <option value="DELHIVERY">Delhivery Express</option>
                  <option value="BLUEDART">Blue Dart Air</option>
                  <option value="EKART">Ekart Logistics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Outbound Tracking Number (AWB)</label>
                <input
                  type="text"
                  required
                  value={exchangeForm.trackingNumber}
                  onChange={(e) => setExchangeForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                  placeholder="Enter outbound replacement tracking AWB..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Delivery Days</label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={exchangeForm.expectedDeliveryDays}
                  onChange={(e) => setExchangeForm((prev) => ({ ...prev, expectedDeliveryDays: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExchangeModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: DISBURSE REFUND */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="size-5 text-emerald-600" />
                <span>Disburse Authoritative Customer Refund</span>
              </h3>
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleDisburseRefund} className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Total Payable Refund</span>
                <strong className="text-2xl font-black text-emerald-950 block">
                  {formatCurrency(totalRefundAmount)}
                </strong>
                <span className="text-[11px] text-emerald-800 block">
                  Destination: {returnReq.refundMethod ? returnReq.refundMethod.replace(/_/g, " ") : "Original Payment Method"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Authorization Notes</label>
                <textarea
                  rows={2}
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  placeholder="State authorization notes for payout and financial ledger entry..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Authorize Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: SUPERADMIN OVERRIDE */}
      {overrideModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-purple-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-purple-950 flex items-center gap-2">
                <ShieldAlert className="size-5 text-purple-600" />
                <span>Superadmin Governance Override</span>
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModal({ open: false, action: "approve", reason: "" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteOverride} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-950 space-y-1">
                <strong>Action: {overrideModal.action === "approve" ? "Reverse Rejection to APPROVED" : "Revoke Approval to REJECTED"}</strong>
                <p className="text-[11px] text-purple-800">
                  This administrative action overrides the prior vendor decision and records an immutable audit log under your credentials.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Override Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideModal.reason}
                  onChange={(e) => setOverrideModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="State formal justification for overriding the vendor decision (e.g. verified false claim, customer dispute resolution)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideModal({ open: false, action: "approve", reason: "" })}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Execute Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTION MODAL: RETRY FAILED REFUND */}
      {retryRefundModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="size-5 text-rose-600" />
                <span>Retry Failed Gateway Refund</span>
              </h3>
              <button
                type="button"
                onClick={() => setRetryRefundModal({ open: false, notes: "" })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRetryRefund} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1">
                <strong>Target Payout: {formatCurrency(totalRefundAmount)}</strong>
                <p className="text-[11px] text-rose-800">
                  Prior attempt failed: {latestRefundTx?.failureReason || returnReq.resolutionNotes || "Gateway rejected request"}. Re-initiates gateway transaction safely with active idempotency protection.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Retry Authorization Notes</label>
                <textarea
                  rows={2}
                  value={retryRefundModal.notes}
                  onChange={(e) => setRetryRefundModal((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Retry notes for gateway audit trail..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRetryRefundModal({ open: false, notes: "" })}
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
                  <span>Initiate Safe Retry</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center">
            <Image
              src={previewImage}
              alt="Enlarged Evidence Photo"
              width={1000}
              height={1000}
              className="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 size-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
