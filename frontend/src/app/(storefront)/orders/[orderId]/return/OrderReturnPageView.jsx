"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Package,
  ShieldCheck,
  Clock,
  Loader2,
  Camera,
  UploadCloud,
  Trash2,
  Truck,
  Building,
  CreditCard,
  ChevronRight,
  Sparkles,
  Info,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { returnService } from "../../../../../services/return.service.js";
import { formatCurrency } from "../../../../../utils/formatCurrency.js";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

const RETURN_REASONS = [
  "Defective / Does not work properly",
  "Physical damage in transit / Box crushed",
  "Item different from description or missing accessories",
  "Audio / performance quality issue",
  "Wrong model, color or size delivered",
  "Quality not as expected",
  "Don't want the product anymore",
];

const FLIPKART_STEPS = [
  { key: "requested", label: "Return Requested", desc: "Request submitted and waiting for merchant review" },
  { key: "pickup_scheduled", label: "Pickup Scheduled", desc: "Courier partner assigned for doorstep pickup" },
  { key: "picked_up", label: "Item Picked Up", desc: "Handed over to courier and in-transit to warehouse" },
  { key: "inspected", label: "Quality Inspection", desc: "Technical inspection completed at fulfillment center" },
  { key: "completed", label: "Refund / Exchange Done", desc: "Amount credited to payment source or replacement delivered" },
];

function getTimelineProgress(status, type) {
  switch (status) {
    case "requested":
    case "under_review":
      return 1;
    case "approved":
    case "pickup_scheduled":
      return 2;
    case "picked_up":
    case "item_received":
      return 3;
    case "inspected":
    case "refund_pending":
    case "replacement_fulfillment":
      return 4;
    case "refunded":
    case "exchange_completed":
    case "completed":
      return 5;
    case "rejected":
    case "cancelled":
      return -1;
    default:
      return 1;
  }
}

export function OrderReturnPageView({ orderId }) {
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active or submitted return to display timeline
  const [activeReturn, setActiveReturn] = useState(null);

  // Form state
  const [returnType, setReturnType] = useState("return"); // "return" (refund) or "exchange" (replacement)
  const [selectedItems, setSelectedItems] = useState({});
  const [replacementVariantMap, setReplacementVariantMap] = useState({});
  const [reason, setReason] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [condition, setCondition] = useState("unopened");

  // Evidence photos
  const [evidenceImages, setEvidenceImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Pickup address state
  const [customPickupAddress, setCustomPickupAddress] = useState(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
  });

  // Refund / Bank details state (for COD)
  const [refundMethod, setRefundMethod] = useState("original_source");
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    upiId: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await returnService.checkEligibility(orderId);
        if (!isMounted) return;
        const data = res?.data?.data || res?.data || res;
        setEligibility(data);

        // If there's already an active return on this order, pre-set it to show status
        if (Array.isArray(data.existingReturns) && data.existingReturns.length > 0) {
          const sorted = [...data.existingReturns].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setActiveReturn(sorted[0]);
        }

        // Initialize first eligible item selected by default
        const eligibleItems = (data.items || []).filter((it) => it.isEligible);
        if (eligibleItems.length > 0) {
          const first = eligibleItems[0];
          const itemKey = first.orderItemId || first.productId;
          setSelectedItems({
            [itemKey]: {
              orderItemId: first.orderItemId,
              productId: first.productId,
              productVariantId: first.productVariantId,
              quantity: 1,
              maxQuantity: first.remainingReturnableQuantity || 1,
              name: first.name,
              unitPrice: Number(first.unitPrice || 0),
              image: first.imageUrl,
            },
          });
        }

        // Default pickup address from order
        if (data.shippingAddress) {
          setAddressForm({
            fullName: data.shippingAddress.fullName || "",
            phone: data.shippingAddress.phone || "",
            street: data.shippingAddress.addressLine1 || data.shippingAddress.street || "",
            city: data.shippingAddress.city || "",
            state: data.shippingAddress.state || "",
            postalCode: data.shippingAddress.postalCode || "",
          });
        }

        // Auto-select refund method based on paymentMethod
        if (data.paymentMethod === "cod") {
          setRefundMethod("bank_transfer");
        } else {
          setRefundMethod("original_source");
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || "Failed to load order return eligibility.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleToggleItem = (item) => {
    const itemKey = item.orderItemId || item.productId;
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[itemKey]) {
        delete next[itemKey];
      } else {
        const effUnit = item.effectiveUnitPaid !== undefined ? Number(item.effectiveUnitPaid) : Number(item.unitPrice || 0);
        const itemTotal = item.itemCustomerPaidTotal !== undefined ? Number(item.itemCustomerPaidTotal) : undefined;
        next[itemKey] = {
          orderItemId: item.orderItemId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: 1,
          maxQuantity: item.remainingReturnableQuantity || 1,
          orderedQuantity: item.orderedQuantity,
          name: item.name,
          unitPrice: Number(item.unitPrice || 0),
          effectiveUnitPaid: effUnit,
          itemCustomerPaidTotal: itemTotal,
          image: item.imageUrl,
        };
      }
      return next;
    });
  };

  const handleQtyChange = (itemKey, qty) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        quantity: Math.min(Number(qty), prev[itemKey].maxQuantity),
      },
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (evidenceImages.length + files.length > 5) {
      toast.error("You can upload a maximum of 5 evidence photographs.");
      return;
    }

    // Check SVG or non-image
    for (const f of files) {
      if (f.type.includes("svg") || f.name.toLowerCase().endsWith(".svg")) {
        toast.error("SVG vector files are not allowed for security reasons.");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`File ${f.name} is not a supported image (JPG, PNG, WebP only).`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`File ${f.name} exceeds the 5MB file size limit.`);
        return;
      }
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append("images", f);
      }

      const res = await returnService.uploadEvidence(formData);
      const uploadedUrls =
        res?.data?.images ||
        res?.images ||
        (res?.data?.url ? [res.data.url] : res?.url ? [res.url] : []);
      if (uploadedUrls.length > 0) {
        setEvidenceImages((prev) => [...prev, ...uploadedUrls].slice(0, 5));
        toast.success(`${uploadedUrls.length} photograph(s) uploaded successfully.`);
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err?.message || "";
      if (/unexpected field/i.test(errMsg)) {
        toast.error("Upload format error: Please ensure you select valid image files.");
      } else if (/size|large/i.test(errMsg)) {
        toast.error("One or more files exceed the 5MB size limit.");
      } else if (/svg/i.test(errMsg)) {
        toast.error("SVG vector files are not permitted for security reasons.");
      } else if (/format|type/i.test(errMsg)) {
        toast.error("Unsupported file type. Please upload JPG, PNG, or WebP images only.");
      } else if (/too many/i.test(errMsg)) {
        toast.error("You can upload a maximum of 5 evidence photographs.");
      } else {
        toast.error(errMsg || "Failed to upload image. Please check your network and try again.");
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setEvidenceImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const calculateTotalRefund = () => {
    return Object.values(selectedItems).reduce((sum, it) => {
      if (
        it.itemCustomerPaidTotal !== undefined &&
        it.quantity === it.maxQuantity &&
        it.maxQuantity === it.orderedQuantity
      ) {
        return sum + it.itemCustomerPaidTotal;
      }
      const unitVal = it.effectiveUnitPaid !== undefined ? Number(it.effectiveUnitPaid) : Number(it.unitPrice || 0);
      return sum + unitVal * (it.quantity || 1);
    }, 0);
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    const itemsList = Object.values(selectedItems);

    if (itemsList.length === 0) {
      toast.error("Please select at least one item to return or exchange.");
      return;
    }

    if (!reason) {
      toast.error("Please select a valid reason.");
      return;
    }

    if (returnType === "exchange") {
      // Must have selected replacement variant for at least the primary item
      const primaryItem = itemsList[0];
      const repVariantId = replacementVariantMap[primaryItem.orderItemId || primaryItem.productId];
      if (!repVariantId) {
        toast.error("Please select your desired replacement size/color variant for exchange.");
        return;
      }
    }

    if (eligibility?.paymentMethod === "cod") {
      if (refundMethod === "bank_transfer") {
        if (!bankForm.accountNumber || !bankForm.confirmAccountNumber || !bankForm.ifscCode) {
          toast.error("Please fill in complete bank account details for refund disbursement.");
          return;
        }
        if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
          toast.error("Bank account numbers do not match.");
          return;
        }
      } else if (refundMethod === "upi") {
        if (!bankForm.upiId || !bankForm.upiId.includes("@")) {
          toast.error("Please enter a valid UPI ID (e.g., yourname@bank).");
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payloadItems = itemsList.map((it) => ({
        orderItemId: it.orderItemId,
        productId: it.productId,
        productVariantId: it.productVariantId || undefined,
        quantity: it.quantity,
        reason,
        condition,
        images: evidenceImages.map((url) => ({ url })),
      }));

      const primaryItem = itemsList[0];
      const replacementVariantId =
        returnType === "exchange"
          ? replacementVariantMap[primaryItem.orderItemId || primaryItem.productId]
          : undefined;

      const payload = {
        orderId,
        type: returnType,
        items: payloadItems,
        replacementVariantId,
        images: evidenceImages.map((url) => ({ url })),
        customerNotes: customerNotes.trim(),
        refundMethod: eligibility?.paymentMethod === "cod" ? refundMethod : "original_source",
        pickupAddress: isEditingAddress ? addressForm : eligibility?.shippingAddress,
      };

      if (eligibility?.paymentMethod === "cod") {
        payload.bankDetails = {
          accountNumber: bankForm.accountNumber.trim(),
          ifscCode: bankForm.ifscCode.trim().toUpperCase(),
          accountHolderName: bankForm.accountHolderName.trim(),
          upiId: bankForm.upiId.trim(),
        };
      }

      const res = await returnService.createReturnRequest(payload);
      const createdReturn = res?.data?.data || res?.data || res;
      setActiveReturn(createdReturn);
      toast.success(
        returnType === "exchange"
          ? "Exchange request submitted! We will arrange doorstep pickup."
          : "Return request submitted! Our team will coordinate your pickup."
      );
    } catch (err) {
      toast.error(err?.message || "Failed to submit return request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !eligibility) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="font-bold text-slate-900 text-lg">Unable to Check Return Eligibility</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error || "Could not retrieve order details."}</p>
          <div className="pt-2">
            <Link
              href={`/orders/${orderId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 1. ACTIVE RETURN TIMELINE VIEW (Flipkart 5-Stage Stepper)
  if (activeReturn) {
    const progressLevel = getTimelineProgress(activeReturn.status, activeReturn.type);
    const isRejected = activeReturn.status === "rejected";
    const isCancelled = activeReturn.status === "cancelled";
    const reversePickup = activeReturn.reversePickupSchedule;

    return (
      <div className="min-h-screen bg-slate-50/50 py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
          <Link
            href={`/orders/${orderId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Order #{eligibility.orderNumber}
          </Link>

          {/* Flipkart Banner */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#004D38]">
                  <ShieldCheck className="h-3.5 w-3.5" /> 7-Day Flipkart Quality Guarantee
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 pt-2 tracking-tight">
                  {activeReturn.type === "exchange" ? "Exchange Status" : "Return & Refund Status"}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Return ID: <span className="font-mono font-bold text-slate-800">{activeReturn.returnNumber || activeReturn._id}</span> • Order #{eligibility.orderNumber}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">Status</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mt-1 ${
                  isRejected
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : isCancelled
                    ? "bg-slate-100 text-slate-600"
                    : progressLevel === 5
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}>
                  {activeReturn.status?.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* 5-Step Stepper Progress */}
            {!isRejected && !isCancelled && (
              <div className="pt-2">
                <div className="relative">
                  <div className="hidden sm:block absolute top-5 left-8 right-8 h-1 bg-slate-100 -z-0">
                    <div
                      className="h-full bg-[#004D38] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, ((progressLevel - 1) / 4) * 100))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
                    {FLIPKART_STEPS.map((step, idx) => {
                      const stepNum = idx + 1;
                      const isComplete = progressLevel > stepNum;
                      const isCurrent = progressLevel === stepNum;

                      return (
                        <div key={step.key} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                              isComplete
                                ? "bg-[#004D38] text-white shadow-xs"
                                : isCurrent
                                ? "bg-amber-500 text-white ring-4 ring-amber-100"
                                : "bg-white border-2 border-slate-200 text-slate-400"
                            }`}
                          >
                            {isComplete ? <Check className="h-5 w-5" /> : stepNum}
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${isCurrent ? "text-amber-800" : isComplete ? "text-slate-900" : "text-slate-400"}`}>
                              {step.label}
                            </p>
                            <p className="text-[10px] text-slate-500 hidden sm:block leading-tight mt-0.5">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Reverse Logistics / Pickup Details Card */}
            {reversePickup && (
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-5 text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span>Reverse Courier Pickup Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Courier Partner</span>
                    <span className="font-bold text-slate-900">{reversePickup.carrier || "Assigned Partner"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Pickup Token</span>
                    <span className="font-mono font-bold text-blue-800">{reversePickup.pickupToken || "Generated"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Scheduled Window</span>
                    <span className="font-semibold">
                      {reversePickup.scheduledDate
                        ? new Date(reversePickup.scheduledDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Within 2 business days"}{" "}
                      ({reversePickup.timeSlot || "Standard hours"})
                    </span>
                  </div>
                </div>
                {reversePickup.trackingNumber && (
                  <p className="text-[11px] text-blue-800 pt-1">
                    Reverse AWB Tracking: <strong className="font-mono">{reversePickup.trackingNumber}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Summary Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">Doorstep Pickup Address</span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  {activeReturn.pickupAddress?.fullName && (
                    <strong className="block text-slate-800">{activeReturn.pickupAddress.fullName}</strong>
                  )}
                  {activeReturn.pickupAddress?.street || activeReturn.pickupAddress?.addressLine1},{" "}
                  {activeReturn.pickupAddress?.city}, {activeReturn.pickupAddress?.state} -{" "}
                  {activeReturn.pickupAddress?.postalCode}
                  {activeReturn.pickupAddress?.phone && (
                    <span className="block text-slate-500 pt-1">Phone: {activeReturn.pickupAddress.phone}</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 p-4 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">Resolution & Refund Mode</span>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <p>
                    Resolution: <strong className="uppercase text-[#004D38]">{activeReturn.type}</strong>
                  </p>
                  <p>
                    Refund Value:{" "}
                    <strong className="text-slate-900 font-bold">
                      {formatCurrency(Number(activeReturn.refundAmount?.toString?.() || 0))}
                    </strong>
                  </p>
                  <p>
                    Mode:{" "}
                    <strong className="capitalize">
                      {activeReturn.refundMethod?.replace(/_/g, " ") || "Original Payment Source"}
                    </strong>
                  </p>
                  {activeReturn.bankDetails?.accountNumberMasked && (
                    <p className="font-mono text-slate-500">
                      Bank A/C: {activeReturn.bankDetails.accountNumberMasked} (IFSC: {activeReturn.bankDetails.ifscCode})
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Return Items List */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Items Included in this Request
              </span>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                {(activeReturn.items || []).map((it, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between gap-4 text-xs bg-white">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900">{it.name || "Product Item"}</p>
                      <p className="text-[11px] text-slate-500">
                        Qty: <strong className="text-slate-700">{it.quantity || 1}</strong> • Reason:{" "}
                        <span className="italic">{it.reason || activeReturn.customerNotes}</span>
                      </p>
                    </div>
                    <span className="font-bold text-slate-800">
                      {formatCurrency(Number(it.itemPrice?.toString?.() || 0) * (it.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <Link
                href={`/orders/${orderId}`}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back to Order
              </Link>
              <button
                type="button"
                onClick={() => setActiveReturn(null)}
                className="text-xs font-bold text-[#004D38] hover:underline"
              >
                Need to submit another item return? Click here.
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. CHECK IF ORDER HAS NO ELIGIBLE ITEMS AT ALL
  const eligibleItems = (eligibility.items || []).filter((it) => it.isEligible);
  const hasEligibleItems = eligibleItems.length > 0;

  if (!hasEligibleItems) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 bg-slate-50/50">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Items Not Eligible for Return</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {eligibility.ineligibilityReason ||
              "None of the items in this order are currently eligible for return or exchange under the 7-day policy window."}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/orders/${orderId}`}
              className="rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Back to Order Details
            </Link>
            <Link
              href="/contact-support"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Contact Customer Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. FLIPKART-STYLE RETURN & EXCHANGE APPLICATION FORM
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Order #{eligibility.orderNumber}
        </Link>

        {/* Header Guarantee Banner */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-1.5 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#004D38]">
              <ShieldCheck className="h-3.5 w-3.5" /> 7-Day Hassle-Free Flipkart Policy
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Return or Exchange Items</h1>
            <p className="text-xs text-slate-500">
              Select items from Order #{eligibility.orderNumber} for doorstep pickup and refund or replacement.
            </p>
          </div>

          <form onSubmit={handleSubmitReturn} className="space-y-8">
            {/* Resolution Mode Selector: Return vs Exchange */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                1. What would you like to do?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReturnType("return")}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                    returnType === "return"
                      ? "border-[#004D38] bg-emerald-50/40 ring-2 ring-[#004D38]/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    returnType === "return" ? "border-[#004D38] bg-[#004D38] text-white" : "border-slate-300"
                  }`}>
                    {returnType === "return" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5 text-[#004D38]" /> Return & Refund
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      Send the item back for a complete refund to your original payment method or bank account.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnType("exchange")}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                    returnType === "exchange"
                      ? "border-[#004D38] bg-emerald-50/40 ring-2 ring-[#004D38]/20"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    returnType === "exchange" ? "border-[#004D38] bg-[#004D38] text-white" : "border-slate-300"
                  }`}>
                    {returnType === "exchange" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-[#004D38]" /> Exchange (Swap Size / Color)
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      Choose an alternative size or color variant. Free doorstep replacement without extra charge.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Item Selection List */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                2. Select Items to {returnType === "exchange" ? "Exchange" : "Return"}
              </label>

              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                {(eligibility.items || []).map((item) => {
                  const itemKey = item.orderItemId || item.productId;
                  const isChecked = Boolean(selectedItems[itemKey]);
                  const isEligible = item.isEligible;
                  const maxQty = item.remainingReturnableQuantity || 1;

                  return (
                    <div
                      key={itemKey}
                      className={`p-4 transition-colors ${
                        !isEligible
                          ? "bg-slate-50/70 opacity-60"
                          : isChecked
                          ? "bg-emerald-50/20"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={!isEligible}
                            checked={isChecked}
                            onChange={() => handleToggleItem(item)}
                            className="rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] h-4 w-4 disabled:opacity-40"
                          />

                          {item.imageUrl && (
                            <div className="relative h-14 w-14 shrink-0 rounded-xl border border-slate-200 overflow-hidden bg-white">
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                className="object-contain p-1"
                                sizes="56px"
                              />
                            </div>
                          )}

                          <div>
                            <p className="font-bold text-xs text-slate-900">{item.name}</p>
                            {item.variantName && (
                              <p className="text-[11px] font-semibold text-emerald-700">{item.variantName}</p>
                            )}
                            <p className="text-[11px] text-slate-600 font-medium">
                              {formatCurrency(Number(item.effectiveUnitPaid !== undefined ? item.effectiveUnitPaid : item.unitPrice || 0))} each
                              <span className="text-slate-400 font-normal"> (Includes GST &amp; delivery charges)</span>
                              {" • "}Ordered: {item.orderedQuantity}
                              {item.returnedQuantity > 0 && ` (${item.returnedQuantity} already returned)`}
                            </p>
                            {!isEligible && (
                              <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] font-semibold mt-1">
                                {item.ineligibilityReason || "Not returnable"}
                              </span>
                            )}
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <span className="text-xs text-slate-500 font-medium">Qty:</span>
                            <select
                              value={selectedItems[itemKey]?.quantity || 1}
                              onChange={(e) => handleQtyChange(itemKey, e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800"
                            >
                              {Array.from({ length: maxQty }).map((_, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                  {idx + 1}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Sibling Variant Selector for Exchanges */}
                      {isChecked && returnType === "exchange" && (
                        <div className="mt-4 pt-3 border-t border-slate-100 pl-7 space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 block">
                            Select Replacement Variant:
                          </span>
                          {Array.isArray(item.availableExchangeVariants) && item.availableExchangeVariants.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {item.availableExchangeVariants.map((v) => {
                                const isSelectedVariant = replacementVariantMap[itemKey] === v.variantId;
                                return (
                                  <label
                                    key={v.variantId}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                      isSelectedVariant
                                        ? "border-[#004D38] bg-emerald-50/60 font-bold text-[#004D38]"
                                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        name={`replacement_${itemKey}`}
                                        value={v.variantId}
                                        checked={isSelectedVariant}
                                        onChange={() =>
                                          setReplacementVariantMap((prev) => ({
                                            ...prev,
                                            [itemKey]: v.variantId,
                                          }))
                                        }
                                        className="text-[#004D38] focus:ring-[#004D38]"
                                      />
                                      <span>{v.name || v.sku}</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      {formatCurrency(Number(v.price || 0))}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-700 italic">
                              No alternative size or color variants currently in stock. You can still proceed with a return &amp; refund.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reason & Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  3. Reason for {returnType === "exchange" ? "Exchange" : "Return"} <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                >
                  <option value="">-- Choose a Reason --</option>
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Package Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
                >
                  <option value="unopened">Unopened / Sealed box</option>
                  <option value="opened_unused">Opened but unused</option>
                  <option value="defective_in_box">Defective / Malfunctioning</option>
                  <option value="damaged">Physically damaged in transit</option>
                </select>
              </div>
            </div>

            {/* Evidence Photograph Uploader */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  4. Upload Defect / Condition Photographs (Optional, Max 5)
                </label>
                <span className="text-[11px] text-slate-400">JPG, PNG, WebP up to 5MB</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {evidenceImages.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="relative h-20 w-20 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 group"
                  >
                    <Image src={imgUrl} alt={`Evidence ${idx + 1}`} fill className="object-cover" sizes="80px" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {evidenceImages.length < 5 && (
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-24 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#004D38] bg-slate-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-[#004D38] transition-colors cursor-pointer"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px] font-bold">Add Photo</span>
                      </>
                    )}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Comments & Symptoms */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                5. Additional Comments & Symptoms
              </label>
              <textarea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Describe specific symptoms or defects to assist the inspection technician..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-[#004D38]"
              />
            </div>

            {/* Doorstep Pickup Address */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-[#004D38]" /> Doorstep Pickup Location
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  className="text-xs font-bold text-[#004D38] hover:underline"
                >
                  {isEditingAddress ? "Use Original Order Address" : "Change Pickup Address"}
                </button>
              </div>

              {!isEditingAddress ? (
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {eligibility.shippingAddress?.fullName && (
                    <strong className="block text-slate-800">{eligibility.shippingAddress.fullName}</strong>
                  )}
                  {eligibility.shippingAddress?.addressLine1 || eligibility.shippingAddress?.street},{" "}
                  {eligibility.shippingAddress?.city}, {eligibility.shippingAddress?.state} -{" "}
                  {eligibility.shippingAddress?.postalCode} (Contact: {eligibility.shippingAddress?.phone})
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <label className="block text-slate-600 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={addressForm.fullName}
                      onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                      className="w-full p-2 rounded-lg border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full p-2 rounded-lg border bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={addressForm.street}
                      onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                      className="w-full p-2 rounded-lg border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full p-2 rounded-lg border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={addressForm.postalCode}
                      onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                      className="w-full p-2 rounded-lg border bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Payment & COD Bank Details */}
            {returnType === "return" && (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  6. Refund Disbursement Mode
                </label>

                {eligibility.paymentMethod !== "cod" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs space-y-1">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-[#004D38]" /> Original Payment Method Refund
                    </span>
                    <p className="text-emerald-800 text-[11px] leading-relaxed">
                      Amount will be credited directly back to your original payment method (Card / NetBanking / UPI) within 3 business days following successful inspection.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="refundMode"
                          value="bank_transfer"
                          checked={refundMethod === "bank_transfer"}
                          onChange={() => setRefundMethod("bank_transfer")}
                          className="text-[#004D38] focus:ring-[#004D38]"
                        />
                        Bank Account (NEFT / IMPS)
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="radio"
                          name="refundMode"
                          value="upi"
                          checked={refundMethod === "upi"}
                          onChange={() => setRefundMethod("upi")}
                          className="text-[#004D38] focus:ring-[#004D38]"
                        />
                        Instant UPI Transfer
                      </label>
                    </div>

                    {refundMethod === "bank_transfer" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 mb-1 font-semibold">Account Number *</label>
                          <input
                            type="text"
                            required
                            value={bankForm.accountNumber}
                            onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                            className="w-full p-2.5 rounded-xl border bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 font-semibold">Confirm Account Number *</label>
                          <input
                            type="text"
                            required
                            value={bankForm.confirmAccountNumber}
                            onChange={(e) => setBankForm({ ...bankForm, confirmAccountNumber: e.target.value })}
                            className="w-full p-2.5 rounded-xl border bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 font-semibold">Bank IFSC Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. HDFC0001234"
                            value={bankForm.ifscCode}
                            onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
                            className="w-full p-2.5 rounded-xl border bg-white uppercase font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 mb-1 font-semibold">Account Holder Name *</label>
                          <input
                            type="text"
                            required
                            value={bankForm.accountHolderName}
                            onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                            className="w-full p-2.5 rounded-xl border bg-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs max-w-sm">
                        <label className="block text-slate-600 mb-1 font-semibold">UPI Virtual Payment Address *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. mobile@okhdfcbank"
                          value={bankForm.upiId}
                          onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                          className="w-full p-2.5 rounded-xl border bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Estimated Refund Summary Banner */}
            {returnType === "return" && (
              <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Estimated Total Refund:</span>
                  <span className="text-lg font-black text-emerald-400">
                    {formatCurrency(calculateTotalRefund())}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Includes product price, applicable GST, and allocated delivery charges. Zero deductions applied.
                </p>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Link
                href={`/orders/${orderId}`}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || Object.keys(selectedItems).length === 0 || !reason}
                className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-7 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting Request...
                  </>
                ) : returnType === "exchange" ? (
                  <>
                    <RefreshCw className="h-4 w-4" /> Submit Exchange Request
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" /> Submit Return &amp; Refund Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
