"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  FileText,
  User,
  ShieldCheck,
  Calendar,
  Layers,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { adminVendorService } from "../../../../services/admin/vendor.service.js";
import { StatusBadge } from "../../../../components/admin/StatusBadge.jsx";

export default function AdminVendorReviewPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [reasonInput, setReasonInput] = useState("");

  const fetchVendor = useCallback(async () => {
    if (!rawId) return;
    try {
      setLoading(true);
      const data = await adminVendorService.getVendorById(rawId);
      setVendor(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load vendor application details");
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    if (!rawId) return;
    let isMounted = true;
    const run = async () => {
      try {
        const data = await adminVendorService.getVendorById(rawId);
        if (!isMounted) return;
        setVendor(data);
      } catch (err) {
        if (!isMounted) return;
        toast.error(err.response?.data?.message || "Failed to load vendor application details");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [rawId]);

  // Actions
  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const secureOrRawId = vendor?.secureId || rawId;
      await adminVendorService.approveVendor(secureOrRawId);
      toast.success("Merchant application approved! Operational console activated and email notification sent.");
      setShowApproveModal(false);
      fetchVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve merchant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reasonInput || reasonInput.trim().length < 5) {
      toast.error("Please provide a valid rejection reason (minimum 5 characters).");
      return;
    }
    try {
      setActionLoading(true);
      const secureOrRawId = vendor?.secureId || rawId;
      await adminVendorService.rejectVendor(secureOrRawId, reasonInput.trim());
      toast.success("Vendor application rejected. Notification sent with reason.");
      setShowRejectModal(false);
      setReasonInput("");
      fetchVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reasonInput || reasonInput.trim().length < 5) {
      toast.error("Please provide detailed instructions for requested changes (minimum 5 characters).");
      return;
    }
    try {
      setActionLoading(true);
      const secureOrRawId = vendor?.secureId || rawId;
      await adminVendorService.requestChanges(secureOrRawId, reasonInput.trim());
      toast.success("Changes requested from vendor applicant. Instructions sent via email.");
      setShowChangesModal(false);
      setReasonInput("");
      fetchVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request changes");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading vendor review dossier...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-16 text-center">
        <Store className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Vendor Application Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested merchant application does not exist or has been removed.</p>
        <Link
          href="/admin/vendors"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendor Directory
        </Link>
      </div>
    );
  }

  const applicant = vendor.userId || {};
  const applicantName = `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim() || "Unassigned";
  const address = vendor.businessAddress || {};
  const tax = vendor.taxInformation || {};

  return (
    <div className="space-y-6 pb-16 max-w-6xl">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendor Applications
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {vendor.businessName}
            </h1>
            <StatusBadge status={vendor.onboardingStatus} />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Slug: /{vendor.businessSlug} • ID: {vendor.secureId || vendor._id}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {vendor.onboardingStatus !== "approved" && (
            <button
              onClick={() => setShowApproveModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve Merchant
            </button>
          )}

          {vendor.onboardingStatus !== "approved" && (
            <button
              onClick={() => {
                setReasonInput("");
                setShowChangesModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              Request Changes
            </button>
          )}

          {vendor.onboardingStatus !== "rejected" && (
            <button
              onClick={() => {
                setReasonInput("");
                setShowRejectModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Reject Application
            </button>
          )}
        </div>
      </div>

      {/* Status Lifecycle Notice Banners */}
      {vendor.onboardingStatus === "pending" && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Application Pending Review</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
              This merchant is awaiting approval by marketplace operations. Verify their business credentials, tax identifiers, and contact details before activating merchant store access.
            </p>
          </div>
        </div>
      )}

      {vendor.onboardingStatus === "approved" && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Active & Approved Merchant
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">
              Approved on{" "}
              {vendor.approvedAt ? new Date(vendor.approvedAt).toLocaleString() : "Record file"}
              {vendor.approvedBy?.email ? ` by ${vendor.approvedBy.firstName || vendor.approvedBy.email}` : ""}.
              Merchant has full access to products, warehouses, and orders.
            </p>
          </div>
        </div>
      )}

      {vendor.onboardingStatus === "changes_requested" && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Changes Requested from Applicant</h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-1">
              Instructions: &ldquo;{vendor.changesRequestedReason}&rdquo;
            </p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Requested on{" "}
              {vendor.changesRequestedAt ? new Date(vendor.changesRequestedAt).toLocaleString() : "Recent"}
              {vendor.changesRequestedBy?.email ? ` by ${vendor.changesRequestedBy.firstName || vendor.changesRequestedBy.email}` : ""}.
              The applicant can update their store profile and resubmit for review.
            </p>
          </div>
        </div>
      )}

      {vendor.onboardingStatus === "rejected" && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3">
          <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Application Rejected</h4>
            <p className="text-xs text-rose-800 dark:text-rose-300 font-semibold mt-1">
              Reason: &ldquo;{vendor.rejectionReason}&rdquo;
            </p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
              Rejected on{" "}
              {vendor.rejectedAt ? new Date(vendor.rejectedAt).toLocaleString() : "Recent"}
              {vendor.rejectedBy?.email ? ` by ${vendor.rejectedBy.firstName || vendor.rejectedBy.email}` : ""}.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Business Dossier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Business Profile & Documents */}
        <div className="md:col-span-2 space-y-6">
          {/* Business Details Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <Store className="h-4 w-4 text-emerald-600" />
              Store & Company Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Store Display Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 block">
                  {vendor.businessName}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Marketplace Storefront URL</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  /store/{vendor.businessSlug}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Support Contact Email</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {vendor.supportEmail || "None specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Business Phone</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {vendor.phone || "None specified"}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Store Description</span>
                <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  {vendor.description || "No description provided during registration."}
                </p>
              </div>
            </div>
          </div>

          {/* Registered Address Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Registered Business Address
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Street Address</span>
                <span className="text-slate-800 dark:text-slate-200 font-medium mt-0.5 block">
                  {address.street || address.addressLine1 || "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">City</span>
                <span className="text-slate-800 dark:text-slate-200 mt-0.5 block">{address.city || "—"}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">State / Province</span>
                <span className="text-slate-800 dark:text-slate-200 mt-0.5 block">{address.state || "—"}</span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Postal / ZIP Code</span>
                <span className="text-slate-800 dark:text-slate-200 mt-0.5 block font-mono">
                  {address.postalCode || address.zip || "—"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Country</span>
                <span className="text-slate-800 dark:text-slate-200 mt-0.5 block">{address.country || "India"}</span>
              </div>
            </div>
          </div>

          {/* Tax & Compliance Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-emerald-600" />
              Tax & Regulatory Compliance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">GSTIN / VAT ID</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                  {tax.gstin || tax.taxId || "Pending submission"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">PAN Number</span>
                <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                  {tax.pan || tax.panNumber || "Pending submission"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Tax Registration Type</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {tax.businessType || "Regular Taxable Entity"}
                </span>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-medium">Platform Commission</span>
                <span className="text-slate-700 dark:text-slate-300 mt-0.5 block">
                  {vendor.commissionRate !== undefined ? `${vendor.commissionRate}%` : "Standard (0%)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Applicant Account & Marketplace Stats */}
        <div className="space-y-6">
          {/* Applicant User Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-emerald-600" />
              Applicant Account
            </h3>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="h-11 w-11 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm">
                {applicant.firstName?.charAt(0) || "U"}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {applicantName}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {applicant.email || "No email"}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Account Role</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  {applicant.role || "vendor"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Registered On</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString() : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Identity Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Active User
                </span>
              </div>
            </div>
          </div>

          {/* Marketplace Footprint Card */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-emerald-600" />
              Marketplace Footprint
            </h3>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Catalog Products</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                  {vendor.productsCount || 0}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium block">Total Orders</span>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                  {vendor.ordersCount || 0}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
              <p>
                Approved merchants can publish products to the marketplace search index and fulfill customer orders.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* APPROVE CONFIRMATION MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Approve {vendor.businessName}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Approving will immediately grant merchant console access to <strong>{applicant.email}</strong>, activate their store, and send an official welcome & onboarding confirmation email.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REQUEST CHANGES MODAL */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Request Changes from Applicant
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Provide specific instructions or document requirements for <strong>{vendor.businessName}</strong>.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Required Changes / Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. Please upload your valid GSTIN certificate and provide a complete registered business street address with PIN code."
                className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This message will be emailed directly to <strong>{applicant.email}</strong> and displayed on their store settings page.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestChanges}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Send Change Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT APPLICATION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reject Vendor Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Explain why <strong>{vendor.businessName}</strong> cannot be approved for selling on Buybox.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. Ineligible product category / Failed business verification checks."
                className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This reason will be logged in the permanent audit log and sent to the applicant.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
