"use client";

import React, { useState, useEffect } from "react";
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ArrowRight,
  Check,
  Ban,
  Package,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { adminOperationsService } from "@/services/admin/admin.service";

const SHIPMENT_STATUS_TRANSITIONS = {
  created: ["booked", "awb_assigned", "label_available", "pickup_scheduled", "ready_to_ship", "picked_up", "cancelled"],
  booked: ["awb_assigned", "label_available", "pickup_scheduled", "ready_to_ship", "picked_up", "cancelled"],
  awb_assigned: ["label_available", "pickup_scheduled", "ready_to_ship", "picked_up", "cancelled"],
  label_available: ["pickup_scheduled", "ready_to_ship", "picked_up", "cancelled"],
  pickup_scheduled: ["ready_to_ship", "picked_up", "cancelled"],
  ready_to_ship: ["pickup_scheduled", "picked_up", "cancelled"],
  picked_up: ["in_transit", "failed", "exception", "cancelled"],
  in_transit: ["out_for_delivery", "delivered", "failed", "exception", "rto_initiated"],
  out_for_delivery: ["delivered", "failed", "exception", "rto_initiated"],
  failed: ["ready_to_ship", "picked_up", "in_transit", "out_for_delivery", "exception", "rto_initiated", "cancelled"],
  exception: ["in_transit", "out_for_delivery", "delivered", "failed", "rto_initiated", "cancelled"],
  rto_initiated: ["rto_in_transit", "rto_delivered", "returned"],
  rto_in_transit: ["rto_delivered", "returned"],
  rto_delivered: [],
  delivered: ["returned", "rto_initiated"],
  cancelled: [],
  returned: [],
};

const ALL_TRANSIT_STATUSES = [
  "booked",
  "awb_assigned",
  "label_available",
  "pickup_scheduled",
  "ready_to_ship",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "failed",
  "rto_initiated",
  "rto_in_transit",
  "rto_delivered",
  "cancelled",
  "returned",
];

const STATUS_DESCRIPTIONS = {
  created: "Shipment record initialized, awaiting warehouse manifest",
  booked: "Courier booking confirmed with logistics partner",
  awb_assigned: "AWB waybill assigned by logistics partner",
  label_available: "Shipping label and manifest generated and available",
  pickup_scheduled: "Courier pickup scheduled for vendor warehouse dispatch",
  ready_to_ship: "Consignment packed & labelled, waiting for courier dispatch",
  picked_up: "Consignment handed over to courier carrier; inventory deducted",
  in_transit: "Consignment actively in transit via courier transport network",
  out_for_delivery: "Courier agent has parcel out for immediate customer delivery",
  delivered: "Consignment successfully delivered to recipient shipping address",
  exception: "Delivery exception reported by logistics partner",
  failed: "Courier delivery attempt unsuccessful; returned to sorting hub",
  rto_initiated: "Return to origin initiated by carrier",
  rto_in_transit: "Returned package in transit back to vendor warehouse",
  rto_delivered: "Returned package delivered back to vendor",
  cancelled: "Shipment cancelled; reserved inventory returned to warehouse",
  returned: "Consignment returned to fulfilling warehouse by courier",
};

export default function AdminShipmentStatusModal({
  isOpen,
  onClose,
  shipment,
  onUpdated,
}) {
  if (!isOpen || !shipment) return null;

  const currentStatus = shipment.status || "created";
  const validNextStatuses = SHIPMENT_STATUS_TRANSITIONS[currentStatus] || [];
  const isTerminal = currentStatus === "cancelled" || currentStatus === "returned";

  const [selectedStatus, setSelectedStatus] = useState(
    validNextStatuses.length > 0 ? validNextStatuses[0] : ""
  );
  const [carrier, setCarrier] = useState(shipment.carrier || "");
  const [trackingNumber, setTrackingNumber] = useState(shipment.trackingNumber || "");
  const [trackingUrl, setTrackingUrl] = useState(shipment.trackingUrl || "");
  const [failureReason, setFailureReason] = useState(shipment.failureReason || "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setSelectedStatus(validNextStatuses.length > 0 ? validNextStatuses[0] : "");
    setCarrier(shipment.carrier || "");
    setTrackingNumber(shipment.trackingNumber || "");
    setTrackingUrl(shipment.trackingUrl || "");
    setFailureReason(shipment.failureReason || "");
    setReason("");
    setNotes("");
    setIsOverride(false);
    setOverrideReason("");
    setErrorMessage("");
  }, [shipment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) {
      setErrorMessage("Please select a target shipment status.");
      return;
    }

    if (isOverride && (!overrideReason || overrideReason.trim().length < 5)) {
      setErrorMessage(
        "A detailed override reason (minimum 5 characters) is required for Superadmin override."
      );
      return;
    }

    if (selectedStatus === "failed" && !failureReason.trim() && !isOverride) {
      setErrorMessage("Please provide a failure reason for failed shipments.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        status: selectedStatus,
        expectedPreviousStatus: currentStatus,
        expectedVersion: typeof shipment.version === "number" ? shipment.version : undefined,
        carrier: carrier.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
        failureReason: selectedStatus === "failed" ? failureReason.trim() : undefined,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
        isOverride: Boolean(isOverride),
        overrideReason: isOverride ? overrideReason.trim() : undefined,
      };

      const shipmentId = shipment._id || shipment.secureId || shipment.id;
      const res = await adminOperationsService.updateShipmentStatus(shipmentId, payload);
      const updatedShipment = res?.data || res;

      toast.success(
        `Shipment ${shipment.shipmentNumber} updated to ${selectedStatus.replace(/_/g, " ").toUpperCase()}`,
        {
          description: isOverride
            ? `Exceptional override logged: ${overrideReason.trim()}`
            : `Transition from ${currentStatus} to ${selectedStatus} recorded.`,
        }
      );

      if (typeof onUpdated === "function") {
        onUpdated(updatedShipment);
      }
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update shipment status.";
      setErrorMessage(msg);
      toast.error("Shipment Update Failed", { description: msg });
      if (err?.response?.status === 409 && typeof onUpdated === "function") {
        setTimeout(() => onUpdated(), 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableStatuses = isOverride ? ALL_TRANSIT_STATUSES : validNextStatuses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in-50 zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#004D38]/10 text-[#004D38] flex items-center justify-center shrink-0">
              <Truck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Update Shipment Status
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Superadmin
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500">
                {shipment.shipmentNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Current State Summary Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Current Authoritative Status:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                currentStatus === "delivered"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : currentStatus === "in_transit" || currentStatus === "out_for_delivery"
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : currentStatus === "cancelled" || currentStatus === "failed"
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : "bg-slate-200 text-slate-800"
              }`}
            >
              {currentStatus.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            {STATUS_DESCRIPTIONS[currentStatus] || "Active consignment state"}
          </p>

          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
            {shipment.carrier && (
              <div>
                Carrier: <strong>{shipment.carrier}</strong>
              </div>
            )}
            {shipment.trackingNumber && (
              <div className="font-mono">
                AWB: <strong>{shipment.trackingNumber}</strong>
              </div>
            )}
            {shipment.warehouseId?.name && (
              <div>
                WH: <strong>{shipment.warehouseId.name}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Superadmin Override Toggle */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-600" />
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Exceptional Superadmin Override
              </div>
              <p className="text-[10px] text-slate-500">
                Bypass standard linear progression for administrative corrections
              </p>
            </div>
          </div>
          <input
            id="shipment-override-checkbox"
            type="checkbox"
            checked={isOverride}
            onChange={(e) => {
              setIsOverride(e.target.checked);
              if (!e.target.checked) setOverrideReason("");
            }}
            className="size-4 rounded border-slate-300 text-[#004D38] focus:ring-[#004D38] cursor-pointer"
          />
        </div>

        {/* Consequential Action Warnings */}
        {selectedStatus === "cancelled" && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              <span>Consequential Inventory &amp; Order Release</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Cancelling will release reserved warehouse stocks back to inventory. If all shipments are cancelled, the parent order will also be marked cancelled.
            </p>
          </div>
        )}

        {selectedStatus === "picked_up" && (
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Truck className="size-4 shrink-0 text-blue-600" />
              <span>Inventory Deduction Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Marking consignment picked up formally deducts reserved items from warehouse stock into sold inventory.
            </p>
          </div>
        )}

        {isOverride && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="size-4 shrink-0 text-amber-600" />
              <span>Administrative Audit Trail Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This status override bypasses normal progressive state machine rules. The event, your administrator ID, and justification notes will be permanently committed to the tamper-evident Audit Log.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Update Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* Target Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target Shipment Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableStatuses.map((st) => {
                const isSelected = selectedStatus === st;
                const isCurrent = st === currentStatus;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => setSelectedStatus(st)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-[#004D38] text-white border-[#004D38] shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="capitalize">{st.replace(/_/g, " ")}</span>
                    {isSelected ? (
                      <Check className="size-3.5" />
                    ) : (
                      <ArrowRight className="size-3 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {!isOverride && availableStatuses.length === 0 && (
              <p className="text-xs text-slate-500 mt-1 italic">
                {isTerminal
                  ? `Shipment is in terminal state '${currentStatus}'. Terminal shipments cannot be mutated.`
                  : "No automated transitions available. Enable Exceptional Override if correction is required."}
              </p>
            )}
          </div>

          {/* Superadmin Override Justification */}
          {isOverride && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Override Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="2"
                required
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Required: Detail why this exceptional status override is required..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
          )}

          {/* Carrier & Tracking Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Carrier Name
              </label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. Delhivery, BlueDart, Bluedart Express"
                className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004D38]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tracking / AWB Number
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. AWB-123456789"
                className="w-full p-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004D38]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Courier Tracking URL (Optional)
            </label>
            <input
              type="url"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://track.carrier.com/..."
              className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004D38]"
            />
          </div>

          {/* Failure Reason if Failed */}
          {selectedStatus === "failed" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Failure Reason <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required={!isOverride}
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="e.g. Customer premises closed, incorrect address..."
                className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {/* Internal Notes / Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Status Change Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional operational context for timeline & audit..."
              className="w-full p-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#004D38]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedStatus && !isOverride)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50 ${
                selectedStatus === "cancelled"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : isOverride
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#004D38] hover:bg-[#003828]"
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Update Shipment Status</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
