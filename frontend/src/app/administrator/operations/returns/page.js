"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  Calendar,
  Filter,
  DollarSign,
  Clock,
  ShieldAlert,
  ArrowRightLeft,
} from "lucide-react";
import { adminOperationsService, adminInventoryService } from "@/services/admin/admin.service.js";
import { formatCurrency } from "@/utils/formatCurrency.js";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [kpis, setKpis] = useState({});
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refundStatusFilter, setRefundStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Action Modals
  const [activeModal, setActiveModal] = useState(null);
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

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 20,
      };
      if (statusFilter !== "all") params.status = statusFilter;
      if (refundStatusFilter !== "all") params.refundStatus = refundStatusFilter;
      if (paymentMethodFilter !== "all") params.paymentMethod = paymentMethodFilter;
      if (reasonFilter !== "all") params.reason = reasonFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (orderNumberFilter.trim()) params.orderNumber = orderNumberFilter.trim();
      if (customerFilter.trim()) params.customer = customerFilter.trim();
      if (vendorFilter.trim()) params.vendor = vendorFilter.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await adminOperationsService.listReturns(params);
      const itemsList = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setReturns(Array.isArray(itemsList) ? itemsList : []);
      if (res?.meta) {
        setMeta(res.meta);
      }
      if (res?.kpis || res?.meta?.kpis) {
        setKpis(res.kpis || res.meta.kpis);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load return requests"
      );
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    statusFilter,
    refundStatusFilter,
    paymentMethodFilter,
    reasonFilter,
    searchTerm,
    orderNumberFilter,
    customerFilter,
    vendorFilter,
    startDate,
    endDate,
  ]);

  const fetchWarehouses = async () => {
    try {
      const res = await adminInventoryService.listWarehouses();
      const itemsList = res?.items || res?.warehouses || res?.data || res || [];
      const whList = Array.isArray(itemsList) ? itemsList : [];
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
  }, [fetchReturns]);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleResetFilters = () => {
    setSearchTerm("");
    setOrderNumberFilter("");
    setCustomerFilter("");
    setVendorFilter("");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setRefundStatusFilter("all");
    setPaymentMethodFilter("all");
    setReasonFilter("all");
    setCurrentPage(1);
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReturn) return;
    setSubmitting(true);
    setError(null);
    try {
      const returnId = selectedReturn._id;
      if (activeModal === "approve") {
        await adminOperationsService.approveReturn(returnId, actionNotes.trim() || "Approved by Superadmin");
        setSuccess("Return request approved");
      } else if (activeModal === "reject") {
        await adminOperationsService.rejectReturn(returnId, actionNotes.trim() || "Declined by Superadmin");
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
        await adminOperationsService.refundReturn(returnId, actionNotes.trim() || "Refund authorized by Superadmin");
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
            Complete marketplace governance over reverse logistics, technical inspection outcomes, warehouse restock, and refund disbursements.
          </p>
        </div>

        <button
          onClick={fetchReturns}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Data</span>
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

      {/* PHASE 8: OPERATIONAL KPIS DASHBOARD (14 AUTHORITATIVE METRICS) */}
      <div className="space-y-3">
        {/* Row 1: Lifecycle Volume & State Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Returns
            </span>
            <strong className="text-xl font-black text-slate-900 mt-0.5 block">
              {kpis.totalReturns ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">All Marketplace RMAs</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">
              Pending Vendor
            </span>
            <strong className="text-xl font-black text-blue-700 mt-0.5 block">
              {kpis.pendingVendorDecisions ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">Awaiting Merchant</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/30">
            <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider flex items-center gap-1">
              <ShieldAlert className="size-3 text-amber-600" /> Superadmin Interventions
            </span>
            <strong className="text-xl font-black text-amber-800 mt-0.5 block">
              {kpis.pendingSuperadminInterventions ?? 0}
            </strong>
            <span className="text-[10px] text-amber-700/80">Suspended / Failed / Escalated</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
              Accepted Returns
            </span>
            <strong className="text-xl font-black text-emerald-700 mt-0.5 block">
              {kpis.acceptedReturns ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">Approved for Return</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider">
              Rejected Returns
            </span>
            <strong className="text-xl font-black text-rose-700 mt-0.5 block">
              {kpis.rejectedReturns ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">Declined by Policy</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-purple-600 block tracking-wider">
              Pickup Pending
            </span>
            <strong className="text-xl font-black text-purple-700 mt-0.5 block">
              {kpis.pickupPending ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">In Courier Dispatch</span>
          </div>
        </div>

        {/* Row 2: Reverse Logistics & Inspection Pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-indigo-600 block tracking-wider">
              Inspection Pending
            </span>
            <strong className="text-xl font-black text-indigo-700 mt-0.5 block">
              {kpis.inspectionPending ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">At Hub / Quality Check</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
              Refund Pending
            </span>
            <strong className="text-xl font-black text-amber-700 mt-0.5 block">
              {kpis.refundPending ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">Awaiting Disbursement</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">
              Refund Processing
            </span>
            <strong className="text-xl font-black text-blue-700 mt-0.5 block">
              {kpis.refundProcessing ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">In Gateway Pipeline</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
              Refund Completed
            </span>
            <strong className="text-xl font-black text-emerald-700 mt-0.5 block">
              {kpis.refundCompleted ?? 0}
            </strong>
            <span className="text-[10px] text-slate-400">Disbursed to Customer</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs bg-rose-50/30">
            <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
              Refund Failed
            </span>
            <strong className="text-xl font-black text-rose-800 mt-0.5 block">
              {kpis.refundFailed ?? 0}
            </strong>
            <span className="text-[10px] text-rose-700/80">Retry Action Needed</span>
          </div>
        </div>

        {/* Row 3: Financial Liabilities Reconciliation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-sm border border-slate-700">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 block tracking-wider">
              Total Authorized Refund Liability
            </span>
            <strong className="text-2xl font-black text-white mt-1 block">
              {formatCurrency(kpis.totalAuthorizedLiability || 0)}
            </strong>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Cumulative gross liability for approved returns
            </span>
          </div>

          <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 text-white p-5 rounded-3xl shadow-sm border border-emerald-800">
            <span className="text-[10px] uppercase font-extrabold text-emerald-300 block tracking-wider">
              Total Successfully Refunded
            </span>
            <strong className="text-2xl font-black text-emerald-400 mt-1 block">
              {formatCurrency(kpis.totalSuccessfullyRefunded || 0)}
            </strong>
            <span className="text-[11px] text-emerald-200/80 mt-0.5 block">
              Authoritatively credited back to customers
            </span>
          </div>

          <div className="bg-gradient-to-r from-amber-950 to-amber-900 text-white p-5 rounded-3xl shadow-sm border border-amber-800">
            <span className="text-[10px] uppercase font-extrabold text-amber-300 block tracking-wider">
              Outstanding Refund Liability
            </span>
            <strong className="text-2xl font-black text-amber-400 mt-1 block">
              {formatCurrency(kpis.outstandingRefundLiability || 0)}
            </strong>
            <span className="text-[11px] text-amber-200/80 mt-0.5 block">
              Active pending refund payout pipeline
            </span>
          </div>
        </div>
      </div>

      {/* ADVANCED MULTI-PARAMETER FILTER CONSOLE */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-[#004D38]" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Filter Return Queue
            </span>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs text-[#004D38] font-semibold hover:underline cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Term */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Return / Order #</label>
            <div className="relative">
              <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search Return # or Order #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Customer */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Customer Name / Email</label>
            <input
              type="text"
              placeholder="e.g. John Doe / user@example.com"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            />
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vendor / Store Name</label>
            <input
              type="text"
              placeholder="Filter by merchant store..."
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            />
          </div>

          {/* Return Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Return Lifecycle Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            >
              <option value="all">All Return Statuses</option>
              <option value="requested">Requested</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pickup_scheduled">Pickup Scheduled</option>
              <option value="picked_up">Picked Up</option>
              <option value="received">Received at Hub</option>
              <option value="inspected">Quality Inspected</option>
              <option value="refund_pending">Refund Pending</option>
              <option value="refunded">Refund Completed</option>
              <option value="exchange_completed">Exchange Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Refund Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Refund Status</label>
            <select
              value={refundStatusFilter}
              onChange={(e) => setRefundStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            >
              <option value="all">All Refund States</option>
              <option value="refunded">Refund Processed</option>
              <option value="refund_pending">Refund Initiated / Pending</option>
              <option value="failed">Refund Failed (Retry Needed)</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            >
              <option value="all">All Payment Methods</option>
              <option value="razorpay">Razorpay (Cards / UPI / NetBanking)</option>
              <option value="paypal">PayPal</option>
              <option value="cod">Cash on Delivery (COD)</option>
              <option value="card">Credit / Debit Card</option>
              <option value="upi">UPI Transfer</option>
            </select>
          </div>

          {/* Return Reason */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Return Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
            >
              <option value="all">All Return Reasons</option>
              <option value="damaged_item">Damaged Item</option>
              <option value="defective_product">Defective Product</option>
              <option value="wrong_item">Wrong Item Delivered</option>
              <option value="missing_parts">Missing Parts</option>
              <option value="not_as_described">Not as Described</option>
              <option value="quality_issue">Quality Issue</option>
              <option value="size_fit_issue">Size / Fit Issue</option>
              <option value="changed_mind">Changed Mind</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Date Range: Start & End */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden"
              />
            </div>
          </div>
        </div>
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
            <p className="text-sm font-medium">No return requests matching your filter criteria.</p>
          </div>
        ) : (
          returns.map((ret) => {
            const isExchange = ret.type === "exchange";

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
                      {ret.customerId?.firstName
                        ? `${ret.customerId.firstName} ${ret.customerId.lastName}`
                        : ret.customer?.name || "Customer"}
                      {ret.vendor && (
                        <span>
                          {" "}• Store: <strong className="text-slate-800 font-semibold">{ret.vendor.storeName}</strong>
                          <span
                            className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                              ret.vendorStatus === "suspended"
                                ? "bg-rose-100 text-rose-700"
                                : ret.vendorStatus === "inactive"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {ret.vendorStatus || "active"}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/administrator/operations/returns/${ret.secureId || ret._id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Eye className="size-3.5" />
                      <span>View Dossier</span>
                    </Link>
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
                          Decline
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
                        className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Confirm Handover
                      </button>
                    )}
                    {["picked_up", "received"].includes(ret.status) && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("inspect");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}
                    {ret.status === "inspected" && !isExchange && (
                      <button
                        onClick={() => {
                          setSelectedReturn(ret);
                          setActiveModal("refund");
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                      >
                        Disburse Refund
                      </button>
                    )}
                  </div>
                </div>

                {/* Items Summary Strip */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      {ret.items?.length || 1} Item(s) Subject to Return:
                    </span>
                    <span className="text-slate-500">
                      {ret.items?.map((it) => `${it.name || it.productName || it.sku} (x${it.quantity || 1})`).join(", ")}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900">
                    Refund Amount: <strong className="text-emerald-700 font-black">{formatCurrency(ret.refundAmount || 0)}</strong>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 text-xs">
          <span className="text-slate-500">
            Showing Page <strong>{meta.page}</strong> of <strong>{meta.totalPages}</strong> ({meta.total} Total Returns)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {activeModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 capitalize">
                {activeModal.replace(/_/g, " ")}: Return #{selectedReturn.returnNumber || selectedReturn._id.slice(-8)}
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

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Authorization Notes</label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Enter administrative notes for audit logging..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#004D38] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedReturn(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Confirm Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
