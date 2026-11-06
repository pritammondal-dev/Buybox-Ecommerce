"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Truck,
  Boxes,
  CreditCard,
  Camera,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { adminOperationsService, adminInventoryService } from "@/services/admin/admin.service.js";
import { formatCurrency } from "@/utils/formatCurrency.js";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  // Action Modals
  const [activeModal, setActiveModal] = useState(null); // 'approve' | 'reject' | 'schedule_pickup' | 'inspect' | 'exchange' | 'refund'
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [actionNotes, setActionNotes] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form states for modal actions
  const [pickupCarrier, setPickupCarrier] = useState("DELHIVERY");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupSlot, setPickupSlot] = useState("10:00 AM - 01:00 PM");

  const [inspectOutcome, setInspectOutcome] = useState("passed");
  const [inspectCondition, setInspectCondition] = useState("unopened");
  const [inspectRestock, setInspectRestock] = useState(true);

  const [exchangeCarrier, setExchangeCarrier] = useState("DELHIVERY");
  const [exchangeTracking, setExchangeTracking] = useState("");
  const [exchangeDays, setExchangeDays] = useState(3);

  const [previewImage, setPreviewImage] = useState(null);

  const fetchReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await adminOperationsService.listReturns(params);
      const items = res?.items || res?.data || res || [];
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
      const items = res?.items || res?.warehouses || res?.data || res || [];
      const whList = Array.isArray(items) ? items : [];
      setWarehouses(whList);
      if (whList.length > 0) {
        setSelectedWarehouseId(whList[0]._id || whList[0].id);
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
        setSuccess("Return request approved");
      } else if (activeModal === "reject") {
        await adminOperationsService.rejectReturn(returnId, actionNotes.trim());
        setSuccess("Return request rejected");
      } else if (activeModal === "schedule_pickup") {
        await adminOperationsService.scheduleReturnPickup(returnId, {
          carrier: pickupCarrier,
          scheduledDate: pickupDate || undefined,
          timeSlot: pickupSlot,
          notes: actionNotes.trim() || undefined,
        });
        setSuccess("Reverse courier pickup scheduled");
      } else if (activeModal === "confirm_pickup") {
        await adminOperationsService.confirmReturnPickup(returnId, {
          notes: actionNotes.trim() || "Courier collected return package from customer",
        });
        setSuccess("Pickup handover confirmed");
      } else if (activeModal === "inspect") {
        await adminOperationsService.inspectReturn(returnId, {
          outcome: inspectOutcome,
          condition: inspectCondition,
          restock: inspectRestock,
          warehouseId: inspectRestock ? selectedWarehouseId || undefined : undefined,
          notes: actionNotes.trim() || undefined,
        });
        setSuccess("Technical inspection recorded and inventory updated");
      } else if (activeModal === "exchange") {
        await adminOperationsService.fulfillExchange(returnId, {
          carrier: exchangeCarrier,
          trackingNumber: exchangeTracking.trim() || undefined,
          expectedDeliveryDays: Number(exchangeDays) || 3,
        });
        setSuccess("Replacement shipment dispatched and exchange fulfilled");
      } else if (activeModal === "refund") {
        await adminOperationsService.refundReturn(returnId, actionNotes.trim());
        setSuccess("Customer refund processed successfully");
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
            <span>Customer Return &amp; Exchange Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Governance over reverse pickups, technical inspection outcomes, warehouse restock, and refund disbursements
          </p>
        </div>

        <button
          onClick={fetchReturns}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
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
          "approved",
          "pickup_scheduled",
          "picked_up",
          "inspected",
          "refunded",
          "exchange_completed",
          "rejected",
        ].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
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
          returns.map((ret) => {
            const isExchange = ret.type === "exchange";
            const photos = ret.images || [];

            return (
              <div
                key={ret._id}
                className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        Return #{ret.returnNumber || ret._id.slice(-8).toUpperCase()}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {ret.status?.replace(/_/g, " ")}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#004D38] border border-emerald-200">
                        {ret.type || "return"}
                      </span>
                      <span className="text-xs text-slate-400">
                        • Filed on {new Date(ret.createdAt).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Order: #{ret.orderId?.orderNumber || ret.orderNumber || "Order"} • Customer:{" "}
                      {ret.customerId?.firstName ? `${ret.customerId.firstName} ${ret.customerId.lastName}` : "Customer"}
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {ret.status === "requested" && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedReturn(ret);
                            setActiveModal("approve");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedReturn(ret);
                            setActiveModal("reject");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {ret.status === "approved" && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("schedule_pickup");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Schedule Pickup
                      </button>
                    )}

                    {ret.status === "pickup_scheduled" && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("confirm_pickup");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Handover
                      </button>
                    )}

                    {["picked_up", "item_received"].includes(ret.status) && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("inspect");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Quality Inspection
                      </button>
                    )}

                    {ret.status === "inspected" && isExchange && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("exchange");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Dispatch Replacement
                      </button>
                    )}

                    {["inspected", "refund_pending"].includes(ret.status) && !isExchange && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("refund");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Issue Refund
                      </button>
                    )}
                  </div>
                </div>

                {/* Reverse Logistics & Doorstep Pickup Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="font-bold text-slate-800 block">Customer Stated Reason:</span>
                    <p className="text-slate-600 italic text-[11px]">
                      {ret.customerNotes || ret.reason || "Customer return request"}
                    </p>
                    {ret.pickupAddress && (
                      <p className="text-[11px] text-slate-500 pt-1">
                        Pickup: {ret.pickupAddress.street || ret.pickupAddress.addressLine1}, {ret.pickupAddress.city} - {ret.pickupAddress.postalCode}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="font-bold text-slate-800 block">Financial &amp; Reverse Tracking:</span>
                    <div className="flex justify-between items-center text-[11px] text-slate-600">
                      <span>Refund Amount:</span>
                      <strong className="text-slate-900 font-bold">
                        {formatCurrency(Number(ret.refundAmount?.toString?.() || 0))}
                      </strong>
                    </div>
                    {ret.reversePickupSchedule && (
                      <div className="flex justify-between items-center text-[11px] text-blue-800">
                        <span>Pickup Token:</span>
                        <strong className="font-mono">{ret.reversePickupSchedule.pickupToken}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Defect Photo Gallery */}
                {photos.length > 0 && (
                  <div className="pt-2 flex items-center gap-2 overflow-x-auto">
                    {photos.map((p, pIdx) => {
                      const u = typeof p === "string" ? p : p.url;
                      return (
                        <div
                          key={pIdx}
                          onClick={() => setPreviewImage(u)}
                          className="relative size-14 shrink-0 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 cursor-pointer hover:opacity-80"
                        >
                          <Image src={u} alt={`Evidence ${pIdx + 1}`} fill className="object-cover" sizes="56px" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Items List */}
                {ret.items?.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {ret.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">{it.name || it.title || "Product item"}</div>
                            <div className="text-[11px] text-slate-400">
                              Reason: {it.reason || ret.customerNotes || "Not specified"} • Condition: {it.condition || "unopened"}
                            </div>
                          </div>
                          <div className="font-bold text-slate-700">Qty: {it.quantity || 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Action Dialog */}
      {activeModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {activeModal === "schedule_pickup"
                  ? "Schedule Reverse Logistics Pickup"
                  : activeModal === "inspect"
                  ? "Technical Quality Inspection"
                  : activeModal === "exchange"
                  ? "Dispatch Replacement Unit"
                  : `${activeModal.replace(/_/g, " ")} Return Request`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedReturn(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
              {activeModal === "schedule_pickup" && (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Carrier Partner</label>
                    <select
                      value={pickupCarrier}
                      onChange={(e) => setPickupCarrier(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    >
                      <option value="DELHIVERY">Delhivery Logistics</option>
                      <option value="BLUEDART">Blue Dart</option>
                      <option value="EKART">Ekart Logistics</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Pickup Date</label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Pickup Window</label>
                    <select
                      value={pickupSlot}
                      onChange={(e) => setPickupSlot(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    >
                      <option value="10:00 AM - 01:00 PM">Morning (10:00 AM - 01:00 PM)</option>
                      <option value="02:00 PM - 06:00 PM">Afternoon (02:00 PM - 06:00 PM)</option>
                    </select>
                  </div>
                </>
              )}

              {activeModal === "inspect" && (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Inspection Outcome</label>
                    <select
                      value={inspectOutcome}
                      onChange={(e) => {
                        setInspectOutcome(e.target.value);
                        setInspectRestock(e.target.value === "passed");
                      }}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    >
                      <option value="passed">Passed (Resellable)</option>
                      <option value="failed">Failed (Quarantine / Scrap)</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Verified Condition</label>
                    <select
                      value={inspectCondition}
                      onChange={(e) => setInspectCondition(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    >
                      <option value="unopened">Unopened / Sealed box</option>
                      <option value="opened_unused">Opened but unused</option>
                      <option value="defective">Defective / Malfunctioning</option>
                      <option value="damaged">Physically damaged</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border">
                    <input
                      type="checkbox"
                      id="adminRestockCheck"
                      checked={inspectRestock}
                      onChange={(e) => setInspectRestock(e.target.checked)}
                      className="rounded text-[#004D38] focus:ring-[#004D38]"
                    />
                    <label htmlFor="adminRestockCheck" className="text-slate-800 font-semibold cursor-pointer">
                      Restock units to sellable warehouse inventory
                    </label>
                  </div>

                  {inspectRestock && warehouses.length > 0 && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Destination Warehouse</label>
                      <select
                        value={selectedWarehouseId}
                        onChange={(e) => setSelectedWarehouseId(e.target.value)}
                        className="w-full p-2.5 rounded-xl border bg-white"
                      >
                        {warehouses.map((w) => (
                          <option key={w._id || w.id} value={w._id || w.id}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {activeModal === "exchange" && (
                <>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Carrier Partner</label>
                    <select
                      value={exchangeCarrier}
                      onChange={(e) => setExchangeCarrier(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white"
                    >
                      <option value="DELHIVERY">Delhivery</option>
                      <option value="BLUEDART">Blue Dart</option>
                      <option value="EKART">Ekart</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Tracking Number</label>
                    <input
                      type="text"
                      placeholder="e.g. DEL-EX-998271"
                      value={exchangeTracking}
                      onChange={(e) => setExchangeTracking(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Operational Notes / Reason
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Notes recorded for internal audit and customer history..."
                  rows={2}
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
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-white bg-[#004D38] hover:bg-[#003829] rounded-xl font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview */}
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
