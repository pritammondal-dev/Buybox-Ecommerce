"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Truck,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  Printer,
  Calendar,
  Box,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import { getVendorShipmentUrl } from "@/utils/secure-id.util";
import { triggerBlobDownload } from "@/utils/fileDownload";
import PackingSlipModal from "@/components/fulfillment/PackingSlipModal";
import VendorTablePagination from "@/components/vendor/VendorTablePagination";
import {
  VendorPageHeader,
  VendorStatusBadge,
  VendorEmptyState,
} from "@/components/vendor";

const CARRIERS = [
  { id: "all", label: "All Carriers" },
  { id: "delhivery", label: "Delhivery" },
  { id: "shiprocket", label: "Shiprocket" },
  { id: "bluedart", label: "Blue Dart" },
  { id: "dtdc", label: "DTDC" },
  { id: "indiapost", label: "India Post" },
  { id: "custom", label: "Merchant Fleet / Custom" },
];

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "created", label: "Created" },
  { id: "ready_to_ship", label: "Ready to Ship" },
  { id: "pickup_scheduled", label: "Pickup Scheduled" },
  { id: "in_transit", label: "In Transit" },
  { id: "out_for_delivery", label: "Out for Delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "booking_failed", label: "Failed Booking" },
  { id: "exception", label: "Exceptions" },
  { id: "cancelled", label: "Cancelled" },
];

export default function VendorShipmentsPage() {
  const [shipments, setShipments] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [status, setStatus] = useState("all");
  const [carrier, setCarrier] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [activePackingSlipId, setActivePackingSlipId] = useState(null);

  const fetchShipmentsData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const params = { page, limit };
      if (status !== "all") params.status = status;
      if (carrier !== "all") params.carrier = carrier;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.getMyShipments(params);
      const data = res?.data?.data || res?.data?.shipments || res?.data || [];
      const items = Array.isArray(data) ? data : data.items || [];
      const paginationMeta = res?.data?.meta || {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit) || 1,
      };
      setShipments(items);
      setMeta(paginationMeta);
    } catch (err) {
      if (err.status === 403 || err.status === 404 || err.response?.status === 403 || err.response?.status === 404) {
        setShipments([]);
        setMeta({ page: 1, limit: 20, total: 0, totalPages: 1 });
        return;
      }
      const errMsg = err.response?.data?.message || err.message || "Failed to load shipments";
      setFetchError(errMsg);
      toast.error("Failed to load shipments", {
        description: errMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryBooking = async (shpId) => {
    setRetryingId(shpId);
    try {
      const res = await vendorService.retryShipmentBooking(shpId);
      const updated = res?.data?.data || res?.data;
      if (updated?.status === "booked") {
        toast.success(`Shipment booked with carrier! AWB: ${updated.awbNumber}`);
      } else if (updated?.bookingDetails?.status === "not_configured") {
        toast.info("Carrier API not configured in environment.");
      } else {
        toast.error(`Booking retry failed: ${updated?.bookingDetails?.errorMessage || "Unknown error"}`);
      }
      await fetchShipmentsData();
    } catch (err) {
      toast.error("Courier booking retry failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => {
    fetchShipmentsData();
  }, [status, carrier, search, page, limit]);

  const handleExport = async (format = "csv") => {
    try {
      setIsExporting(true);
      setShowExportDropdown(false);
      const params = { format };
      if (status !== "all") params.status = status;
      if (carrier !== "all") params.carrier = carrier;
      if (search.trim()) params.search = search.trim();

      const res = await vendorService.exportMyShipments(params, format);
      const ext = format === "xlsx" ? "xlsx" : "csv";
      triggerBlobDownload(res, `vendor-shipments-${new Date().toISOString().slice(0, 10)}.${ext}`);
      toast.success(`Exported vendor shipments (${format.toUpperCase()}) successfully`);
    } catch (err) {
      toast.error("Export failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <VendorPageHeader
        title="Shipment Operations"
        subtitle="Outbound fulfillment packages, carrier integrations, and live tracking milestones."
        breadcrumbs={[{ label: "Shipments" }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchShipmentsData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh Shipments</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportDropdown((prev) => !prev)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-700 bg-[#004D38] text-white hover:bg-[#003d2c] text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Download className="size-3.5" />
                <span>{isExporting ? "Exporting..." : "Export"}</span>
                <ChevronDown className="size-3.5 opacity-70" />
              </button>

              {showExportDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Scoped Shipments
                    </div>
                    <button
                      onClick={() => handleExport("csv")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileText className="size-3.5 text-emerald-600" />
                      <span>Shipment Manifest (CSV)</span>
                    </button>
                    <button
                      onClick={() => handleExport("xlsx")}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="size-3.5 text-blue-600" />
                      <span>Shipment Manifest (XLSX)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      {/* Controls & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search AWB or shipment #..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {/* Carrier Dropdown */}
          <div className="relative w-full sm:w-56">
            <select
              value={carrier}
              onChange={(e) => {
                setCarrier(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              {CARRIERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {STATUS_TABS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStatus(s.id);
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                status === s.id
                  ? "bg-[#004D38] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="p-12 text-center">
            <AlertTriangle className="size-8 text-rose-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">Failed to Load Shipments</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">{fetchError}</p>
            <button
              onClick={fetchShipmentsData}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
            >
              <RefreshCw className="size-3" />
              <span>Retry</span>
            </button>
          </div>
        ) : shipments.length === 0 ? (
          <VendorEmptyState
            icon={Truck}
            title={search || status !== "all" || carrier !== "all" ? "No Shipments Found" : "No Shipments Yet"}
            description={
              search || status !== "all" || carrier !== "all"
                ? "No shipments match your current filters. Try resetting your search or filter parameters."
                : "When orders are fulfilled and booked with integrated couriers, their parcels and live AWB coordinates will appear here."
            }
            action={
              search || status !== "all" || carrier !== "all"
                ? {
                    label: "Clear Filters",
                    onClick: () => {
                      setSearch("");
                      setStatus("all");
                      setCarrier("all");
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="px-6 py-3.5">AWB / Shipment #</th>
                  <th className="px-6 py-3.5">Carrier Partner</th>
                  <th className="px-6 py-3.5">Lifecycle Status</th>
                  <th className="px-6 py-3.5">Package Contents</th>
                  <th className="px-6 py-3.5">Schedule &amp; Dates</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shipments.map((s) => {
                  const secureUrl = getVendorShipmentUrl(s.secureId || s._id);
                  const awbDisplay = s.awbNumber || s.trackingNumber || s.shipmentNumber;
                  const pickup = s.pickupSchedule?.scheduledDate;
                  const delivery = s.deliveredAt || s.expectedDeliveryDate;
                  const needsBooking = s.status === "booking_failed" || (!s.awbNumber && ["created", "booking_pending"].includes(s.status));
                  const isRetrying = retryingId === (s.secureId || s._id);

                  return (
                    <tr key={s._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">
                          <Link href={secureUrl} className="hover:text-emerald-700 hover:underline">
                            {awbDisplay}
                          </Link>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Ref: {s.shipmentNumber}</span>
                          {s.providerType === "manual" && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold text-[10px]">Manual</span>
                          )}
                        </div>
                        {s.bookingDetails?.errorMessage && (
                          <div className="text-[10px] text-amber-700 font-medium truncate max-w-[200px] mt-0.5" title={s.bookingDetails.errorMessage}>
                            {s.bookingDetails.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 uppercase">
                          {s.carrier || s.courier || "Integrated Courier"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Level: {s.serviceLevel || "Standard"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <VendorStatusBadge status={s.status} entityType="shipment" />
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-medium">
                          {s.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 1} unit(s)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {s.packageDetails?.weightGrams ? `${s.packageDetails.weightGrams}g` : "Standard parcel"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {pickup && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="size-3 text-slate-400" />
                            <span>Pickup: {new Date(pickup).toLocaleDateString("en-IN")}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="size-3 text-slate-400" />
                          <span>
                            {s.status === "delivered" ? "Delivered: " : "Est. Delivery: "}
                            {delivery ? new Date(delivery).toLocaleDateString("en-IN") : "TBD"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {needsBooking && (
                            <button
                              type="button"
                              disabled={isRetrying}
                              onClick={() => handleRetryBooking(s.secureId || s._id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                              title="Retry Carrier Booking"
                            >
                              <RefreshCw className={`size-3 ${isRetrying ? "animate-spin" : ""}`} />
                              <span>{s.status === "booking_failed" ? "Retry" : "Book"}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActivePackingSlipId(s.secureId || s._id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                            title="Print Packing Slip"
                          >
                            <Printer className="size-3 text-slate-400" />
                            <span>Slip</span>
                          </button>
                          <Link
                            href={secureUrl}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60"
                          >
                            <span>Manage</span>
                            <ChevronRight className="size-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <VendorTablePagination
              page={page}
              limit={limit}
              total={meta?.total ?? shipments.length}
              totalPages={meta?.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              onLimitChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
              isLoading={isLoading}
              itemLabel="shipments"
            />
          </div>
        )}
      </div>

      {/* Packing Slip Modal */}
      {activePackingSlipId && (
        <PackingSlipModal
          isOpen={Boolean(activePackingSlipId)}
          onClose={() => setActivePackingSlipId(null)}
          fetchSlip={() => vendorService.getShipmentPackingSlip(activePackingSlipId)}
        />
      )}
    </div>
  );
}
