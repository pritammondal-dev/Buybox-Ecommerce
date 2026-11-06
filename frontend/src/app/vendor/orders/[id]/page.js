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
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
  X,
  Printer,
  FileText,
  Calendar,
  AlertCircle,
  Check,
  XCircle,
  Info,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";
import ReportExceptionModal from "@/components/fulfillment/ReportExceptionModal";
import ExceptionDetailModal from "@/components/fulfillment/ExceptionDetailModal";

export default function VendorOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [shipmentPartners, setShipmentPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [packingSlipTarget, setPackingSlipTarget] = useState(null);
  const [reportingItem, setReportingItem] = useState(null);
  const [viewingException, setViewingException] = useState(null);

  // Phase VD-05: Fulfillment Partner & Delivery Date State
  const [selectedPartnerId, setSelectedPartnerId] = useState("delhivery");
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Rejection Modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Shipment Creation Modal
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shipmentIdempotencyKey, setShipmentIdempotencyKey] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [shipmentForm, setShipmentForm] = useState({
    carrier: "Delhivery",
    warehouseId: "",
    serviceLevel: "Standard Surface",
    trackingNumber: "",
    trackingUrl: "",
    notes: "",
  });

  const loadExceptions = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await vendorService.getMyFulfillmentExceptions({ orderId });
      const list = res?.exceptions || res?.data?.exceptions || res?.data || [];
      setExceptions(Array.isArray(list) ? list : []);
    } catch {
      setExceptions([]);
    }
  }, [orderId]);

  const loadOrder = React.useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await vendorService.getMyOrderById(orderId);
      const data = res?.data?.data || res?.data?.order || res?.data;
      setOrder(data);

      // Synchronize partner and delivery date from order state
      const vf = data?.vendorFulfillment || {};
      const partner = vf?.assignedShipmentPartner || data?.items?.[0]?.assignedShipmentPartner;
      if (partner?.partnerId) {
        setSelectedPartnerId(partner.partnerId);
      }

      const rawDate = vf?.expectedDeliveryDate || data?.items?.[0]?.expectedDeliveryDate;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          setSelectedDeliveryDate(d.toISOString().slice(0, 10));
        }
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        setSelectedDeliveryDate(d.toISOString().slice(0, 10));
      }

      await loadExceptions();
    } catch (err) {
      toast.error("Failed to load order details", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, loadExceptions]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!orderId) return;
      try {
        const [orderRes, whRes, excRes, partnersRes] = await Promise.allSettled([
          vendorService.getMyOrderById(orderId),
          vendorService.getMyWarehouses(),
          vendorService.getMyFulfillmentExceptions({ orderId }),
          vendorService.getShipmentPartners(),
        ]);
        if (!isMounted) return;

        if (partnersRes.status === "fulfilled") {
          const partners = partnersRes.value?.data || partnersRes.value || [];
          if (Array.isArray(partners) && partners.length > 0) {
            setShipmentPartners(partners);
          }
        }

        if (orderRes.status === "fulfilled") {
          const data = orderRes.value?.data?.data || orderRes.value?.data?.order || orderRes.value?.data;
          setOrder(data);

          const vf = data?.vendorFulfillment || {};
          const partner = vf?.assignedShipmentPartner || data?.items?.[0]?.assignedShipmentPartner;
          if (partner?.partnerId) {
            setSelectedPartnerId(partner.partnerId);
          }

          const rawDate = vf?.expectedDeliveryDate || data?.items?.[0]?.expectedDeliveryDate;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              setSelectedDeliveryDate(d.toISOString().slice(0, 10));
            }
          } else {
            const d = new Date();
            d.setDate(d.getDate() + 3);
            setSelectedDeliveryDate(d.toISOString().slice(0, 10));
          }
        }
        if (whRes.status === "fulfilled") {
          const list = whRes.value?.data?.data || whRes.value?.data?.warehouses || whRes.value?.data || [];
          const whArray = Array.isArray(list) ? list : [];
          setWarehouses(whArray);
          if (whArray.length > 0) {
            setShipmentForm((prev) => (prev.warehouseId ? prev : { ...prev, warehouseId: whArray[0]._id || whArray[0].id }));
          }
        }
        if (excRes.status === "fulfilled") {
          const list = excRes.value?.exceptions || excRes.value?.data?.exceptions || excRes.value?.data || [];
          setExceptions(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        toast.error("Failed to load order details", {
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
  }, [orderId]);

  // Phase VD-05: Vendor Acceptance Handlers
  const handleAcceptOrder = async () => {
    try {
      setIsAccepting(true);
      await vendorService.acceptOrder(order.secureId || order._id);
      toast.success("Order accepted successfully! You can now configure shipment partner and delivery date.");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to accept order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectOrder = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
      toast.error("A valid rejection reason (minimum 5 characters) is required.");
      return;
    }

    try {
      setIsRejecting(true);
      await vendorService.rejectOrder(order.secureId || order._id, {
        rejectionReason: rejectionReason.trim(),
      });
      toast.warning("Order items rejected. The Superadmin operations team has been notified in their review queue.");
      setShowRejectModal(false);
      setRejectionReason("");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to reject order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSaveFulfillmentDetails = async (e) => {
    e.preventDefault();
    if (!selectedPartnerId) {
      toast.error("Please select a shipment partner.");
      return;
    }
    if (!selectedDeliveryDate) {
      toast.error("Please specify an expected delivery date.");
      return;
    }

    try {
      setIsSavingDetails(true);
      const partnerObj = shipmentPartners.find((p) => p.id === selectedPartnerId);
      await vendorService.updateFulfillmentDetails(order.secureId || order._id, {
        partnerId: selectedPartnerId,
        partnerName: partnerObj?.name || selectedPartnerId,
        expectedDeliveryDate: new Date(selectedDeliveryDate).toISOString(),
      });
      toast.success("Shipment partner and expected delivery date updated.");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to update fulfillment details", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleConfirmFulfillment = async () => {
    try {
      setIsConfirming(true);
      await vendorService.confirmFulfillment(order.secureId || order._id, {
        notes: fulfillmentNotes.trim() || undefined,
      });
      toast.success("Fulfillment confirmed! Order status transitioned to processing.");
      await loadOrder();
    } catch (err) {
      toast.error("Fulfillment confirmation blocked", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleProcessOrder = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.processOrder(order.secureId || order._id);
      toast.success("Order accepted and marked as processing");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to process order", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenShipmentModal = () => {
    if (!shipmentIdempotencyKey) {
      setShipmentIdempotencyKey(`idemp-shp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    }
    const partnerName = assignedPartner?.partnerName || assignedPartner?.partnerId || "Delhivery";
    setShipmentForm((prev) => ({
      ...prev,
      carrier: prev.carrier || partnerName,
    }));
    setShowShipmentModal(true);
  };

  const handleReadyToShip = async () => {
    try {
      setIsProcessingAction(true);
      await vendorService.markOrderReadyToShip(order.secureId || order._id);
      toast.success("Items marked ready for shipment. You can now generate the courier shipment.");
      await loadOrder();
    } catch (err) {
      toast.error("Failed to mark order ready to ship", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCreateShipment = async (e) => {
    e.preventDefault();
    if (!shipmentForm.carrier.trim()) {
      toast.error("Carrier name is required");
      return;
    }

    try {
      setIsProcessingAction(true);
      const key = shipmentIdempotencyKey || `idemp-shp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      if (!shipmentIdempotencyKey) {
        setShipmentIdempotencyKey(key);
      }

      const payload = {
        carrier: shipmentForm.carrier.trim(),
        warehouseId: shipmentForm.warehouseId || undefined,
        serviceLevel: shipmentForm.serviceLevel || undefined,
        trackingNumber: shipmentForm.trackingNumber.trim() || undefined,
        trackingUrl: shipmentForm.trackingUrl.trim() || undefined,
        notes: shipmentForm.notes.trim() || undefined,
        idempotencyKey: key,
      };

      const res = await vendorService.createOrderShipment(order.secureId || order._id, payload, key);
      const createdShipment = res?.data?.data || res?.data;

      if (createdShipment?.bookingDetails?.status === "failed" || createdShipment?.status === "booking_failed") {
        toast.warning("Shipment created locally, but courier booking failed", {
          description: createdShipment.bookingDetails?.errorMessage || "You can retry carrier booking below.",
        });
      } else if (createdShipment?.bookingDetails?.status === "not_configured") {
        toast.info("Shipment created locally", {
          description: "Courier API credentials not configured. Manual fulfillment required.",
        });
      } else {
        toast.success("Courier shipment generated successfully");
      }

      setShowShipmentModal(false);
      setShipmentIdempotencyKey(null);
      await loadOrder();
    } catch (err) {
      toast.error("Failed to generate shipment", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRetryBooking = async (shpId) => {
    try {
      setIsProcessingAction(true);
      const res = await vendorService.retryShipmentBooking(shpId);
      const updated = res?.data?.data || res?.data;
      if (updated?.status === "booked") {
        toast.success(`Courier booked! AWB: ${updated.awbNumber}`);
      } else if (updated?.bookingDetails?.status === "not_configured") {
        toast.info("Courier API not configured in environment.");
      } else {
        toast.error(`Booking retry failed: ${updated?.bookingDetails?.errorMessage || "Unknown error"}`);
      }
      await loadOrder();
    } catch (err) {
      toast.error("Courier booking retry failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-200 rounded-3xl animate-pulse" />
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
          This order does not exist or contains no items belonging to your vendor account.
        </p>
        <Link
          href="/vendor/orders"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Orders</span>
        </Link>
      </div>
    );
  }

  const address = order.shippingAddress || {};
  const items = order.items || [];
  const shipments = order.shipments || [];

  // Phase VD-05: Authoritative Per-Vendor Fulfillment State
  const vf = order.vendorFulfillment || {};
  const acceptanceStatus = vf.acceptanceStatus || items[0]?.vendorAcceptance?.status || "pending";
  const isConfirmed = Boolean(vf.isFulfillmentConfirmed || items[0]?.isFulfillmentConfirmed);
  const assignedPartner = vf.assignedShipmentPartner || items[0]?.assignedShipmentPartner || null;
  const expectedDeliveryDate = vf.expectedDeliveryDate || items[0]?.expectedDeliveryDate || null;
  const isPaidOrCod = order.paymentStatus === "paid" || order.paymentStatus === "pending_cod" || order.paymentStatus === "captured";

  // Central Confirmation Guard Checklist Status
  const prereqAcceptance = acceptanceStatus === "accepted";
  const prereqPartner = Boolean(assignedPartner?.partnerId);
  const prereqDate = Boolean(expectedDeliveryDate);
  const prereqPayment = isPaidOrCod;
  const prereqNotCancelled = order.status !== "cancelled" && acceptanceStatus !== "rejected";
  const allPrerequisitesMet = prereqAcceptance && prereqPartner && prereqDate && prereqPayment && prereqNotCancelled;

  const hasProcessingItems = items.some((it) => it.fulfillmentStatus === "processing");
  const canShip = items.some((it) => ["processing", "ready_to_ship"].includes(it.fulfillmentStatus)) && order.paymentStatus === "paid";

  // Date constraints (Today to +60 days)
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 pb-20">
      {/* Top Bar */}
      <div>
        <Link
          href="/vendor/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Orders</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Order {order.orderNumber || order.secureId}
              </h2>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {order.status}
              </span>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  order.paymentStatus === "paid"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Payment: {order.paymentStatus}
              </span>

              {/* Acceptance Badge */}
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  acceptanceStatus === "accepted"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : acceptanceStatus === "rejected"
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                Vendor Acceptance: {acceptanceStatus}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "N/A"}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {hasProcessingItems && (
              <button
                type="button"
                onClick={handleReadyToShip}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isProcessingAction ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                <span>Mark Ready to Ship</span>
              </button>
            )}

            {canShip && (
              <button
                type="button"
                onClick={handleOpenShipmentModal}
                disabled={isProcessingAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Truck className="size-3.5" />
                <span>Create Shipment</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setPackingSlipTarget({ type: "order", id: order.secureId || order._id })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Packing Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* PHASE VD-05: VENDOR ACCEPTANCE & REJECTION BANNER */}
      {acceptanceStatus === "pending" && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Action Required: Review and Accept Order Fulfillment
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Please verify warehouse stock and accept items assigned to your store, or decline fulfillment if you cannot supply them.
              </p>
              <p className="text-[11px] text-amber-700 mt-1 italic">
                * Rejection flags the Superadmin review queue for resolution without cancelling the customer&apos;s parent order.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleAcceptOrder}
              disabled={isAccepting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isAccepting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              <span>Accept Order</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={isAccepting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <XCircle className="size-3.5" />
              <span>Reject Items</span>
            </button>
          </div>
        </div>
      )}

      {acceptanceStatus === "rejected" && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-rose-900">
                Fulfillment Rejected for Assigned Line Items
              </h4>
              <p className="text-xs text-rose-800">
                You declined fulfillment of your assigned items for this order. Reason:{" "}
                <span className="font-semibold">{vf.rejectionReason || items[0]?.vendorAcceptance?.rejectionReason || "Stock unavailable"}</span>
              </p>
              <p className="text-[11px] text-rose-700">
                This order has been escalated to the Superadmin Operations review queue. The customer&apos;s parent order remains active pending operational resolution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PHASE VD-05: FULFILLMENT CONFIGURATION & CONFIRMATION PANEL */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="size-4 text-[#004D38]" />
              <span>Vendor Fulfillment &amp; Courier Dispatch Control</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your delivery carrier, set an authoritative delivery promise, and confirm fulfillment.
            </p>
          </div>
          {isConfirmed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>Fulfillment Confirmed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <Clock className="size-3.5 text-amber-600" />
              <span>Awaiting Confirmation</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Step 1: Carrier & Delivery Date Form */}
          <form onSubmit={handleSaveFulfillmentDetails} className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Delivery Logistics &amp; Promise
            </h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shipment Courier Partner <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                disabled={isConfirmed || acceptanceStatus === "rejected"}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#004D38] focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
              >
                {shipmentPartners.length > 0 ? (
                  shipmentPartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="delhivery">Delhivery Express &amp; Surface</option>
                    <option value="shiprocket">Shiprocket Aggregator</option>
                    <option value="bluedart">Blue Dart Express</option>
                    <option value="dtdc">DTDC Courier &amp; Cargo</option>
                    <option value="indiapost">India Post Speed Post</option>
                    <option value="custom">Custom Merchant Fleet / Local Delivery</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expected Delivery Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={todayStr}
                max={maxDateStr}
                required
                value={selectedDeliveryDate}
                onChange={(e) => setSelectedDeliveryDate(e.target.value)}
                disabled={isConfirmed || acceptanceStatus === "rejected"}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#004D38] focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must be today or within 60 days. Propagated to customer tracking.
              </p>
            </div>

            {!isConfirmed && acceptanceStatus !== "rejected" && (
              <button
                type="submit"
                disabled={isSavingDetails}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingDetails ? <Loader2 className="size-3.5 animate-spin" /> : <Calendar className="size-3.5" />}
                <span>Save Logistics Details</span>
              </button>
            )}
          </form>

          {/* Step 2: Central Confirmation Guard Checklist */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              2. Central Confirmation Guard Checklist
            </h4>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  {prereqAcceptance ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 text-amber-500" />
                  )}
                  <span>Order Items Explicitly Accepted</span>
                </span>
                <span className="font-semibold capitalize text-slate-900">{acceptanceStatus}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  {prereqPartner ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 text-amber-500" />
                  )}
                  <span>Shipment Partner Assigned</span>
                </span>
                <span className="font-semibold text-slate-900">
                  {assignedPartner?.partnerName || assignedPartner?.partnerId || (selectedPartnerId ? "Selected" : "Not set")}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  {prereqDate ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 text-amber-500" />
                  )}
                  <span>Expected Delivery Date Set</span>
                </span>
                <span className="font-semibold text-slate-900">
                  {expectedDeliveryDate
                    ? new Date(expectedDeliveryDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : selectedDeliveryDate || "Not set"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-700">
                  {prereqPayment ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <XCircle className="size-4 text-rose-500" />
                  )}
                  <span>Payment Eligible</span>
                </span>
                <span className="font-semibold capitalize text-slate-900">{order.paymentStatus}</span>
              </div>
            </div>

            {/* Confirmation Action Button */}
            {isConfirmed ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Authoritative Fulfillment Confirmed</span>
                </p>
                <p className="text-[11px] text-emerald-700">
                  Courier partner and expected delivery date have been synchronized across marketplace platforms.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmFulfillment}
                  disabled={!allPrerequisitesMet || isConfirming}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                    allPrerequisitesMet
                      ? "bg-[#004D38] hover:bg-[#003828] text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isConfirming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  <span>Confirm Fulfillment &amp; Begin Processing</span>
                </button>

                {!allPrerequisitesMet && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                    <Info className="size-3.5 shrink-0" />
                    <span>
                      Confirmation blocked: Complete acceptance, partner assignment, and delivery date first.
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shipping Destination */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <MapPin className="size-3.5" />
            <span>Delivery Destination</span>
          </div>
          <div className="text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold text-slate-900">{address.fullName || "Customer"}</p>
            {address.phone && <p className="text-slate-500 font-mono text-[11px]">{address.phone}</p>}
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
            <p>{address.country || "India"}</p>
          </div>
        </div>

        {/* Fulfillment Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Clock className="size-3.5" />
            <span>Fulfillment State</span>
          </div>
          <div className="text-sm font-bold text-slate-900 capitalize mb-1">
            {order.fulfillmentStatus || "Unfulfilled"}
          </div>
          <p className="text-xs text-slate-500 leading-snug">
            All order items displayed are strictly filtered to your merchant inventory allocations.
          </p>
        </div>

        {/* Payment & Financial Dossier */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <CreditCard className="size-4 text-[#004D38]" />
              <span>Payment &amp; Financial Dossier</span>
            </div>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                order.paymentStatus === "paid"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : order.paymentStatus === "authorized"
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {order.paymentDetails?.status || order.paymentStatus || "pending"}
            </span>
          </div>

          {/* Payment Method & Reference Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Method</span>
              <span className="font-semibold text-slate-800 capitalize">
                {order.paymentDetails?.method || order.paymentMethod || "Prepaid"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Gateway</span>
              <span className="font-semibold text-slate-800 uppercase">
                {order.paymentDetails?.gateway || "Platform"}
              </span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Transaction Ref:</span>
              <span className="font-mono text-[11px] font-medium text-slate-700">
                {order.paymentDetails?.transactionReference || "CONFIRMED-AT-CHECKOUT"}
              </span>
            </div>
            {order.paymentDetails?.paidAt && (
              <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>Paid At:</span>
                <span>{new Date(order.paymentDetails.paidAt).toLocaleString("en-IN")}</span>
              </div>
            )}
            {order.paymentDetails?.isCod && (
              <div className="col-span-2 px-2 py-1 rounded bg-amber-100/70 text-amber-900 font-semibold text-[11px]">
                Cash on Delivery: ₹{order.paymentDetails.codAmount} to collect upon delivery.
              </div>
            )}
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-600 pt-1">
            <div className="flex justify-between">
              <span>Gross Item Subtotal:</span>
              <span className="font-semibold text-slate-900">
                ₹{Number(order.financialBreakdown?.subtotal || order.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Number(order.financialBreakdown?.discountTotal || 0) > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Applicable Discounts:</span>
                <span>-₹{Number(order.financialBreakdown.discountTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {Number(order.financialBreakdown?.taxTotal || 0) > 0 && (
              <div className="flex justify-between">
                <span>Included GST / Tax:</span>
                <span>₹{Number(order.financialBreakdown.taxTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Platform Marketplace Fee:</span>
              <span className="text-rose-600 font-medium">
                -₹{Number(order.financialBreakdown?.commissionTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-900">Estimated Net Payout:</span>
              <span className="text-xl font-black text-[#004D38]">
                ₹{Number(order.financialBreakdown?.estimatedReceivable || order.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 italic leading-snug">
            * Estimated receivable calculated from locked order-time snapshot (VW-02). Payout balance credits to vendor wallet upon delivery.
          </p>
        </div>
      </div>

      {/* Shipment & Courier Dossier */}
      {shipments.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="size-4 text-[#004D38]" />
                <span>Courier Shipments &amp; Tracking ({shipments.length})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Dispatches generated for this order</p>
            </div>
            <Link
              href="/vendor/shipments"
              className="text-xs font-semibold text-[#004D38] hover:underline"
            >
              View All Shipments
            </Link>
          </div>

          <div className="space-y-3">
            {shipments.map((shp) => (
              <div
                key={shp._id || shp.secureId}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {shp.shipmentNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-700">
                      {shp.status}
                    </span>
                    <span className="text-xs text-slate-600 font-medium">
                      Carrier: <strong className="text-slate-900">{shp.carrier || "Courier"}</strong>
                    </span>
                  </div>
                  {shp.trackingNumber && (
                    <p className="text-xs text-slate-500 mt-1">
                      AWB / Tracking Number: <span className="font-mono font-bold text-slate-800">{shp.trackingNumber}</span>
                    </p>
                  )}
                  {shp.bookingDetails?.errorMessage && (
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      Booking: <span className="font-semibold">{shp.bookingDetails.status}</span> ({shp.bookingDetails.errorMessage})
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(shp.status === "booking_failed" || (!shp.awbNumber && ["created", "booking_pending"].includes(shp.status))) && (
                    <button
                      type="button"
                      disabled={isProcessingAction}
                      onClick={() => handleRetryBooking(shp.secureId || shp._id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className="size-3" />
                      <span>Retry Booking</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPackingSlipTarget({ type: "shipment", id: shp.secureId || shp._id })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-colors"
                  >
                    <Printer className="size-3 text-slate-400" />
                    <span>Packing Slip</span>
                  </button>
                  {shp.trackingUrl && (
                    <a
                      href={shp.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      <span>Track with Courier</span>
                      <ExternalLink className="size-3 text-slate-400" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200/80">
          <h3 className="text-sm font-bold text-slate-900">Your Scoped Order Items</h3>
          <p className="text-xs text-slate-500">Products fulfilled from your merchant inventory</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">SKU / Item</th>
                <th className="px-6 py-3.5 text-center">Acceptance</th>
                <th className="px-6 py-3.5 text-center">Fulfillment Status</th>
                <th className="px-6 py-3.5 text-center">Qty</th>
                <th className="px-6 py-3.5 text-right">Unit Price</th>
                <th className="px-6 py-3.5 text-right">Line Total</th>
                <th className="px-6 py-3.5 text-right">Exception / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const itemException = exceptions.find((exc) => {
                  const idMatches = exc.orderItemId && String(exc.orderItemId) === String(item._id || item.id);
                  const skuMatches = exc.itemSnapshot?.sku && exc.itemSnapshot.sku === item.sku;
                  return idMatches || skuMatches;
                });

                const itemAcceptance = item.vendorAcceptance?.status || acceptanceStatus || "pending";
                const isEligibleToReport =
                  !itemException &&
                  !["shipped", "cancelled"].includes(item.fulfillmentStatus) &&
                  Number(item.quantity) > 0;

                return (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">
                        {item.productName || item.sku}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        SKU: {item.sku}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          itemAcceptance === "accepted"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : itemAcceptance === "rejected"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {itemAcceptance}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {item.fulfillmentStatus || "unfulfilled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-slate-900">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      ₹{Number(item.unitPrice || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      ₹{Number(item.lineTotal || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {itemException ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingException(itemException)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                              itemException.status === "resolved"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : itemException.status === "awaiting_vendor"
                                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 animate-pulse"
                                : itemException.status === "rejected"
                                ? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            }`}
                          >
                            <AlertTriangle className="size-3" />
                            <span className="capitalize">{itemException.status.replace("_", " ")}</span>
                          </button>
                        </div>
                      ) : isEligibleToReport ? (
                        <button
                          type="button"
                          onClick={() => setReportingItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="size-3 text-rose-500" />
                          <span>Report Issue</span>
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

      {/* PHASE VD-05: REJECT ORDER MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertCircle className="size-5" />
                <h3 className="font-bold text-slate-900">Decline Order Fulfillment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Decline fulfillment for your assigned items in this order.
              <br />
              <strong className="text-slate-800">
                Notice: The customer&apos;s parent order will NOT be cancelled. An operations supervisor in the Superadmin review queue will be alerted to reassign or resolve.
              </strong>
            </p>

            <form onSubmit={handleRejectOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Out of stock in designated warehouse, production delay..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">Minimum 5 characters required.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejecting || rejectionReason.trim().length < 5}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isRejecting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipment Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="size-5 text-[#004D38]" />
                <h3 className="font-bold text-slate-900">Create Courier Shipment</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShipmentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Courier / Carrier <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={shipmentForm.carrier}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, carrier: e.target.value })}
                  placeholder="e.g. Delhivery, Shiprocket, BlueDart"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              {warehouses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dispatch Warehouse
                  </label>
                  <select
                    value={shipmentForm.warehouseId}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, warehouseId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh._id || wh.id} value={wh._id || wh.id}>
                        {wh.name || wh.warehouseName || "Warehouse"} ({wh.city || wh.state || "IN"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Level
                  </label>
                  <input
                    type="text"
                    value={shipmentForm.serviceLevel}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, serviceLevel: e.target.value })}
                    placeholder="Standard Surface"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AWB / Tracking Number
                  </label>
                  <input
                    type="text"
                    value={shipmentForm.trackingNumber}
                    onChange={(e) => setShipmentForm({ ...shipmentForm, trackingNumber: e.target.value })}
                    placeholder="AWB123456789"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Public Tracking URL
                </label>
                <input
                  type="url"
                  value={shipmentForm.trackingUrl}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, trackingUrl: e.target.value })}
                  placeholder="https://track.carrier.com/..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dispatch Notes
                </label>
                <textarea
                  rows={2}
                  value={shipmentForm.notes}
                  onChange={(e) => setShipmentForm({ ...shipmentForm, notes: e.target.value })}
                  placeholder="Packaging specifications or handover notes..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingAction}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                >
                  {isProcessingAction && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Generate Shipment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Packing Slip Modal */}
      {packingSlipTarget && (
        <PackingSlipModal
          isOpen={Boolean(packingSlipTarget)}
          onClose={() => setPackingSlipTarget(null)}
          orderId={packingSlipTarget.type === "order" ? packingSlipTarget.id : (order.secureId || order._id)}
          shipmentId={packingSlipTarget.type === "shipment" ? packingSlipTarget.id : null}
          fetchPackingSlipFn={() =>
            packingSlipTarget.type === "shipment"
              ? vendorService.getShipmentPackingSlip(packingSlipTarget.id)
              : vendorService.getOrderPackingSlip(packingSlipTarget.id)
          }
          fetchSlip={() =>
            packingSlipTarget.type === "shipment"
              ? vendorService.getShipmentPackingSlip(packingSlipTarget.id)
              : vendorService.getOrderPackingSlip(packingSlipTarget.id)
          }
        />
      )}

      {/* Report Fulfillment Exception Modal */}
      {reportingItem && (
        <ReportExceptionModal
          isOpen={Boolean(reportingItem)}
          onClose={() => setReportingItem(null)}
          orderId={order.secureId || order._id}
          orderNumber={order.orderNumber}
          item={reportingItem}
          onExceptionSubmitted={async () => {
            setReportingItem(null);
            await loadOrder();
          }}
        />
      )}

      {/* View & Update Exception Detail Modal */}
      {viewingException && (
        <ExceptionDetailModal
          isOpen={Boolean(viewingException)}
          onClose={() => setViewingException(null)}
          exceptionId={viewingException._id || viewingException.id}
          onUpdate={async () => {
            await loadOrder();
          }}
        />
      )}
    </div>
  );
}