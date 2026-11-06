"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Calendar,
  Download,
  ExternalLink,
  ShieldAlert,
  Ban,
  Check,
  RotateCcw,
  FileText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";
import { VendorStatusBadge } from "@/components/vendor";

export default function VendorShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params?.id;

  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [isDownloadingLabel, setIsDownloadingLabel] = useState(false);

  // Modals
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState("10:00-13:00");
  const [pickupNotes, setPickupNotes] = useState("");
  const [isSubmittingPickup, setIsSubmittingPickup] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState("ready_to_ship");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const fetchShipment = async () => {
    if (!shipmentId) return;
    try {
      const res = await vendorService.getMyShipmentById(shipmentId);
      const data = res?.data?.data || res?.data?.shipment || res?.data;
      setShipment(data);
      if (data?.trackingNumber) {
        setTrackingNumberInput(data.trackingNumber);
      }
    } catch (err) {
      toast.error("Failed to load shipment details", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShipment();
  }, [shipmentId]);

  // Label Download
  const handleDownloadLabel = async () => {
    try {
      setIsDownloadingLabel(true);
      const res = await vendorService.getShipmentLabel(shipment.secureId || shipment._id);
      const labelUrl = res?.data?.data?.labelUrl || res?.data?.labelUrl || shipment.labelUrl;

      if (labelUrl) {
        window.open(labelUrl, "_blank", "noopener,noreferrer");
        toast.success("Shipping label opened in new tab");
      } else {
        toast.info("Standard packing manifest generated", {
          description: "Use the Packing Slip option for standard merchant fulfillment label.",
        });
        setShowPackingSlip(true);
      }
    } catch (err) {
      toast.error("Label generation failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsDownloadingLabel(false);
    }
  };

  // Schedule Pickup Handler
  const handleSchedulePickup = async (e) => {
    e.preventDefault();
    if (!pickupDate) {
      toast.error("Please select a pickup date");
      return;
    }

    try {
      setIsSubmittingPickup(true);
      await vendorService.scheduleShipmentPickup(shipment.secureId || shipment._id, {
        scheduledDate: pickupDate,
        timeSlot: pickupSlot,
        notes: pickupNotes,
      });
      toast.success("Carrier pickup scheduled successfully");
      setShowPickupModal(false);
      fetchShipment();
    } catch (err) {
      toast.error("Pickup scheduling failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingPickup(false);
    }
  };

  // Status Handover Handler
  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingStatus(true);
      await vendorService.updateShipmentStatus(shipment.secureId || shipment._id, {
        status: targetStatus,
        trackingNumber: trackingNumberInput || undefined,
        notes: statusNotes || undefined,
      });
      toast.success("Shipment status updated successfully");
      setShowStatusModal(false);
      fetchShipment();
    } catch (err) {
      toast.error("Status update failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Cancel Shipment Handler
  const handleCancelShipment = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast.error("Please specify a cancellation reason");
      return;
    }

    try {
      setIsSubmittingCancel(true);
      await vendorService.cancelShipment(shipment.secureId || shipment._id, {
        reason: cancelReason.trim(),
      });
      toast.success("Shipment cancelled and inventory reservation restored");
      setShowCancelModal(false);
      fetchShipment();
    } catch (err) {
      toast.error("Shipment cancellation failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-200 rounded-3xl animate-pulse" />
        <div className="h-80 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertTriangle className="size-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Shipment Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          This shipment does not exist or does not belong to your vendor account.
        </p>
        <Link
          href="/vendor/shipments"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] text-white text-xs font-semibold"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Shipments</span>
        </Link>
      </div>
    );
  }

  const events = shipment.trackingEvents || shipment.events || shipment.trackingHistory || [];
  const isTerminal = ["delivered", "cancelled", "returned", "rto_delivered"].includes(shipment.status);
  const isException = ["exception", "failed", "rto_initiated", "rto_in_transit"].includes(shipment.status);
  const pickup = shipment.pickupSchedule;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/vendor/shipments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-3"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Shipments</span>
        </Link>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {shipment.awbNumber || shipment.trackingNumber || shipment.shipmentNumber}
              </h1>
              <VendorStatusBadge status={shipment.status} entityType="shipment" />
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>Carrier: <strong className="text-slate-800 uppercase">{shipment.carrier || "Standard"}</strong></span>
              <span>•</span>
              <span>Ref: {shipment.shipmentNumber}</span>
              {shipment.trackingUrl && (
                <>
                  <span>•</span>
                  <a
                    href={shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                  >
                    <span>Carrier Portal</span>
                    <ExternalLink className="size-3" />
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={() => setShowPackingSlip(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Packing Slip</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadLabel}
              disabled={isDownloadingLabel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="size-3.5 text-emerald-600" />
              <span>{isDownloadingLabel ? "Loading..." : "Shipping Label"}</span>
            </button>

            {!isTerminal && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPickupModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
                >
                  <Calendar className="size-3.5 text-blue-600" />
                  <span>Schedule Pickup</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStatusModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#004D38] hover:bg-[#003d2c] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Truck className="size-3.5" />
                  <span>Update / Handover</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
                  title="Cancel Shipment"
                >
                  <Ban className="size-3.5" />
                  <span>Cancel</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Exception / RTO Alert Banner */}
      {isException && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <h4 className="font-bold text-amber-900">Fulfillment Alert: {shipment.status.toUpperCase()}</h4>
            <p className="text-amber-800 mt-0.5">
              {shipment.failureReason ||
                shipment.exceptionDetails?.reason ||
                "Carrier reported a delivery exception or return-to-origin event. Inspect the tracking timeline below for courier scans."}
            </p>
          </div>
        </div>
      )}

      {/* Grid: Package Dossier, Destination, Pickup Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Package Dossier */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Package className="size-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Package Dossier</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">AWB Code</span>
              <span className="font-mono font-bold text-slate-900">{shipment.awbNumber || shipment.trackingNumber || "N/A"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Logistics Partner</span>
              <span className="font-semibold text-slate-800 uppercase">{shipment.carrier || "Standard"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Package Weight</span>
              <span className="font-medium text-slate-800">{shipment.packageDetails?.weightGrams ? `${shipment.packageDetails.weightGrams}g` : "500g"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Manifest Date</span>
              <span className="text-slate-700">{shipment.createdAt ? new Date(shipment.createdAt).toLocaleDateString("en-IN") : "N/A"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Expected Delivery</span>
              <span className="text-slate-700 font-semibold">{shipment.expectedDeliveryDate ? new Date(shipment.expectedDeliveryDate).toLocaleDateString("en-IN") : "TBD"}</span>
            </div>
          </div>
        </div>

        {/* Shipping Destination */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="size-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Consignee &amp; Address</h3>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed space-y-1">
            <p className="font-bold text-slate-900 text-sm">{shipment.shippingAddress?.fullName || "Recipient"}</p>
            <p className="text-slate-600">Phone: {shipment.shippingAddress?.phone || "N/A"}</p>
            <div className="pt-1 text-slate-600 border-t border-slate-100">
              <p>{shipment.shippingAddress?.addressLine1}</p>
              {shipment.shippingAddress?.addressLine2 && <p>{shipment.shippingAddress.addressLine2}</p>}
              <p>{[shipment.shippingAddress?.city, shipment.shippingAddress?.state, shipment.shippingAddress?.postalCode].filter(Boolean).join(", ")}</p>
              <p className="font-semibold text-slate-800">{shipment.shippingAddress?.country || "India"}</p>
            </div>
          </div>
        </div>

        {/* Carrier Pickup Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="size-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Pickup Handover</h3>
          </div>
          {pickup && pickup.status && pickup.status !== "unassigned" ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Pickup Status</span>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {pickup.status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Scheduled Date</span>
                <span className="font-semibold text-slate-800">
                  {pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleDateString("en-IN") : "Today"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Time Window</span>
                <span className="text-slate-700">{pickup.timeSlot || "10:00-13:00"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Pickup Token</span>
                <span className="font-mono font-bold text-slate-900">{pickup.pickupToken || "Assigned"}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-4 text-center">
              <p>No carrier pickup scheduled yet.</p>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setShowPickupModal(true)}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:underline"
                >
                  Schedule Courier Pickup &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manifest Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Consigned Order Items ({shipment.items?.length || 0})</h3>
          <span className="text-xs text-slate-500">Parent Order ID: {shipment.orderId?._id || shipment.orderId}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3">Product Name</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(shipment.items || []).map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5 font-medium text-slate-900">{it.name}</td>
                  <td className="px-6 py-3.5 font-mono text-slate-500">{it.sku}</td>
                  <td className="px-6 py-3.5 text-right font-bold text-slate-900">{it.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Milestone Tracking Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Milestone Tracking Timeline</h3>
          <span className="text-xs text-slate-400">{events.length} event(s) recorded</span>
        </div>

        {events.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
            Package has been manifested. Tracking milestones will populate as the carrier scans this parcel in their distribution network.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((evt, idx) => (
              <div key={idx} className="relative flex items-start gap-3">
                <div className="absolute -left-6 top-1 size-3 rounded-full bg-emerald-600 ring-4 ring-emerald-50" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {evt.status || evt.description}
                    </span>
                    {evt.source && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {evt.source}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{evt.description}</p>
                  <div className="text-[11px] text-slate-400">
                    {evt.location && <span>{evt.location} • </span>}
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleString("en-IN") : "Recorded"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Pickup Modal */}
      {showPickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Schedule Courier Pickup</h3>
              <button
                type="button"
                onClick={() => setShowPickupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSchedulePickup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pickup Date
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setPickupDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time Slot
                </label>
                <select
                  value={pickupSlot}
                  onChange={(e) => setPickupSlot(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="10:00-13:00">Morning (10:00 AM - 01:00 PM)</option>
                  <option value="14:00-18:00">Afternoon (02:00 PM - 06:00 PM)</option>
                  <option value="18:00-21:00">Evening (06:00 PM - 09:00 PM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Driver Instructions / Notes (Optional)
                </label>
                <textarea
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  rows={2}
                  placeholder="Gate instructions, warehouse dock number..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPickupModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPickup}
                  className="px-4 py-1.5 rounded-xl bg-[#004D38] text-white text-xs font-semibold hover:bg-[#003d2c] disabled:opacity-50"
                >
                  {isSubmittingPickup ? "Scheduling..." : "Confirm Pickup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Handover Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Update Shipment Status</h3>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Lifecycle Milestone
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="ready_to_ship">Ready to Ship (Packed &amp; Manifested)</option>
                  <option value="picked_up">Picked Up (Handed over to carrier)</option>
                  <option value="in_transit">In Transit</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered to Consignee</option>
                  <option value="failed">Delivery Failed / Attempt Unsuccessful</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AWB / Tracking Number (Optional)
                </label>
                <input
                  type="text"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  placeholder="Carrier waybill number"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dispatch Notes
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={2}
                  placeholder="Handover notes, manifest sign-off..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className="px-4 py-1.5 rounded-xl bg-[#004D38] text-white text-xs font-semibold hover:bg-[#003d2c] disabled:opacity-50"
                >
                  {isSubmittingStatus ? "Updating..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Shipment Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="size-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">Cancel Shipment</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this shipment? If the parcel has not been picked up by the courier, reserved inventory will be safely released.
            </p>

            <form onSubmit={handleCancelShipment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason (Required)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Customer address issue, damaged stock, courier cancellation..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Keep Shipment
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmittingCancel ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Packing Slip Modal */}
      {showPackingSlip && (
        <PackingSlipModal
          isOpen={showPackingSlip}
          onClose={() => setShowPackingSlip(false)}
          fetchSlip={() => vendorService.getShipmentPackingSlip(shipment.secureId || shipment._id)}
        />
      )}
    </div>
  );
}
