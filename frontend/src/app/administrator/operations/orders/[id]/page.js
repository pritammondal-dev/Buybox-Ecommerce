"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  Store,
  CreditCard,
  User,
  ExternalLink,
  Ban,
  RefreshCw,
  Printer,
  Calendar,
  ShieldCheck,
  Tag,
  Receipt,
  Check,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { adminOrderService } from "@/services/admin/order.service";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";
import AdminExceptionResolutionModal from "@/components/fulfillment/AdminExceptionResolutionModal";
import AdminOrderStatusControl from "@/components/admin/orders/AdminOrderStatusControl";
import OrderTimeline from "@/components/admin/orders/OrderTimeline";
import AdminShipmentStatusModal from "@/components/admin/orders/AdminShipmentStatusModal";

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [orderExceptions, setOrderExceptions] = useState([]);
  const [selectedExceptionId, setSelectedExceptionId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Packing Slip State
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);

  // Shipment Status Management State
  const [statusModalShipment, setStatusModalShipment] = useState(null);

  // Superadmin Controlled Fulfillment Override State (Phase VD-05 & VD-06D)
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideVendorId, setOverrideVendorId] = useState("");
  const [overrideAction, setOverrideAction] = useState("assign_courier");
  const [overridePartnerId, setOverridePartnerId] = useState("delhivery");
  const [overridePartnerName, setOverridePartnerName] = useState("Delhivery Express & Surface");
  const [overrideAcceptanceStatus, setOverrideAcceptanceStatus] = useState("accepted");
  const [overrideDeliveryDate, setOverrideDeliveryDate] = useState("");
  const [overrideAuditReason, setOverrideAuditReason] = useState("");
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  const handleControlledOverride = async (e) => {
    e.preventDefault();
    if (!orderId) return;
    if (!overrideAuditReason.trim() || overrideAuditReason.trim().length < 5) {
      toast.error("Mandatory audit reason (minimum 5 characters) is required.");
      return;
    }

    setIsSubmittingOverride(true);
    try {
      const payload = {
        action: overrideAction === "force_confirm_fulfillment" ? "force_confirm" : overrideAction,
        vendorId: overrideVendorId || undefined,
        overrideReason: overrideAuditReason.trim(),
        auditReason: overrideAuditReason.trim(),
      };

      if (overrideAction === "resolve_rejection") {
        payload.acceptanceStatus = overrideAcceptanceStatus;
      } else if (overrideAction === "update_delivery_date") {
        if (!overrideDeliveryDate) {
          toast.error("Please select a valid future expected delivery date.");
          setIsSubmittingOverride(false);
          return;
        }
        payload.expectedDeliveryDate = new Date(overrideDeliveryDate).toISOString();
      } else if (overrideAction === "assign_courier") {
        if (!overridePartnerId) {
          toast.error("Please select a valid courier partner.");
          setIsSubmittingOverride(false);
          return;
        }
        payload.partnerId = overridePartnerId;
        payload.partnerName = overridePartnerName;
        if (overrideDeliveryDate) {
          payload.expectedDeliveryDate = new Date(overrideDeliveryDate).toISOString();
        }
      }

      await adminOrderService.overrideFulfillment(orderId, payload);
      toast.success("Fulfillment override applied and recorded in audit log.");
      setShowOverrideModal(false);
      setOverrideAuditReason("");
      fetchOrder();
    } catch (err) {
      toast.error("Override failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const fetchExceptions = () => {
    if (!orderId) return;
    adminOrderService
      .getFulfillmentExceptions({ orderId })
      .then((res) => {
        const list = res?.exceptions || res?.data?.exceptions || res?.data || [];
        setOrderExceptions(Array.isArray(list) ? list : []);
      })
      .catch(() => setOrderExceptions([]));
  };

  const fetchOrder = () => {
    if (!orderId) return;
    setIsLoading(true);
    fetchExceptions();
    adminOrderService
      .getOrderById(orderId)
      .then((res) => {
        const data = res?.data || res;
        setOrder(data);
      })
      .catch((err) => {
        toast.error("Failed to load order dossier", {
          description: err.response?.data?.message || err.message,
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    if (!orderId) return;
    setIsCancelling(true);
    try {
      await adminOrderService.cancelOrder(
        orderId,
        cancelReason.trim() || "Administratively cancelled by staff"
      );
      toast.success("Order cancelled successfully", {
        description: "Inventory has been released and cancellation recorded.",
      });
      setShowCancelModal(false);
      setCancelReason("");
      fetchOrder();
    } catch (err) {
      toast.error("Failed to cancel order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-44 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The requested platform order does not exist or has been removed.
        </p>
        <Link
          href="/administrator/operations/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    );
  }

  const customer = order.customerId || {};
  const address = order.shippingAddress || {};
  const items = order.items || [];
  const shipments = order.shipments || [];
  const payment = order.paymentDetails || order.payment || {};
  const delivery = order.estimatedDelivery || {};
  const financial = order.financialBreakdown || {};
  const isCancellable = order.status !== "cancelled" && order.status !== "delivered";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Link
            href="/administrator/operations/orders"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to All Orders</span>
          </Link>
          <button
            onClick={fetchOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order #{order.orderNumber || order.secureId}
              </h2>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  order.status === "cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : order.status === "delivered"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {order.status}
              </span>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  order.paymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Payment: {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Placed on{" "}
              {order.placedAt || order.createdAt
                ? new Date(order.placedAt || order.createdAt).toLocaleString("en-IN")
                : "N/A"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setSelectedShipmentId(null);
                setShowPackingSlip(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Packing Slip</span>
            </button>

            {isCancellable && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                <Ban className="size-3.5" />
                <span>Cancel Order</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {order.cancellationReason && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0 text-rose-600" />
          <span>
            <strong>Cancellation Reason: </strong>
            {order.cancellationReason}
          </span>
        </div>
      )}

      {/* Fulfillment SLA & Vendor Inactivity Triage Banner (Phase VD-06D) */}
      {order.triage && (
        <div
          className={`p-5 rounded-3xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
            order.triage.isOverdue
              ? "bg-rose-50 border-rose-300 text-rose-950"
              : order.triage.stage === "pending_acceptance"
              ? "bg-amber-50 border-amber-300 text-amber-950"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <div className="flex items-start gap-3">
            <Clock
              className={`size-5 shrink-0 mt-0.5 ${
                order.triage.isOverdue
                  ? "text-rose-600"
                  : order.triage.stage === "pending_acceptance"
                  ? "text-amber-600"
                  : "text-slate-500"
              }`}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">
                  Vendor Fulfillment SLA: {order.triage.stage?.replace(/_/g, " ").toUpperCase()}
                </span>
                {order.triage.isOverdue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-200 text-rose-900 border border-rose-300">
                    SLA Breached (+{order.triage.hoursOverdue}h Overdue)
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed">
                Elapsed: <strong>{order.triage.elapsedHours} hours</strong> | Threshold:{" "}
                <strong>{order.triage.slaThresholdHours} hours</strong>. {order.triage.recommendedAction}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOverrideAction("assign_courier");
                setShowOverrideModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Superadmin Override
            </button>
          </div>
        </div>
      )}

      {/* Vendor Rejection Alert Banner (Phase VD-05) */}
      {(order.hasVendorRejection || (order.vendorFulfillments || []).some((vf) => vf.acceptanceStatus === "rejected")) && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-rose-900">
                Vendor Fulfillment Rejection Alert
              </p>
              <p className="text-rose-800">
                One or more marketplace merchants declined fulfillment for their assigned items in this order.
                {order.vendorRejections && order.vendorRejections.length > 0 && (
                  <span className="block mt-1 font-mono text-[11px] bg-rose-100/80 p-2 rounded-xl">
                    {order.vendorRejections.map((r, i) => (
                      <span key={i} className="block">
                        • Vendor ID: {r.vendorId} — Reason: &quot;{r.reason}&quot;
                      </span>
                    ))}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-rose-700">
                <strong>Safety Invariant:</strong> The parent order remains active. Rejection does not auto-cancel the customer order or trigger uncoordinated refunds.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const rejectedVf = (order.vendorFulfillments || []).find((vf) => vf.acceptanceStatus === "rejected");
                setOverrideVendorId(rejectedVf?.vendorId || "");
                setOverrideAction("resolve_rejection");
                setOverrideAcceptanceStatus("accepted");
                setOverrideAuditReason("");
                setShowOverrideModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
            >
              Resolve Vendor Rejection
            </button>
          </div>
        </div>
      )}

      {/* Vendor Fulfillment Exceptions Banner */}
      {orderExceptions.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">
                {orderExceptions.length} Vendor Fulfillment Exception{orderExceptions.length > 1 ? "s" : ""} Reported
              </p>
              <p className="text-[11px] text-amber-700">
                One or more merchants have reported stock discrepancies, damaged goods, or requested cancellation for items in this order.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/administrator/operations/exceptions"
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-2xs"
            >
              View in Queue
            </Link>
          </div>
        </div>
      )}

      {/* 4 Core Summary Cards: Customer, Shipping, Payment, Delivery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Customer Details */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <User className="size-3.5 text-indigo-600" />
              <span>Customer Details</span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900 text-sm">
                {customer.firstName || address.fullName} {customer.lastName || ""}
              </p>
              <p className="text-slate-500 truncate" title={customer.email}>
                {customer.email || "Guest Checkout"}
              </p>
              <p className="font-mono text-[11px] text-slate-600">
                {customer.phone || address.phone || "No phone provided"}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Account Type:</span>
            <span className="font-semibold text-slate-700">
              {customer.email ? "Registered User" : "Guest Customer"}
            </span>
          </div>
        </div>

        {/* 2. Shipping Destination */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <MapPin className="size-3.5 text-emerald-600" />
              <span>Shipping Destination</span>
            </div>
            <div className="text-xs text-slate-700 space-y-0.5">
              <p className="font-bold text-slate-900">{address.fullName || "Customer Recipient"}</p>
              <p className="line-clamp-1">{address.addressLine1}</p>
              {address.addressLine2 && <p className="line-clamp-1 text-slate-500">{address.addressLine2}</p>}
              <p className="font-medium text-slate-800">
                {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}
              </p>
              <p className="text-[11px] text-slate-500">{address.country || "India (IN)"}</p>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Contact Phone:</span>
            <span className="font-mono font-semibold text-slate-700">{address.phone || "N/A"}</span>
          </div>
        </div>

        {/* 3. Customer Payment Details (Requirement A) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <CreditCard className="size-3.5 text-purple-600" />
                <span>Payment Details</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  order.paymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : order.paymentStatus === "refunded"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : order.paymentStatus === "partially_refunded"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : order.paymentStatus === "failed"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {order.paymentStatus || "pending"}
              </span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Method:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {payment.method || "Unrecorded"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Gateway:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {payment.gateway || (order.paymentStatus === "paid" ? "Razorpay" : "N/A")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ref / Txn ID:</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[120px]" title={payment.transactionId}>
                  {payment.transactionId || "Pending Gateway"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-700">
                  ₹{Number(payment.amountPaid || order.amountPaid || (order.paymentStatus === "paid" ? order.grandTotal : 0)).toFixed(2)}
                </span>
              </div>
              {Number(payment.amountDue || 0) > 0 && (
                <div className="flex items-center justify-between text-rose-600">
                  <span>Balance Due:</span>
                  <span className="font-bold">₹{Number(payment.amountDue).toFixed(2)}</span>
                </div>
              )}
              {Number(payment.amountRefunded || order.amountRefunded || 0) > 0 && (
                <div className="flex items-center justify-between text-purple-700">
                  <span>Refunded:</span>
                  <span className="font-bold">-₹{Number(payment.amountRefunded || order.amountRefunded).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
            {payment.capturedAt ? (
              <span>Captured: {new Date(payment.capturedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            ) : (
              <span>Payment status: {order.paymentStatus}</span>
            )}
          </div>
        </div>

        {/* 4. Estimated Delivery & Tracking (Requirement B) */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Calendar className="size-3.5 text-blue-600" />
                <span>Estimated Delivery</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  order.status === "delivered"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : order.status === "cancelled"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
              >
                {order.status === "delivered"
                  ? "Delivered"
                  : order.status === "cancelled"
                  ? "Cancelled"
                  : "On Schedule"}
              </span>
            </div>
            <div className="text-xs text-slate-700 space-y-1">
              <div>
                <span className="text-[11px] text-slate-500 block">Delivery Window:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {delivery.estimatedDateRange || "Estimated delivery unavailable"}
                </p>
              </div>
              <div className="text-slate-600 text-[11px] pt-1">
                <span>Option: </span>
                <strong className="text-slate-800">
                  {order.deliveryOption?.name || "Standard Delivery"}
                </strong>
                {order.deliveryOption?.estimatedDays && (
                  <span className="text-slate-500"> ({order.deliveryOption.estimatedDays})</span>
                )}
              </div>
              {delivery.actualDeliveredAt && (
                <div className="pt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  <span>
                    Delivered on: {new Date(delivery.actualDeliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Fulfillment:</span>
            <span className="capitalize font-semibold text-slate-600">{order.fulfillmentStatus || "unfulfilled"}</span>
          </div>
        </div>
      </div>

      {/* Complete Financial Breakdown Section (Requirement C) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-emerald-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Complete Financial Breakdown &amp; Ledger Audit
              </h3>
              <p className="text-xs text-slate-500">
                Itemized pricing breakdown, tax snapshot, promo deductions, and authoritative payment reconciliation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {financial.reconciliationStatus === "reconciled" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="size-3" />
                <span>Reconciled (Delta ₹0.00)</span>
              </span>
            ) : financial.reconciliationStatus === "mismatch" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="size-3" />
                <span>Mismatch (Delta ₹{financial.reconciliationDelta})</span>
              </span>
            ) : financial.reconciliationStatus === "insufficient_data" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="size-3" />
                <span>Insufficient Historical Data</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="size-3" />
                <span>Snapshot Reconciled</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
          {/* Left Column: Line-Item & Promotion Calculations */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Tag className="size-3.5 text-indigo-600" />
              <span>Price Structure &amp; Deductions</span>
            </h4>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between items-center py-1">
                <span>Item Subtotal (Gross):</span>
                <span className="font-bold text-slate-800 font-mono text-sm">
                  ₹{Number(financial.subtotal || order.subtotal || 0).toFixed(2)}
                </span>
              </div>

              {/* Coupon Code & Discount */}
              <div className="flex justify-between items-center py-1">
                <div className="flex items-center gap-1.5">
                  <span>Coupon Code:</span>
                  {financial.couponCode || order.couponCode ? (
                    <span className="inline-flex px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {financial.couponCode || order.couponCode}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">None Applied</span>
                  )}
                </div>
                <span className={Number(financial.couponDiscount || order.couponDiscount || 0) > 0 ? "font-bold text-rose-600 font-mono" : "text-slate-400 font-mono"}>
                  {Number(financial.couponDiscount || order.couponDiscount || 0) > 0
                    ? `-₹${Number(financial.couponDiscount || order.couponDiscount).toFixed(2)}`
                    : "₹0.00"}
                </span>
              </div>

              {/* Product-Level Discounts */}
              <div className="flex justify-between items-center py-1">
                <span>Product-Level Discounts:</span>
                <span className={Number(financial.productDiscounts || 0) > 0 ? "font-bold text-rose-600 font-mono" : "text-slate-400 font-mono"}>
                  {Number(financial.productDiscounts || 0) > 0
                    ? `-₹${Number(financial.productDiscounts).toFixed(2)}`
                    : "₹0.00"}
                </span>
              </div>

              {/* Delivery / Shipping Charges */}
              <div className="flex justify-between items-center py-1">
                <div>
                  <span>Shipping &amp; Delivery:</span>
                  <span className="text-[10px] text-slate-400 block">
                    {order.deliveryOption?.name || "Standard Delivery"}
                  </span>
                </div>
                <span className="font-mono text-slate-800">
                  {Number(financial.shippingTotal || order.shippingTotal || 0) > 0
                    ? `₹${Number(financial.shippingTotal || order.shippingTotal).toFixed(2)}`
                    : "₹0.00 (Free)"}
                </span>
              </div>

              {/* Packaging & Handling Fees */}
              <div className="flex justify-between items-center py-1">
                <span>Packaging &amp; Handling:</span>
                <span className="text-slate-400 font-mono">₹0.00 (Not charged)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Tax Details & Final Settlement */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-emerald-700" />
              <span>Tax Breakdown &amp; Grand Total</span>
            </h4>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between items-center py-1">
                <span>Taxable Base Amount:</span>
                <span className="font-mono text-slate-800">
                  ₹{Number(financial.taxableBase || 0) > 0
                    ? Number(financial.taxableBase).toFixed(2)
                    : Number(financial.subtotal || order.subtotal || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <div>
                  <span>Tax Calculation Mode:</span>
                  <span className="text-[10px] text-slate-400 block capitalize">
                    {(financial.pricingMode || order.pricingMode || "tax_exclusive").replace("_", " ")}
                  </span>
                </div>
                <span className="font-mono font-semibold text-slate-800">
                  ₹{Number(financial.taxTotal || order.taxTotal || 0).toFixed(2)}
                </span>
              </div>

              {/* Grand Total Callout */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 mt-2">
                <div className="flex justify-between items-center text-emerald-950 font-black text-base">
                  <span>Final Order Total (INR):</span>
                  <span className="text-emerald-700 text-lg">
                    ₹{Number(financial.grandTotal || order.grandTotal || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-emerald-800 pt-1 mt-1 border-t border-emerald-100">
                  <span>Authoritative Amount Paid:</span>
                  <span className="font-bold">
                    ₹{Number(payment.amountPaid || order.amountPaid || (order.paymentStatus === "paid" ? order.grandTotal : 0)).toFixed(2)}
                  </span>
                </div>
                {Number(payment.amountDue || 0) > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-rose-700 pt-0.5">
                    <span>Outstanding Balance Due:</span>
                    <span className="font-bold">₹{Number(payment.amountDue).toFixed(2)}</span>
                  </div>
                )}
                {Number(payment.amountRefunded || order.amountRefunded || 0) > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-purple-700 pt-0.5">
                    <span>Amount Refunded to Customer:</span>
                    <span className="font-bold">-₹{Number(payment.amountRefunded || order.amountRefunded).toFixed(2)}</span>
                  </div>
                )}
                {financial.reconciliationStatus === "mismatch" && (
                  <div className="flex justify-between items-center text-[11px] text-rose-700 pt-1 mt-1 border-t border-rose-200 font-bold">
                    <span>Reconciliation Variance:</span>
                    <span>Calculated ₹{financial.calculatedGrandTotal} (Delta: ₹{financial.reconciliationDelta})</span>
                  </div>
                )}
                {financial.paymentSettlementStatus && (
                  <div className="flex justify-between items-center text-[10px] text-emerald-900 pt-1 mt-1 border-t border-emerald-200/60 uppercase font-semibold">
                    <span>Payment Settlement State:</span>
                    <span className="font-mono">{financial.paymentSettlementStatus.replace("_", " ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Vendor Fulfillment Packages (Phase VD-05) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Store className="size-4 text-emerald-700" />
              <span>Multi-Vendor Fulfillment Packages ({order.vendorFulfillments?.length || 1})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative vendor acceptance state, assigned courier partners, and expected delivery dates
            </p>
          </div>
          <span className="font-mono text-[11px] px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 font-semibold">
            Fulfillment Version: v{order.fulfillmentVersion || 1}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(order.vendorFulfillments && order.vendorFulfillments.length > 0
            ? order.vendorFulfillments
            : [{ vendorId: "Primary Vendor", acceptanceStatus: "accepted", isFulfillmentConfirmed: true }]
          ).map((pkg, pIdx) => {
            const partner = pkg.assignedShipmentPartner;
            const dDate = pkg.expectedDeliveryDate;

            return (
              <div
                key={pIdx}
                className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  pkg.acceptanceStatus === "rejected"
                    ? "bg-rose-50/60 border-rose-200"
                    : pkg.isFulfillmentConfirmed
                    ? "bg-emerald-50/40 border-emerald-200"
                    : "bg-slate-50/70 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Store className="size-3.5 text-slate-600" />
                    <span className="font-mono">{pkg.vendorName || pkg.vendorId || `Vendor #${pIdx + 1}`}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      pkg.acceptanceStatus === "accepted"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : pkg.acceptanceStatus === "rejected"
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {pkg.acceptanceStatus || "pending"}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned Courier:</span>
                    <span className="font-semibold text-slate-800">
                      {partner?.partnerName || partner?.partnerId || "Not assigned"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Expected Delivery:</span>
                    <span className="font-semibold text-slate-800">
                      {dDate
                        ? new Date(dDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Pending vendor confirmation"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Confirmation Guard:</span>
                    <span className="font-semibold">
                      {pkg.isFulfillmentConfirmed ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1">
                          <Clock className="size-3" /> Unconfirmed
                        </span>
                      )}
                    </span>
                  </div>
                  {pkg.rejectionReason && (
                    <div className="p-2 rounded-xl bg-rose-100/70 text-rose-800 text-[11px] space-y-0.5">
                      <span className="font-bold">Rejection Reason:</span>
                      <p>{pkg.rejectionReason}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideVendorId(pkg.vendorId || "");
                      setOverrideAction(pkg.acceptanceStatus === "rejected" ? "resolve_rejection" : "update_delivery_date");
                      setOverrideAcceptanceStatus("accepted");
                      if (dDate) {
                        const d = new Date(dDate);
                        if (!isNaN(d.getTime())) setOverrideDeliveryDate(d.toISOString().slice(0, 10));
                      } else {
                        const d = new Date();
                        d.setDate(d.getDate() + 3);
                        setOverrideDeliveryDate(d.toISOString().slice(0, 10));
                      }
                      setOverrideAuditReason("");
                      setShowOverrideModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Override / Reassign</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Superadmin Order Lifecycle & Status Control */}
      <AdminOrderStatusControl order={order} onStatusUpdated={() => fetchOrder()} />

      {/* Multi-Vendor Dispatches & Shipments */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Truck className="size-4 text-emerald-700" />
            <span>Courier Shipments ({shipments.length})</span>
          </h3>

          <div className="space-y-3">
            {shipments.map((shp) => (
              <div
                key={shp._id || shp.secureId}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      {shp.shipmentNumber}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        shp.status === "delivered"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : shp.status === "in_transit" || shp.status === "out_for_delivery"
                          ? "bg-blue-50 text-blue-800 border-blue-200"
                          : shp.status === "cancelled" || shp.status === "failed"
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {shp.status?.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-slate-600">
                      Carrier: <strong>{shp.carrier || "Courier"}</strong>
                    </span>
                    {shp.warehouseId?.name && (
                      <span className="text-slate-400">
                        • WH: <strong className="text-slate-600">{shp.warehouseId.name}</strong>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-slate-500 font-mono">
                    {shp.trackingNumber ? (
                      <div>
                        AWB: <strong className="text-slate-700">{shp.trackingNumber}</strong>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">AWB Pending</div>
                    )}
                    {shp.createdAt && (
                      <div>
                        Created: {new Date(shp.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusModalShipment(shp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Truck className="size-3.5" />
                    <span>Manage Status</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedShipmentId(shp._id || shp.secureId || shp.id);
                      setShowPackingSlip(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Printer className="size-3" />
                    <span>Packing Slip</span>
                  </button>

                  {shp.trackingUrl && (
                    <a
                      href={shp.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <span>Courier Tracking</span>
                      <ExternalLink className="size-3 text-slate-400" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authoritative Order Items Table with Complete Pricing Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Order Items &amp; Pricing Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Authoritative historical pricing snapshots, variant configurations, and fulfilling merchant details
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-600">
            {items.length} Line Item{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">Product &amp; Variant</th>
                <th className="px-5 py-3.5">Fulfilling Merchant</th>
                <th className="px-5 py-3.5 text-center">Fulfillment</th>
                <th className="px-5 py-3.5 text-center">Qty</th>
                <th className="px-5 py-3.5 text-right">Unit Price (Historical)</th>
                <th className="px-5 py-3.5 text-right">Item Subtotal</th>
                <th className="px-5 py-3.5 text-right">Discount / Tax</th>
                <th className="px-5 py-3.5 text-right">Final Line Total</th>
                <th className="px-5 py-3.5 text-right">Exception</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const itemException = orderExceptions.find((exc) => {
                  const idMatches = exc.orderItemId && String(exc.orderItemId) === String(item._id || item.id);
                  const skuMatches = exc.itemSnapshot?.sku && exc.itemSnapshot.sku === item.sku;
                  return idMatches || skuMatches;
                });

                const hasUnitPrice = item.unitPrice !== null && item.unitPrice !== undefined && !isNaN(Number(item.unitPrice));
                const hasLineTotal = item.lineTotal !== null && item.lineTotal !== undefined && !isNaN(Number(item.lineTotal));
                const itemSubtotal = hasUnitPrice ? (Number(item.unitPrice) * (item.quantity || 1)).toFixed(2) : null;
                const hasDiscount = item.discountTotal && Number(item.discountTotal) > 0;
                const hasTax = item.taxTotal && Number(item.taxTotal) > 0;

                const displayName = item.productName || item.productId?.title || item.productId?.name || "Product";
                const variantInfo = item.variantName || item.productVariantId?.name;

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    {/* Product & Variant */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={displayName}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Package className="size-5 text-slate-400" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900 leading-snug">
                            {displayName}
                          </div>
                          {variantInfo && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mr-1.5">
                              {variantInfo}
                            </span>
                          )}
                          <div className="font-mono text-[10px] text-slate-400">
                            SKU: {item.sku || "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Merchant Attribution */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Store className="size-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate max-w-[140px]">
                          {item.vendor?.name ||
                            item.vendorId?.storeName ||
                            item.vendorId?.businessName ||
                            "Marketplace"}
                        </span>
                      </div>
                      {item.warehouse && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          WH: {item.warehouse.name || item.warehouse.code}
                        </div>
                      )}
                    </td>

                    {/* Fulfillment Status */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        item.fulfillmentStatus === "delivered"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : item.fulfillmentStatus === "shipped"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : item.fulfillmentStatus === "cancelled"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        {item.fulfillmentStatus || "unfulfilled"}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-5 py-4 text-center font-bold text-slate-900">
                      {item.quantity}
                    </td>

                    {/* Unit Price (Historical snapshot) */}
                    <td className="px-5 py-4 text-right">
                      {hasUnitPrice ? (
                        <div>
                          <span className="font-semibold text-slate-900">
                            ₹{Number(item.unitPrice).toFixed(2)}
                          </span>
                          <span className="block text-[9px] text-slate-400 uppercase tracking-tight">
                            historical
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Price Missing
                        </span>
                      )}
                    </td>

                    {/* Item Subtotal */}
                    <td className="px-5 py-4 text-right font-medium text-slate-700">
                      {itemSubtotal !== null ? (
                        `₹${itemSubtotal}`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Item-Level Discount & Tax */}
                    <td className="px-5 py-4 text-right space-y-0.5">
                      {hasDiscount && (
                        <div className="text-[11px] text-rose-600 font-semibold">
                          -₹{Number(item.discountTotal).toFixed(2)}
                        </div>
                      )}
                      {hasTax && (
                        <div className="text-[10px] text-slate-500 font-medium">
                          +₹{Number(item.taxTotal).toFixed(2)} tax
                        </div>
                      )}
                      {!hasDiscount && !hasTax && (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="px-5 py-4 text-right">
                      {hasLineTotal ? (
                        <div className="font-black text-slate-900 text-sm">
                          ₹{Number(item.lineTotal).toFixed(2)}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Unrecorded
                        </span>
                      )}
                    </td>

                    {/* Exception Queue Link */}
                    <td className="px-5 py-4 text-right">
                      {itemException ? (
                        <button
                          type="button"
                          onClick={() => setSelectedExceptionId(itemException._id || itemException.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                            itemException.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : itemException.status === "awaiting_vendor"
                              ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                              : itemException.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          }`}
                        >
                          <AlertTriangle className="size-3" />
                          <span className="capitalize">{itemException.status.replace("_", " ")}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Status History & Audit Trail */}
      <OrderTimeline
        timeline={order.timeline}
        createdAt={order.createdAt}
        placedAt={order.placedAt}
      />

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="size-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Ban className="size-5" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-bold text-slate-900">Cancel Platform Order</h2>
              <p className="text-xs text-slate-500">
                Are you sure you want to administratively cancel Order #{order.orderNumber || order.secureId}? Any reserved stock will be automatically released back to warehouses.
              </p>
            </div>

            <form onSubmit={handleCancelOrder} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows="3"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer requested cancellation, suspect fraud, or merchant stock outage..."
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={isCancelling}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warehouse Packing Slip Modal */}
      <PackingSlipModal
        isOpen={showPackingSlip}
        onClose={() => {
          setShowPackingSlip(false);
          setSelectedShipmentId(null);
        }}
        orderId={orderId}
        shipmentId={selectedShipmentId}
        fetchPackingSlipFn={async ({ orderId: oId, shipmentId: sId }) => {
          if (sId) {
            const { adminOperationsService } = await import("@/services/admin/admin.service.js");
            return adminOperationsService.getShipmentPackingSlip(sId);
          }
          return adminOrderService.getPackingSlip(oId);
        }}
      />

      {/* Admin Exception Resolution Modal */}
      {selectedExceptionId && (
        <AdminExceptionResolutionModal
          isOpen={Boolean(selectedExceptionId)}
          onClose={() => setSelectedExceptionId(null)}
          exceptionId={selectedExceptionId}
          onUpdate={async () => {
            fetchOrder();
          }}
        />
      )}

      {/* Admin Shipment Status Management Modal */}
      {statusModalShipment && (
        <AdminShipmentStatusModal
          isOpen={Boolean(statusModalShipment)}
          onClose={() => setStatusModalShipment(null)}
          shipment={statusModalShipment}
          onUpdated={async () => {
            fetchOrder();
          }}
        />
      )}

      {/* Superadmin Controlled Fulfillment Override Modal (Phase VD-05) */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700">
                <ShieldCheck className="size-5" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Superadmin Controlled Fulfillment Override
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleControlledOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target Vendor / Package
                </label>
                <select
                  value={overrideVendorId}
                  onChange={(e) => setOverrideVendorId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                >
                  <option value="">All Scoped Vendors / First Package</option>
                  {(order.vendorFulfillments || []).map((vf, i) => (
                    <option key={i} value={vf.vendorId}>
                      {vf.vendorName || vf.vendorId} (Status: {vf.acceptanceStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Override Action Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={overrideAction}
                  onChange={(e) => setOverrideAction(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                >
                  <option value="assign_courier">Assign / Change Courier Partner</option>
                  <option value="resolve_rejection">Resolve Vendor Rejection</option>
                  <option value="update_delivery_date">Update Expected Delivery Date</option>
                  <option value="force_confirm_fulfillment">Force Confirm Fulfillment</option>
                </select>
              </div>

              {overrideAction === "assign_courier" && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Courier Partner <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={overridePartnerId}
                      onChange={(e) => {
                        setOverridePartnerId(e.target.value);
                        const partners = {
                          delhivery: "Delhivery Express & Surface",
                          shiprocket: "Shiprocket Fulfillment",
                          bluedart: "Blue Dart Express",
                          dtdc: "DTDC Express",
                          indiapost: "India Post Speed Post",
                          custom: "Custom Merchant Fleet",
                        };
                        setOverridePartnerName(partners[e.target.value] || e.target.value);
                      }}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    >
                      <option value="delhivery">Delhivery Express &amp; Surface</option>
                      <option value="shiprocket">Shiprocket Fulfillment</option>
                      <option value="bluedart">Blue Dart Express</option>
                      <option value="dtdc">DTDC Express</option>
                      <option value="indiapost">India Post Speed Post</option>
                      <option value="custom">Custom Merchant Fleet</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Expected Delivery Date (Optional)
                    </label>
                    <input
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={overrideDeliveryDate}
                      onChange={(e) => setOverrideDeliveryDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {overrideAction === "resolve_rejection" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Acceptance State
                  </label>
                  <select
                    value={overrideAcceptanceStatus}
                    onChange={(e) => setOverrideAcceptanceStatus(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                  >
                    <option value="accepted">Accepted (Re-instate / Assign to Merchant)</option>
                    <option value="pending">Pending (Reset for Merchant Review)</option>
                  </select>
                </div>
              )}

              {overrideAction === "update_delivery_date" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Expected Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={overrideDeliveryDate}
                    onChange={(e) => setOverrideDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideAuditReason}
                  onChange={(e) => setOverrideAuditReason(e.target.value)}
                  placeholder="Explain operational rationale (logged permanently to order timeline)..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-hidden resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Minimum 5 characters required for audit trail.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride || overrideAuditReason.trim().length < 5}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingOverride && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Apply Controlled Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
