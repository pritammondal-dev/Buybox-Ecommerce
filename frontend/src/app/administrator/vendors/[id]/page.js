"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  Landmark,
  ShieldAlert,
  KeyRound,
  Lock,
  Trash2,
  Edit,
  AlertCircle,
  FileCheck,
  Download,
  Check,
  X,
  Eye,
  Plus,
  Shield,
  CreditCard,
  Building,
  Package,
  DollarSign,
  Wallet,
  TrendingUp,
  BarChart3,
  Info,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import { adminVendorService } from "../../../../services/admin/vendor.service.js";
import { adminBankAccountService } from "../../../../services/admin/bank-account.service.js";
import { StatusBadge } from "../../../../components/admin/StatusBadge.jsx";
import { ReasonConfirmModal } from "../../../../components/admin/ReasonConfirmModal.jsx";
import { VendorIdBadge } from "../../../../components/admin/VendorIdBadge.jsx";
import { AdminBankAccountCard } from "../../../../components/admin/bank-accounts/AdminBankAccountCard.jsx";
import { AdminAddBankAccountModal } from "../../../../components/admin/bank-accounts/AdminAddBankAccountModal.jsx";
import { AdminEditBankAccountModal } from "../../../../components/admin/bank-accounts/AdminEditBankAccountModal.jsx";
import { PrivilegedUnmaskModal } from "../../../../components/admin/bank-accounts/PrivilegedUnmaskModal.jsx";
import { useAdminAuthStore } from "../../../../stores/admin-auth.store.js";

const TABS = [
  { id: "overview", label: "Overview & KPIs", icon: Layers },
  { id: "profile", label: "Store & Identity", icon: Store },
  { id: "catalog", label: "Product Catalog", icon: Package },
  { id: "orders", label: "Orders & Fulfillment", icon: ShoppingBag },
  { id: "inventory", label: "Inventory & Warehouses", icon: Building },
  { id: "finance", label: "Financial Visibility", icon: CreditCard },
  { id: "bank_accounts", label: "Bank Accounts", icon: Landmark },
  { id: "compliance", label: "Compliance & Audit", icon: FileText },
];

export default function AdminVendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawId = params?.id;

  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canEdit = hasPermission("vendors.edit");
  const canSuspend = hasPermission("vendors.suspend");
  const canApprove = hasPermission("vendors.approve");
  const canResetPassword = hasPermission("vendors.reset_password");
  const canDelete = hasPermission("vendors.delete");
  const canBankView = hasPermission("vendors.bank_accounts.view");
  const canBankManage = hasPermission("vendors.bank_accounts.manage");
  const canBankReview = hasPermission("vendors.bank_accounts.review");
  const canBankApprove = hasPermission("vendors.bank_accounts.approve");
  const canBankReject = hasPermission("vendors.bank_accounts.reject");
  const canBankUnmask = hasPermission("vendors.bank_accounts.view_unmasked");

  // Tab State
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : "overview"
  );

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Overview and Aggregate State
  const [overviewData, setOverviewData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [selectedUnmaskAccount, setSelectedUnmaskAccount] = useState(null);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState(null);
  const [isBankSubmitting, setIsBankSubmitting] = useState(false);

  // KYC Review State
  const [kycActionLoading, setKycActionLoading] = useState(false);
  const [rejectKycModal, setRejectKycModal] = useState(null);
  const [rejectKycReason, setRejectKycReason] = useState("");
  const [downloadingKycId, setDownloadingKycId] = useState(null);

  // Onboarding action modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [reasonInput, setReasonInput] = useState("");

  // Account Lifecycle Modals (ReasonConfirmModal)
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    businessName: "",
    supportEmail: "",
    phone: "",
    description: "",
  });

  const fetchVendorData = useCallback(async () => {
    if (!rawId) return;
    try {
      setLoading(true);
      const [vendorRecord, overview] = await Promise.all([
        adminVendorService.getVendorById(rawId),
        adminVendorService.getVendorOverview(rawId).catch((err) => {
          console.warn("getVendorOverview fallback:", err);
          return null;
        }),
      ]);

      const resolvedVendor = overview?.vendor || vendorRecord?.vendor || vendorRecord;
      setVendor(resolvedVendor);
      setOverviewData(overview);

      if (overview) {
        setKpis(overview.kpis || null);
        setFinancial(overview.financial || null);
        setWallet(overview.wallet || null);
        setPayouts(overview.payouts || []);
        setRecentOrders(overview.recentOrders || []);
        setProducts(overview.products || []);
        setInventory(overview.inventory || []);
        setSettlements(overview.settlements || []);
        setAuditLogs(overview.auditLogs || []);
        if (overview.bankAccounts && Array.isArray(overview.bankAccounts)) {
          setBankAccounts(overview.bankAccounts);
        }
      }

      if (resolvedVendor) {
        setEditFormData({
          businessName: resolvedVendor.businessName || "",
          supportEmail: resolvedVendor.supportEmail || "",
          phone: resolvedVendor.phone || "",
          description: resolvedVendor.description || "",
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load vendor application details");
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  const fetchBankAccounts = useCallback(async () => {
    if (!rawId) return;
    try {
      setLoadingBankAccounts(true);
      const res = await adminBankAccountService.listVendorBankAccounts(rawId);
      const accountsList =
        res?.data?.accounts ||
        res?.accounts ||
        res?.data?.items ||
        (Array.isArray(res?.data) ? res.data : []) ||
        [];
      setBankAccounts(accountsList);
    } catch (err) {
      // Non-critical if vendor doesn't have bank accounts yet
    } finally {
      setLoadingBankAccounts(false);
    }
  }, [rawId]);

  useEffect(() => {
    fetchVendorData();
  }, [fetchVendorData]);

  useEffect(() => {
    if (activeTab === "bank_accounts") {
      fetchBankAccounts();
    }
  }, [activeTab, fetchBankAccounts]);

  const linkedUserId = useMemo(() => {
    if (!vendor) return null;
    if (typeof vendor.userId === "object" && vendor.userId !== null) {
      return vendor.userId._id || vendor.userId.id || null;
    }
    return vendor.userId || null;
  }, [vendor]);

  const applicant = vendor?.userId || {};
  const applicantName = `${applicant.firstName || ""} ${applicant.lastName || ""}`.trim() || "Unassigned";

  const userRoles = useMemo(() => {
    const roles = applicant.roles || (applicant.role ? [applicant.role] : ["vendor"]);
    return Array.isArray(roles) ? roles : [String(roles)];
  }, [applicant]);

  const isMultiRole = userRoles.length > 1;

  // Safe commission rate formatter (never outputs [object Object])
  const effectiveCommissionRate = useMemo(() => {
    if (vendor?.effectiveCommission?.percentage !== undefined) {
      const p = Number(vendor.effectiveCommission.percentage);
      return Number.isFinite(p) ? p : 0;
    }
    if (vendor?.commissionRate !== undefined && vendor?.commissionRate !== null) {
      const raw =
        typeof vendor.commissionRate === "object"
          ? vendor.commissionRate.$numberDecimal || vendor.commissionRate.toString()
          : vendor.commissionRate;
      const num = Number(raw);
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  }, [vendor]);

  // Onboarding Actions
  const handleApprove = async () => {
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.approveVendor(targetId);
      toast.success("Merchant application approved! Operational console activated and email notification sent.");
      setShowApproveModal(false);
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve merchant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reasonInput || reasonInput.trim().length < 5) {
      toast.error("Rejection reason must be at least 5 characters");
      return;
    }
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.rejectVendor(targetId, reasonInput.trim());
      toast.success("Merchant application rejected");
      setShowRejectModal(false);
      setReasonInput("");
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reasonInput || reasonInput.trim().length < 5) {
      toast.error("Required changes instructions must be at least 5 characters");
      return;
    }
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.requestChanges(targetId, reasonInput.trim());
      toast.success("Changes requested. Notification email dispatched to applicant.");
      setShowChangesModal(false);
      setReasonInput("");
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request changes");
    } finally {
      setActionLoading(false);
    }
  };

  // Account Lifecycle Actions
  const handleSuspendConfirm = async ({ reason }) => {
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.suspendVendor(targetId, reason);
      toast.success("Merchant suspended successfully and active sessions invalidated");
      setShowSuspendModal(false);
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to suspend merchant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateConfirm = async ({ reason }) => {
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.reactivateVendor(targetId, reason);
      toast.success("Merchant account reactivated successfully");
      setShowReactivateModal(false);
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reactivate merchant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPasswordConfirm = async ({ reason, extraValues }) => {
    const { newPassword, confirmPassword } = extraValues || {};
    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.resetVendorPassword(targetId, newPassword, reason);
      toast.success("Password reset successfully. Active sessions revoked.");
      setShowResetPasswordModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateConfirm = async ({ reason }) => {
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.deleteVendor(targetId, reason);
      toast.success("Merchant account safely offboarded, active products archived, and vendor sessions invalidated");
      setShowDeactivateModal(false);
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to deactivate merchant");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditProfileSubmit = async ({ reason, extraValues }) => {
    try {
      setActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.updateVendor(targetId, {
        businessName: extraValues?.businessName || editFormData.businessName,
        supportEmail: extraValues?.supportEmail || editFormData.supportEmail,
        phone: extraValues?.phone || editFormData.phone,
        description: extraValues?.description || editFormData.description,
        reason,
      });
      toast.success("Merchant profile updated successfully");
      setShowEditProfileModal(false);
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setActionLoading(false);
    }
  };

  // KYC Actions (VD-04)
  const handleApproveKycDoc = async (documentId) => {
    try {
      setKycActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.reviewKycDocument(targetId, documentId, { status: "approved" });
      toast.success("KYC document verified and approved");
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve document");
    } finally {
      setKycActionLoading(false);
    }
  };

  const handleRejectKycDoc = async () => {
    if (!rejectKycReason || rejectKycReason.trim().length < 5) {
      toast.error("Rejection reason must be at least 5 characters");
      return;
    }
    try {
      setKycActionLoading(true);
      const targetId = vendor?.secureId || rawId;
      await adminVendorService.reviewKycDocument(targetId, rejectKycModal, {
        status: "rejected",
        rejectionReason: rejectKycReason.trim(),
      });
      toast.success("KYC document marked as rejected");
      setRejectKycModal(null);
      setRejectKycReason("");
      fetchVendorData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject document");
    } finally {
      setKycActionLoading(false);
    }
  };

  const handleDownloadKycDoc = async (documentId, filename) => {
    try {
      setDownloadingKycId(documentId);
      const targetId = vendor?.secureId || rawId;
      const blob = await adminVendorService.downloadKycDocument(targetId, documentId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || "kyc-document.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Failed to download KYC document");
    } finally {
      setDownloadingKycId(null);
    }
  };

  // Bank Account Handlers (VB-04)
  const handleAddBankAccount = async (formData) => {
    try {
      setIsBankSubmitting(true);
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.createBankAccount(targetId, formData);
      toast.success("Bank account registered successfully");
      setShowAddBankModal(false);
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create bank account");
    } finally {
      setIsBankSubmitting(false);
    }
  };

  const handleEditBankAccount = async (accountId, formData) => {
    try {
      setIsBankSubmitting(true);
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.updateBankAccount(targetId, accountId, formData);
      toast.success("Bank account updated successfully");
      setEditingBankAccount(null);
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update bank account");
    } finally {
      setIsBankSubmitting(false);
    }
  };

  const handleApproveBankAccount = async (account) => {
    try {
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.reviewBankAccount(targetId, account._id, { status: "approved" });
      toast.success("Bank account approved for payouts");
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve bank account");
    }
  };

  const handleRejectBankAccount = async (account, reason) => {
    try {
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.reviewBankAccount(targetId, account._id, {
        status: "rejected",
        rejectionReason: reason,
      });
      toast.success("Bank account rejected");
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject bank account");
    }
  };

  const handleMarkBankUnderReview = async (account) => {
    try {
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.reviewBankAccount(targetId, account._id, { status: "under_review" });
      toast.success("Bank account moved to under-review queue");
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update review status");
    }
  };

  const handleToggleBankStatus = async (account) => {
    try {
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.toggleStatus(targetId, account._id, !account.isActive, "Admin status toggle");
      toast.success(`Bank account ${account.isActive ? "deactivated" : "activated"}`);
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    }
  };

  const handleDeleteBankAccount = async (account, reason) => {
    try {
      const targetId = vendor?.secureId || rawId;
      await adminBankAccountService.deleteBankAccount(targetId, account._id, reason);
      toast.success("Bank account removed");
      fetchBankAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete bank account");
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center">
        <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Loading Merchant Overview...
        </h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving catalog, financials, and identity records.</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-16 text-center">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Vendor Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          The requested vendor could not be located in the marketplace records.
        </p>
        <Link
          href="/administrator/vendors"
          className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Directory
        </Link>
      </div>
    );
  }

  const address = vendor.businessAddress || {};
  const tax = vendor.taxInformation || {};
  const branding = vendor.branding || {};
  const kycDocs = Array.isArray(vendor.kycDocuments) ? vendor.kycDocuments : [];
  const kycStatus = vendor.kycStatus || "not_submitted";
  const isDeactivated = Boolean(vendor.deletedAt);
  const isSuspended = vendor.onboardingStatus === "suspended";

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/administrator/vendors"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendor Directory
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {vendor.businessName}
            </h1>
            {isDeactivated ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                <XCircle className="h-3.5 w-3.5" /> Deactivated
              </span>
            ) : isSuspended ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Suspended
              </span>
            ) : (
              <StatusBadge status={vendor.onboardingStatus} />
            )}

            {/* Multi-role persona indicator */}
            {isMultiRole ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                <User className="h-3 w-3" /> Multi-Role Account ({userRoles.join(", ")})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Store className="h-3 w-3" /> Merchant Partner
              </span>
            )}

            {/* KYC Status Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                kycStatus === "approved"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : kycStatus === "rejected"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : kycStatus === "pending" || kycStatus === "under_review"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              KYC: {kycStatus.replace("_", " ").toUpperCase()}
            </span>
          </div>

          {/* Header Metadata with VendorIdBadge */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 font-mono mt-2">
            <span>Slug: /{vendor.businessSlug || vendor.slug || "n/a"}</span>
            <span className="text-slate-300">•</span>
            <VendorIdBadge id={vendor.secureId || String(vendor._id || rawId)} />
            <span className="text-slate-300">•</span>
            <span>User ID: {linkedUserId ? String(linkedUserId) : "Unlinked"}</span>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {!isDeactivated && vendor.onboardingStatus !== "approved" && vendor.onboardingStatus !== "suspended" && (
            <>
              {canApprove && (
                <button
                  onClick={() => setShowApproveModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Application
                </button>
              )}
              <button
                onClick={() => {
                  setReasonInput("");
                  setShowChangesModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Request Changes
              </button>
              <button
                onClick={() => {
                  setReasonInput("");
                  setShowRejectModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Reject Application
              </button>
            </>
          )}

          {!isDeactivated && (
            <>
              {canEdit && (
                <button
                  onClick={() => setShowEditProfileModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit Profile
                </button>
              )}

              {canResetPassword && (
                <button
                  onClick={() => setShowResetPasswordModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset Password
                </button>
              )}

              {canSuspend && (
                <>
                  {isSuspended ? (
                    <button
                      onClick={() => setShowReactivateModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Reactivate Merchant
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSuspendModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Suspend Merchant
                    </button>
                  )}
                </>
              )}

              {canDelete && (
                <button
                  onClick={() => setShowDeactivateModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Safe Offboarding
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lifecycle Notice Banners */}
      {isDeactivated && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3">
          <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Merchant Account Safely Soft-Deactivated
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5">
              This merchant account was soft-deactivated. Products have been archived and hidden from the marketplace. Historical orders, payments, shipments, and bank records are permanently preserved.
            </p>
          </div>
        </div>
      )}

      {!isDeactivated && isSuspended && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Merchant Account Suspended</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
              This merchant is suspended. Storefront visibility is paused until reactivation.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-4 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  router.push(`?tab=${tab.id}`, { scroll: false });
                }}
                className={`flex items-center gap-1.5 py-3 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id === "catalog" && products.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                    {products.length}
                  </span>
                )}
                {tab.id === "orders" && (kpis?.totalOrders || vendor.ordersCount) > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                    {kpis?.totalOrders || vendor.ordersCount}
                  </span>
                )}
                {tab.id === "bank_accounts" && bankAccounts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
                    {bankAccounts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW & KPIS
         ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Catalog Products
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {kpis?.totalProducts ?? vendor.productsCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                {kpis?.activeProducts ?? 0} active, {kpis?.pendingProducts ?? 0} draft/pending
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Orders Fulfilled
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {kpis?.totalOrders ?? vendor.ordersCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                {kpis?.cancelledOrders ?? 0} cancelled or expired
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Effective Commission
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {effectiveCommissionRate.toFixed(2)}%
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                {vendor?.effectiveCommission?.policyName || "Standard Marketplace Policy"}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Gross Sales (Delivered/Paid)
              </span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
                ₹{((financial?.grossSales ?? kpis?.totalEarnings ?? 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Authoritative gross platform sales</p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-600" />
                Store Information
              </h3>
              <div className="text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Business Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{vendor.businessName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Storefront URL</span>
                  <Link
                    href={`/stores/${vendor.businessSlug || vendor.slug}`}
                    target="_blank"
                    className="font-mono text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    /stores/{vendor.businessSlug || vendor.slug} <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Support Email</span>
                  <span className="text-slate-800 dark:text-slate-200">{vendor.supportEmail || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Business Phone</span>
                  <span className="text-slate-800 dark:text-slate-200">{vendor.phone || "—"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Applicant & Account Identity
              </h3>
              <div className="text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{applicantName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Login Email</span>
                  <span className="text-slate-800 dark:text-slate-200">{applicant.email || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Account Persona</span>
                  <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {isMultiRole ? `Merchant (Multi-Role: ${userRoles.join(", ")})` : "Merchant Partner"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Member Since</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Orders Preview (first 5) */}
          {recentOrders.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                  Recent Orders Snapshot
                </h3>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold"
                >
                  View All Orders →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Order ID</th>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Vendor Items</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentOrders.slice(0, 5).map((ord) => (
                      <tr key={ord._id || ord.orderId} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          #{ord.orderNumber || String(ord._id).slice(-8)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(ord.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">
                          {ord.customerName || "Customer"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {ord.items?.length || 1} item(s)
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          ₹{Number(ord.vendorSubtotal || ord.total || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={ord.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: STORE & IDENTITY
         ========================================================================= */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-600" />
                Store Branding & Public Profile
              </h3>

              {branding.banner && (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={branding.banner} alt="Store Banner" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex items-center gap-4">
                {branding.logo ? (
                  <img
                    src={branding.logo}
                    alt="Store Logo"
                    className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-lg">
                    {vendor.businessName?.charAt(0) || "S"}
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {branding.displayName || vendor.businessName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {branding.publicContactEmail || vendor.supportEmail || "No public email set"}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-400 block mb-1">Store Bio & Description</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800 leading-relaxed">
                  {branding.description || vendor.description || "No store bio provided."}
                </p>
              </div>

              {branding.policies && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block mb-1">Shipping Policy</span>
                    <p className="text-slate-600 line-clamp-3">
                      {branding.policies.shippingPolicy || "Standard marketplace shipping rules apply."}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block mb-1">Return Policy</span>
                    <p className="text-slate-600 line-clamp-3">
                      {branding.policies.returnPolicy || "Standard 7-day return window applies."}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block mb-1">Refund Policy</span>
                    <p className="text-slate-600 line-clamp-3">
                      {branding.policies.refundPolicy || "Refunds processed within 5-7 business days."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Linked User Account
              </h3>
              <div className="text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{applicantName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-800 dark:text-slate-200">{applicant.email || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-slate-500">Roles</span>
                  <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    {userRoles.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Email Verified</span>
                  <span className={applicant.isEmailVerified ? "text-emerald-600 font-bold" : "text-amber-600"}>
                    {applicant.isEmailVerified ? "Verified" : "Pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PRODUCT CATALOG
         ========================================================================= */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Vendor Product Catalog
              </h3>
              <p className="text-xs text-slate-500">
                Products registered under this merchant store ({products.length} total)
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">No Products Found</h4>
              <p className="text-xs text-slate-500 mt-1">This merchant has not listed any products in the catalog yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Base Price</th>
                    <th className="py-3 px-4">Variants</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Stock Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        <span className="text-[11px] font-mono text-slate-400">/{p.slug}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{p.sku || "—"}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">₹{Number(p.price || 0).toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-600">{p.variants?.length || 0} variant(s)</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 capitalize">{p.stockStatus?.replace("_", " ") || "In Stock"}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/products/${p.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: ORDERS & FULFILLMENT
         ========================================================================= */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Vendor Orders & Fulfillment
              </h3>
              <p className="text-xs text-slate-500">
                Recent orders containing products from this merchant ({recentOrders.length} records shown)
              </p>
            </div>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">No Orders Found</h4>
              <p className="text-xs text-slate-500 mt-1">Customers have not placed orders with this vendor yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer & City</th>
                    <th className="py-3 px-4">Vendor Line Items</th>
                    <th className="py-3 px-4">Vendor Subtotal</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Fulfillment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((ord) => (
                    <tr key={ord._id || ord.orderId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        #{ord.orderNumber || String(ord._id).slice(-8)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(ord.createdAt).toLocaleDateString()}{" "}
                        <span className="text-[10px] text-slate-400">
                          {new Date(ord.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">{ord.customerName || "Customer"}</span>
                        <span className="text-[11px] text-slate-500">{ord.customerCity || "City unlisted"}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ord.items?.length || 1} line item(s)
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        ₹{Number(ord.vendorSubtotal || ord.total || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            ord.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {ord.paymentStatus?.toUpperCase() || "PENDING"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ord.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: INVENTORY & WAREHOUSES
         ========================================================================= */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Stock On Hand
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {kpis?.totalStockOnHand ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Physical units in warehouses</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Low Stock Threshold Alerts
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {kpis?.lowStockCount ?? 0}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Variants near or below reorder level</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Inventory Value
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                ₹{(kpis?.inventoryValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Valuation at variant retail price</p>
            </div>
          </div>

          {inventory.length === 0 ? (
            <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <Building className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">No Warehouse Allocations</h4>
              <p className="text-xs text-slate-500 mt-1">This vendor has not allocated inventory to warehouses yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Variant / SKU</th>
                    <th className="py-3 px-4">Warehouse</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">On Hand</th>
                    <th className="py-3 px-4">Reserved</th>
                    <th className="py-3 px-4">Available</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map((inv) => {
                    const variant = inv.productVariantId || {};
                    const warehouse = inv.warehouseId || {};
                    const onHand = inv.onHand || 0;
                    const reserved = inv.reserved || 0;
                    const available = Math.max(0, onHand - reserved);
                    const isLow = available <= (inv.lowStockThreshold || 5);

                    return (
                      <tr key={inv._id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">
                            {variant.title || variant.variantName || "Variant"}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">{variant.sku || "—"}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {warehouse.name || "Default Hub"}
                          {warehouse.code && <span className="ml-1 text-[10px] font-mono text-slate-400">({warehouse.code})</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {warehouse.city ? `${warehouse.city}, ${warehouse.state || ""}` : "India"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{onHand}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{reserved}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-700">{available}</td>
                        <td className="py-3 px-4">
                          {isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Healthy
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 6: FINANCIAL VISIBILITY
         ========================================================================= */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          {/* Authoritative Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Gross Platform Sales
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                ₹{(financial?.grossSales ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">All non-cancelled customer orders</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Paid Customer Orders
              </span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                ₹{(financial?.paidSales ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Confirmed payments received</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Delivered Order Sales
              </span>
              <span className="text-2xl font-black text-blue-700 mt-1 block">
                ₹{(financial?.deliveredSales ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Orders delivered to customers</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Pending Settlement Earnings
              </span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                ₹{(financial?.pendingEarnings ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Unsettled vendor ledger balances</p>
            </div>
          </div>

          {/* Vendor Wallet & Commission Engine Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vendor Wallet Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" />
                  Vendor Financial Wallet (VW-03)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {wallet?.status?.toUpperCase() || "ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Available Balance</span>
                  <span className="text-lg font-black text-emerald-700 mt-0.5 block">
                    ₹{(wallet?.availableBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Pending Balance</span>
                  <span className="text-lg font-black text-amber-600 mt-0.5 block">
                    ₹{(wallet?.pendingBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Reserved Balance</span>
                  <span className="text-lg font-black text-slate-700 mt-0.5 block">
                    ₹{(wallet?.reservedBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Total Withdrawn</span>
                  <span className="text-lg font-black text-blue-700 mt-0.5 block">
                    ₹{(wallet?.totalWithdrawn ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Authoritative Commission Policy Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-600" />
                Commission Policy Engine (VW-02)
              </h3>

              <div className="text-xs space-y-2">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Effective Rate</span>
                  <span className="text-base font-black text-slate-900">{effectiveCommissionRate.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Resolved Policy Name</span>
                  <span className="font-bold text-slate-800">
                    {vendor?.effectiveCommission?.policyName || "Standard Marketplace Rate"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Resolution Scope</span>
                  <span className="font-mono text-slate-700 capitalize">
                    {vendor?.effectiveCommission?.scope || "vendor"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Policy Source</span>
                  <span className="font-mono text-slate-700 capitalize">
                    {vendor?.effectiveCommission?.source || "vendor_agreement"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cost of Goods Sold (COGS) & Margins Notice */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
            <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Vendor Gross Profit: Not Calculated (COGS Unpopulated)
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Cost of Goods Sold (COGS) tracking is unpopulated on product variants and un-snapshotted on order items. Platform financial services do not fabricate estimated vendor profit margins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: BANK ACCOUNTS & PAYOUTS
         ========================================================================= */}
      {activeTab === "bank_accounts" && (
        <div className="space-y-6">
          {/* Capacity Gauge & Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Landmark className="h-4 w-4 text-emerald-600" />
                Settlement & Payout Bank Accounts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Enforcing standard 3-slot maximum rule per vendor. Encrypted at rest with AES-256-GCM.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-600">
                Slots: <strong className="text-slate-900">{bankAccounts.length} / 3</strong>
              </span>

              {canBankManage && (
                <button
                  onClick={() => setShowAddBankModal(true)}
                  disabled={bankAccounts.length >= 3}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Bank Account
                </button>
              )}
            </div>
          </div>

          {/* Accounts Grid */}
          {loadingBankAccounts ? (
            <div className="p-12 text-center">
              <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading bank accounts...</p>
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <Landmark className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900">No Bank Accounts Registered</h4>
              <p className="text-xs text-slate-500 mt-1">This merchant does not currently have any registered payout accounts.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bankAccounts.map((acc) => (
                <AdminBankAccountCard
                  key={acc._id}
                  account={acc}
                  onApprove={() => handleApproveBankAccount(acc)}
                  onReject={(reason) => handleRejectBankAccount(acc, reason)}
                  onMarkUnderReview={() => handleMarkBankUnderReview(acc)}
                  onUnmask={() => setSelectedUnmaskAccount(acc)}
                  onEdit={() => setEditingBankAccount(acc)}
                  onToggleStatus={() => handleToggleBankStatus(acc)}
                  onDelete={(reason) => handleDeleteBankAccount(acc, reason)}
                  canReview={canBankReview}
                  canApprove={canBankApprove}
                  canReject={canBankReject}
                  canManage={canBankManage}
                  canUnmask={canBankUnmask}
                />
              ))}
            </div>
          )}

          {/* Payout History Section */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Payout Transaction Ledger ({payouts.length} transactions)
            </h3>

            {payouts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No historical payout disbursements recorded for this merchant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Payout #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Destination Account</th>
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((pay) => (
                      <tr key={pay._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {pay.payoutNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(pay.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">
                          ₹{Number(pay.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {pay.bankName ? `${pay.bankName} (${pay.accountNumberMasked || "••••"})` : "Default Bank"}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-slate-600">{pay.provider || "RazorpayX"}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={pay.status} />
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {pay.providerReference || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Bank Account Modal */}
          {showAddBankModal && (
            <AdminAddBankAccountModal
              isOpen={showAddBankModal}
              onClose={() => setShowAddBankModal(false)}
              onSubmit={handleAddBankAccount}
              isSubmitting={isBankSubmitting}
              remainingSlots={3 - bankAccounts.length}
              vendorName={vendor.businessName}
            />
          )}

          {/* Edit Bank Account Modal */}
          {editingBankAccount && (
            <AdminEditBankAccountModal
              isOpen={Boolean(editingBankAccount)}
              onClose={() => setEditingBankAccount(null)}
              onSubmit={(formData) => handleEditBankAccount(editingBankAccount._id, formData)}
              account={editingBankAccount}
              isSubmitting={isBankSubmitting}
            />
          )}

          {/* Privileged Unmask Modal */}
          {selectedUnmaskAccount && (
            <PrivilegedUnmaskModal
              isOpen={Boolean(selectedUnmaskAccount)}
              onClose={() => setSelectedUnmaskAccount(null)}
              account={selectedUnmaskAccount}
              vendorId={vendor.secureId || rawId}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 8: COMPLIANCE & AUDIT
         ========================================================================= */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          {/* Business & Tax Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Registered Business Address
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <span className="text-slate-400 block font-medium">Street</span>
                  <span className="text-slate-800 font-medium">{address.street || address.addressLine1 || "Not specified"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">City</span>
                  <span className="text-slate-800">{address.city || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">State</span>
                  <span className="text-slate-800">{address.state || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">PIN Code</span>
                  <span className="text-slate-800 font-mono">{address.postalCode || address.zip || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Country</span>
                  <span className="text-slate-800">{address.country || "India"}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-emerald-600" />
                Tax & Regulatory Identifiers
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">GSTIN</span>
                  <span className="text-slate-800 font-mono font-bold">
                    {tax.gstin || tax.taxId || "Pending submission"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">PAN</span>
                  <span className="text-slate-800 font-mono font-bold">
                    {tax.pan || tax.panNumber || "Pending submission"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Business Type</span>
                  <span className="text-slate-800">{tax.businessType || "Regular Taxable Entity"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Platform Commission</span>
                  <span className="text-slate-800 font-bold">
                    {effectiveCommissionRate.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* KYC Documents Queue */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Vendor KYC Verification & Compliance Documents
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and verify uploaded regulatory documents for merchant onboarding compliance.
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  kycStatus === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : kycStatus === "rejected"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Overall Status: {kycStatus.replace("_", " ").toUpperCase()}
              </span>
            </div>

            {kycDocs.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                <FileCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No KYC documents submitted yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Type / Number</th>
                      <th className="py-2.5 px-3">Original File</th>
                      <th className="py-2.5 px-3">Uploaded</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kycDocs.map((doc) => {
                      const isDocApproved = doc.status === "approved";
                      const isDocRejected = doc.status === "rejected";

                      return (
                        <tr key={doc._id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900 capitalize">
                            {doc.documentCategory?.replace("_", " ")}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-800 block">{doc.documentType || "—"}</span>
                            {doc.documentNumber && (
                              <span className="font-mono text-[11px] text-slate-500 block">{doc.documentNumber}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            {doc.fileOriginalName || "document.pdf"}
                          </td>
                          <td className="py-3 px-3 text-slate-500 text-[11px]">
                            {doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isDocApproved
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isDocRejected
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {doc.status?.toUpperCase() || "PENDING"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDownloadKycDoc(doc._id, doc.fileOriginalName)}
                                disabled={downloadingKycId === doc._id}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              {!isDocApproved && (
                                <button
                                  onClick={() => handleApproveKycDoc(doc._id)}
                                  disabled={kycActionLoading}
                                  className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md"
                                >
                                  Approve
                                </button>
                              )}
                              {!isDocRejected && (
                                <button
                                  onClick={() => {
                                    setRejectKycModal(doc._id);
                                    setRejectKycReason("");
                                  }}
                                  disabled={kycActionLoading}
                                  className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Administrative Audit Trail */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Administrative Audit Log Trail ({auditLogs.length} entries)
            </h3>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No audit logs recorded for this vendor yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Summary / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <span className="font-bold block">{log.actorName || "System"}</span>
                          <span className="text-[10px] text-slate-400">{log.actorEmail}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {log.reason ? `Reason: ${log.reason}` : log.entityType || "Operation logged"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECT KYC MODAL (Phase VD-04) */}
      {rejectKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject KYC Document</h3>
                <p className="text-xs text-slate-500">Provide a mandatory rejection reason for the merchant.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectKycReason}
                onChange={(e) => setRejectKycReason(e.target.value)}
                placeholder="e.g. Document is blurry or expired. Please upload a clear valid copy."
                className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectKycModal(null);
                  setRejectKycReason("");
                }}
                disabled={kycActionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectKycDoc}
                disabled={kycActionLoading || rejectKycReason.trim().length < 5}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING APPROVE MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">Approve {vendor.businessName}?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Approving will immediately grant merchant console access to <strong>{applicant.email}</strong>, activate their store, and send an onboarding confirmation email.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING REQUEST CHANGES MODAL */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Request Changes from Applicant</h3>
                <p className="text-xs text-slate-500">Provide instructions for <strong>{vendor.businessName}</strong>.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Required Changes / Instructions <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. Please upload your valid GSTIN certificate and provide a complete registered business street address with PIN code."
                className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestChanges}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
              >
                Send Change Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reject Vendor Application</h3>
                <p className="text-xs text-slate-500">Explain why <strong>{vendor.businessName}</strong> cannot be approved.</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Reason for Rejection <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="e.g. Ineligible product category / Failed business verification checks."
                className="w-full text-xs p-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASON CONFIRM MODAL: SUSPEND */}
      <ReasonConfirmModal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        onConfirm={handleSuspendConfirm}
        title="Suspend Merchant Account"
        description="Suspending this merchant will revoke their console access and temporarily pause storefront visibility."
        targetName={vendor.businessName}
        actionType="suspend"
        isDestructive={false}
        confirmButtonText="Confirm Suspension"
        reasonLabel="Administrative Reason for Suspension"
        reasonPlaceholder="e.g. Compliance review underway / Repeated order fulfillment delays."
        isLoading={actionLoading}
      />

      {/* REASON CONFIRM MODAL: REACTIVATE */}
      <ReasonConfirmModal
        isOpen={showReactivateModal}
        onClose={() => setShowReactivateModal(false)}
        onConfirm={handleReactivateConfirm}
        title="Reactivate Merchant Account"
        description="Reactivating this merchant will restore their console login access and reinstate active products to the storefront."
        targetName={vendor.businessName}
        actionType="reactivate"
        isDestructive={false}
        confirmButtonText="Reactivate Merchant"
        reasonLabel="Administrative Reason for Reactivation"
        reasonPlaceholder="e.g. Compliance requirements satisfied / Account verified by marketplace operations."
        isLoading={actionLoading}
      />

      {/* REASON CONFIRM MODAL: RESET PASSWORD */}
      <ReasonConfirmModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onConfirm={handleResetPasswordConfirm}
        title="Reset Merchant Password"
        description="Reset the primary seller login credential for this merchant. Active sessions will be invalidated immediately."
        targetName={vendor.businessName}
        actionType="reset_password"
        isDestructive={true}
        confirmButtonText="Reset Password & Invalidate Sessions"
        reasonLabel="Administrative Reason for Password Reset"
        reasonPlaceholder="e.g. Merchant reported account lockout / Security remediation requested."
        extraFields={[
          {
            name: "newPassword",
            label: "New Secure Password",
            type: "password",
            placeholder: "Minimum 8 chars with uppercase, lowercase, number, symbol",
          },
          {
            name: "confirmPassword",
            label: "Confirm New Password",
            type: "password",
            placeholder: "Re-enter the new secure password",
          },
        ]}
        isLoading={actionLoading}
      />

      {/* REASON CONFIRM MODAL: SOFT-DEACTIVATE */}
      <ReasonConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={handleDeactivateConfirm}
        title="Soft-Deactivate Merchant Account"
        description="Permanently soft-deactivate this merchant account. Products will be archived and hidden from the storefront, while preserving customer shopping access for multi-role accounts and retaining historical orders and ledgers."
        targetName={vendor.businessName}
        actionType="delete"
        isDestructive={true}
        confirmButtonText="Confirm Merchant Deactivation"
        reasonLabel="Mandatory Reason for Deactivation"
        reasonPlaceholder="e.g. Merchant requested store closure / Irrevocable platform policy violation."
        requireAcknowledgment={true}
        acknowledgmentText="I understand that this will safely offboard the vendor, archive all products, deactivate sellable variants, and revoke vendor console access while preserving customer account access and audit history."
        isLoading={actionLoading}
      />

      {/* REASON CONFIRM MODAL: EDIT BUSINESS PROFILE */}
      <ReasonConfirmModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        onConfirm={handleEditProfileSubmit}
        title="Edit Vendor Business Profile"
        description="Update the merchant's business information and contact details. An administrative reason is required for audit logs."
        targetName={vendor.businessName}
        actionType="edit"
        isDestructive={false}
        confirmButtonText="Save Profile Changes"
        reasonLabel="Administrative Reason for Profile Update"
        reasonPlaceholder="e.g. Merchant submitted updated business registration / Support ticket change request."
        extraFields={[
          {
            name: "businessName",
            label: "Business Name",
            type: "text",
            placeholder: editFormData.businessName,
          },
          {
            name: "supportEmail",
            label: "Support Email",
            type: "text",
            placeholder: editFormData.supportEmail,
          },
          {
            name: "phone",
            label: "Contact Phone",
            type: "text",
            placeholder: editFormData.phone,
          },
          {
            name: "description",
            label: "Store Description",
            type: "text",
            placeholder: editFormData.description,
          },
        ]}
        isLoading={actionLoading}
      />
    </div>
  );
}
