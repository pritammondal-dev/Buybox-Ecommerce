"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ReasonConfirmModal } from "@/components/admin/ReasonConfirmModal.jsx";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Clock,
  ExternalLink,
  Gift,
  Edit,
  DollarSign,
  Ticket,
  CreditCard,
  PackageCheck,
  Ban,
  Hourglass,
  Tag,
  X,
  MapPin,
  Home,
  Building,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { adminCustomerService } from "@/services/admin/customer.service.js";
import { useAdminAuthStore } from "@/stores/admin-auth.store.js";

export default function CustomerDetailPage() {
  const hasPermission = useAdminAuthStore((state) => state.hasPermission);
  const canEdit = hasPermission("customers.edit");
  const canSuspend = hasPermission("customers.suspend");
  const canResetPassword = hasPermission("customers.reset_password");
  const canDelete = hasPermission("customers.delete");

  const params = useParams();
  const router = useRouter();
  const customerId = params?.id;

  const [customer, setCustomer] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [giftCards, setGiftCards] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [couponRedemptions, setCouponRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftForm, setGiftForm] = useState({ amount: "", notes: "", expiresAt: "" });
  const [giftSubmitting, setGiftSubmitting] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", isActive: true, reason: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [modalError, setModalError] = useState(null);

  const fetchCustomer = async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminCustomerService.get(customerId);
      const custObj =
        data?.customer ||
        data?.data?.customer ||
        (data?.firstName || data?.email || data?._id || data?.id ? data : null) ||
        data?.data ||
        data;

      if (!custObj || (!custObj.firstName && !custObj.email && !custObj._id && !custObj.id)) {
        throw new Error("Customer profile could not be found.");
      }

      setCustomer(custObj);
      setKpis(custObj?.kpis || data?.kpis || null);
      setOrders(custObj?.orders || data?.orders || []);
      setReturns(custObj?.returns || data?.returns || []);
      setGiftCards(custObj?.giftCards || data?.giftCards || []);
      setAddresses(custObj?.addresses || data?.addresses || []);
      setCouponRedemptions(
        custObj?.coupons ||
        custObj?.couponRedemptions ||
        data?.coupons ||
        data?.couponRedemptions ||
        []
      );

      setEditForm({
        firstName: custObj.firstName || "",
        lastName: custObj.lastName || "",
        phone: custObj.profile?.phone || custObj.phone || "",
        isActive: custObj.isActive !== undefined ? custObj.isActive : true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load customer profile"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  // Status Confirmation Dialog State
  const handleToggleStatus = () => {
    if (!customer) return;
    setModalError(null);
    setStatusConfirmOpen(true);
  };

  const handleConfirmToggleStatus = async ({ reason }) => {
    if (!customer) return;
    const isSuspending = customer.isActive;
    const action = isSuspending ? "suspend" : "reactivate";

    setActionLoading(true);
    setModalError(null);
    try {
      if (isSuspending) {
        await adminCustomerService.suspend(customer._id || customer.id, reason);
      } else {
        await adminCustomerService.reactivate(customer._id || customer.id, reason);
      }
      toast.success(`Customer ${action}ed successfully and active sessions updated.`);
      setActionSuccess(`Customer ${action}ed successfully`);
      setTimeout(() => setActionSuccess(null), 4000);
      setCustomer((prev) => (prev ? { ...prev, isActive: !isSuspending } : null));
      setStatusConfirmOpen(false);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || `Failed to ${action} customer`;
      setModalError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPasswordReset = async ({ reason }) => {
    if (!customer) return;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      setModalError("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
      return;
    }

    setActionLoading(true);
    setModalError(null);
    try {
      await adminCustomerService.resetPassword(customer._id || customer.id, newPassword, reason);
      toast.success("Customer password has been reset securely and active sessions invalidated.");
      setActionSuccess("Customer password reset successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      setShowResetPasswordModal(false);
      setNewPassword("");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to reset password";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeactivate = async ({ reason }) => {
    if (!customer) return;
    setActionLoading(true);
    setModalError(null);
    try {
      await adminCustomerService.delete(customer._id || customer.id, reason);
      toast.success("Customer account permanently deleted successfully.");
      setShowDeactivateModal(false);
      router.push("/administrator/customers");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to delete customer account";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendGift = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(giftForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid gift card amount greater than 0");
      return;
    }

    setGiftSubmitting(true);
    try {
      await adminCustomerService.issueGiftCard(customer._id || customer.id, {
        amount: amountNum,
        notes: giftForm.notes,
        expiresAt: giftForm.expiresAt || undefined,
      });
      setShowGiftModal(false);
      setGiftForm({ amount: "", notes: "", expiresAt: "" });
      toast.success(`Gift card of ₹${amountNum.toLocaleString("en-IN")} issued successfully to ${customer.firstName}!`);
      setActionSuccess(`Gift card of ₹${amountNum.toLocaleString("en-IN")} issued successfully to ${customer.firstName}!`);
      setTimeout(() => setActionSuccess(null), 5000);
      fetchCustomer();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to issue gift card");
    } finally {
      setGiftSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.reason || editForm.reason.trim().length < 10) {
      toast.error("Administrative reason must be at least 10 characters long");
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        firstName: editForm.firstName.trim() || undefined,
        lastName: editForm.lastName.trim() || undefined,
        phone: editForm.phone ? editForm.phone.trim() : null,
        isActive: Boolean(editForm.isActive),
        reason: editForm.reason.trim(),
      };
      await adminCustomerService.update(customer._id || customer.id, payload);
      setShowEditModal(false);
      toast.success("Customer details updated successfully");
      setActionSuccess("Customer details updated successfully");
      setTimeout(() => setActionSuccess(null), 4000);
      fetchCustomer();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update customer");
    } finally {
      setEditSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded-lg" />
        <div className="h-44 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-3xl" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link
          href="/administrator/customers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Customers</span>
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertTriangle className="size-5 shrink-0" />
          <span>{error || "Customer profile could not be found."}</span>
        </div>
      </div>
    );
  }

  const k = kpis || {
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
    completedOrders: orders.filter((o) => o.status === "delivered").length,
    cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
    returnedOrders: returns.length,
    pendingOrders: orders.filter((o) => ["pending", "confirmed", "processing"].includes(o.status)).length,
    giftCardBalance: 0,
    couponUsage: 0,
    availableCoupons: 0,
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/administrator/customers"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#004D38] transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Customer Directory</span>
        </Link>
        <button
          onClick={fetchCustomer}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 shadow-xs">
          <CheckCircle className="size-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Customer Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="size-20 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-[#004D38] font-bold text-2xl shadow-inner">
              {customer.avatar ? (
                <NextImage
                  src={customer.avatar}
                  alt={customer.firstName || "Customer avatar"}
                  width={80}
                  height={80}
                  className="size-full rounded-2xl object-cover"
                  unoptimized
                />
              ) : (
                <span>
                  {customer.firstName?.[0]}
                  {customer.lastName?.[0]}
                </span>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {customer.firstName} {customer.lastName}
                </h1>
                {customer.deletedAt ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="size-1.5 rounded-full bg-slate-500" />
                    Deactivated / Archived
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${
                      customer.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        customer.isActive ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    />
                    {customer.isActive ? "Active Account" : "Suspended"}
                  </span>
                )}
                {customer.isEmailVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <CheckCircle className="size-3" />
                    Verified Email
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-500 mt-1.5 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5 text-slate-400" />
                  {customer.email}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-slate-400" />
                  {customer.profile?.phone || customer.phone || "No phone added"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-mono text-slate-400">
                  ID: #{String(customer._id || customer.id).slice(-8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowGiftModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors"
            >
              <Gift className="size-3.5" />
              <span>Send Gift</span>
            </button>

            {canEdit && !customer.deletedAt && (
              <button
                onClick={() => {
                  setEditForm({
                    firstName: customer.firstName || "",
                    lastName: customer.lastName || "",
                    phone: customer.profile?.phone || customer.phone || "",
                    isActive: customer.isActive !== undefined ? customer.isActive : true,
                    reason: "",
                  });
                  setShowEditModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                <Edit className="size-3.5" />
                <span>Edit Profile</span>
              </button>
            )}

            {canResetPassword && !customer.deletedAt && (
              <button
                onClick={() => {
                  setNewPassword("");
                  setModalError(null);
                  setShowResetPasswordModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
              >
                <Lock className="size-3.5" />
                <span>Reset Password</span>
              </button>
            )}

            {canSuspend && !customer.deletedAt && (
              <button
                onClick={handleToggleStatus}
                disabled={actionLoading}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  customer.isActive
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {customer.isActive ? "Suspend" : "Reactivate"}
              </button>
            )}

            {canDelete && !customer.deletedAt && (
              <button
                onClick={() => {
                  setModalError(null);
                  setShowDeactivateModal(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
              >
                <Trash2 className="size-3.5" />
                <span>Permanently Delete Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Soft-Deactivation Info Banner */}
        {customer.deletedAt && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-3">
            <Shield className="size-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-slate-900">
                Account Soft-Deactivated
              </span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                This customer account was deactivated on {new Date(customer.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. Account authentication and active cart sessions have been revoked. Historical orders, payments, refunds, and addresses are preserved in the system for auditing and regulatory compliance.
              </p>
            </div>
          </div>
        )}

        {/* Info Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div>
            <div className="text-slate-400 font-medium">Customer ID</div>
            <div className="font-mono font-semibold text-slate-800 mt-0.5 truncate">
              {customer._id || customer.id}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Registration Date</div>
            <div className="font-medium text-slate-800 mt-0.5">
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Last Login</div>
            <div className="font-medium text-slate-800 mt-0.5">
              {customer.lastLoginAt
                ? new Date(customer.lastLoginAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </div>
          </div>
          <div>
            <div className="text-slate-400 font-medium">Gift Card Balance</div>
            <div className="font-bold text-[#004D38] mt-0.5 text-sm">
              {formatCurrency(k.giftCardBalance)}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards (9 Live Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="size-4 text-[#004D38]" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.totalOrders}</div>
          <div className="text-[11px] text-slate-400 mt-1">Lifetime purchases</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Spent</span>
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-[#004D38]">{formatCurrency(k.totalSpent)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Gross order value</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Completed</span>
            <PackageCheck className="size-4 text-teal-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.completedOrders}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Delivered successfully</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending</span>
            <Hourglass className="size-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.pendingOrders}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">In processing / transit</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cancelled</span>
            <Ban className="size-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.cancelledOrders}</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">Cancelled orders</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Returned</span>
            <RotateCcw className="size-4 text-orange-500" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.returnedOrders}</div>
          <div className="text-[11px] text-orange-600 font-medium mt-1">Returns / refunds</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gift Balance</span>
            <Gift className="size-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-700">{formatCurrency(k.giftCardBalance)}</div>
          <div className="text-[11px] text-slate-400 mt-1">Available credit</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Coupon Usage</span>
            <Ticket className="size-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.couponUsage}</div>
          <div className="text-[11px] text-slate-400 mt-1">Coupons redeemed</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Available Coupons</span>
            <Tag className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900">{k.availableCoupons}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Eligible active coupons</div>
        </div>
      </div>

      {/* Order History Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="size-4 text-[#004D38]" />
            <span>Customer Order History ({orders.length})</span>
          </h2>
          <div className="flex items-center gap-3">
            <Link
              href={`/administrator/operations/orders?customer=${encodeURIComponent(customerId)}`}
              className="text-xs font-semibold text-[#004D38] hover:underline flex items-center gap-1"
            >
              <span>View All Orders</span>
              <ExternalLink className="size-3" />
            </Link>
            <Link
              href={`/administrator/catalog/reviews?customer=${encodeURIComponent(customerId)}`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>View Reviews</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No orders placed by this customer yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Order Number</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Fulfillment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {orders.map((ord) => (
                  <tr key={ord._id || ord.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      #{ord.orderNumber || String(ord._id || ord.id).slice(-8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {ord.itemsSummary || (ord.items?.length ? `${ord.items.length} item(s)` : "1 order")}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatCurrency(ord.grandTotal || ord.totalAmount || 0)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ord.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : ord.paymentStatus === "pending"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {ord.paymentStatus || "pending"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          ord.status === "delivered"
                            ? "bg-teal-50 text-teal-700 border border-teal-200"
                            : ord.status === "cancelled"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {ord.status || "processing"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-600 text-[11px]">
                        {ord.fulfillmentStatus || ord.shippingStatus || "standard"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/administrator/operations/orders/${ord._id || ord.id}`}
                        className="inline-flex items-center gap-1 text-[#004D38] hover:underline font-semibold"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Saved Delivery & Billing Addresses */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="size-4 text-emerald-600" />
            <span>Saved Delivery &amp; Billing Addresses ({addresses.length})</span>
          </h2>
        </div>

        {addresses.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No saved delivery or billing addresses on file for this customer.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addresses.map((addr, idx) => (
              <div
                key={addr._id || idx}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-2.5 text-xs text-slate-600"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {addr.addressType === "work" ? (
                      <Building className="size-3.5 text-slate-500" />
                    ) : (
                      <Home className="size-3.5 text-slate-500" />
                    )}
                    <span className="capitalize">{addr.addressType || "Delivery Address"}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {addr.isDefaultShipping && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Default Shipping
                      </span>
                    )}
                    {addr.isDefaultBilling && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Default Billing
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {addr.fullName || addr.name || `${customer.firstName} ${customer.lastName}`}
                  </div>
                  {addr.phone && (
                    <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="size-3 text-slate-400" />
                      <span>{addr.phone}</span>
                    </div>
                  )}
                </div>

                <div className="text-slate-700 leading-relaxed">
                  <div>{addr.street || addr.addressLine1 || addr.address || "—"}</div>
                  {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                  <div className="font-medium text-slate-900 mt-1">
                    {[addr.city, addr.state, addr.postalCode || addr.pincode, addr.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gift Cards Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Gift className="size-4 text-purple-600" />
            <span>Associated Gift Cards ({giftCards.length})</span>
          </h2>
          <button
            onClick={() => setShowGiftModal(true)}
            className="text-xs font-semibold text-[#004D38] hover:underline flex items-center gap-1"
          >
            <span>+ Send Gift Card</span>
          </button>
        </div>

        {giftCards.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No gift cards associated with this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Card Code</th>
                  <th className="py-3 px-4">Initial Balance</th>
                  <th className="py-3 px-4">Current Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {giftCards.map((gc) => (
                  <tr key={gc._id || gc.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {gc.code ? `••••-••••-${gc.code.slice(-4)}` : "GIFT-CARD"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{formatCurrency(gc.initialBalance || gc.amount)}</td>
                    <td className="py-3 px-4 font-bold text-[#004D38]">{formatCurrency(gc.currentBalance || gc.balance)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        gc.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {gc.status || "active"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {gc.createdAt ? new Date(gc.createdAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {gc.expiresAt ? new Date(gc.expiresAt).toLocaleDateString("en-IN") : "No expiry"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Coupon Information & Redemption History */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="size-4 text-emerald-600" />
            <span>Coupon Usage &amp; Redemptions ({couponRedemptions.length})</span>
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Total Redeemed: <strong>{k.couponUsage}</strong></span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold">Available Eligible: <strong>{k.availableCoupons}</strong></span>
          </div>
        </div>

        {couponRedemptions.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No coupon redemption records for this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount Applied</th>
                  <th className="py-3 px-4">Order Reference</th>
                  <th className="py-3 px-4">Redemption Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {couponRedemptions.map((cr, idx) => (
                  <tr key={cr._id || idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {cr.couponCode || cr.code || "COUPON"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#004D38]">
                      {formatCurrency(cr.discountAmount || cr.discount || 0)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {cr.orderId ? (
                        <Link
                          href={`/administrator/operations/orders/${cr.orderId}`}
                          className="text-emerald-700 hover:underline"
                        >
                          #{String(cr.orderId).slice(-8).toUpperCase()}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {cr.createdAt ? new Date(cr.createdAt).toLocaleDateString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Return Requests Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <RotateCcw className="size-4 text-[#004D38]" />
          <span>Return &amp; Refund Requests ({returns.length})</span>
        </h2>

        {returns.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            No return requests filed by this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Return ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {returns.map((ret) => (
                  <tr key={ret._id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      #{ret._id.slice(-8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(ret.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{ret.type || "refund"}</td>
                    <td className="py-3 px-4 text-slate-500">{ret.reason || "Customer requested"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send Gift Card Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                  <Gift className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Send Gift Card</h3>
                  <p className="text-xs text-slate-500">Issue store credit to {customer.firstName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowGiftModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSendGift} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Amount (INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={giftForm.amount}
                    onChange={(e) => setGiftForm({ ...giftForm, amount: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Message / Internal Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={giftForm.notes}
                  onChange={(e) => setGiftForm({ ...giftForm, notes: e.target.value })}
                  placeholder="e.g. Welcome bonus / Customer satisfaction credit"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={giftForm.expiresAt}
                  onChange={(e) => setGiftForm({ ...giftForm, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGiftModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={giftSubmitting}
                  className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {giftSubmitting ? "Issuing..." : "Confirm & Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-[#004D38] rounded-xl">
                  <Edit className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Customer Profile</h3>
                  <p className="text-xs text-slate-500">Update account profile information (strict allowlist)</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editForm.isActive ? "true" : "false"}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                >
                  <option value="true">Active</option>
                  <option value="false">Suspended</option>
                </select>
              </div>

              {/* Mandatory Administrative Reason */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <span>Administrative Justification</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono font-semibold ${
                      editForm.reason.length === 0
                        ? "text-slate-400"
                        : editForm.reason.trim().length < 10
                        ? "text-amber-600"
                        : editForm.reason.length > 500
                        ? "text-rose-600 font-bold"
                        : "text-emerald-600"
                    }`}
                  >
                    {editForm.reason.length} / 500 chars {editForm.reason.trim().length < 10 && "(min 10)"}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={editForm.reason}
                  onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  placeholder="Required administrative reason for modifying this customer profile (min 10 chars)..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] text-xs"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <Shield className="size-4 shrink-0 text-amber-600" />
                <span>Security Notice: Password and authentication credentials are protected and cannot be altered directly via profile editing.</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || editForm.reason.trim().length < 10 || editForm.reason.length > 500}
                  className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Suspension / Reactivation Modal */}
      <ReasonConfirmModal
        isOpen={statusConfirmOpen}
        onClose={() => {
          setStatusConfirmOpen(false);
          setModalError(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        isLoading={actionLoading}
        errorMessage={modalError}
        targetIdentity={`${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""})`.trim()}
        actionType={customer?.isActive ? "suspend" : "reactivate"}
        title={`${customer?.isActive ? "Suspend" : "Reactivate"} Customer Account`}
        description={
          customer?.isActive
            ? "Suspension revokes active customer login tokens and refresh sessions immediately, and disables storefront checkout access."
            : "Reactivating restores login eligibility and allows the customer to place new marketplace orders."
        }
        confirmLabel={customer?.isActive ? "Confirm Suspension" : "Confirm Reactivation"}
      />

      {/* Administrative Password Reset Modal */}
      <ReasonConfirmModal
        isOpen={showResetPasswordModal}
        onClose={() => {
          setShowResetPasswordModal(false);
          setNewPassword("");
          setModalError(null);
        }}
        onConfirm={handleConfirmPasswordReset}
        isLoading={actionLoading}
        errorMessage={modalError}
        targetIdentity={`${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""})`.trim()}
        actionType="reset-password"
        title="Reset Customer Account Password"
        description="Administrative password reset writes a secure bcrypt hash, increments the customer authVersion, and revokes all active login sessions immediately."
        confirmLabel="Reset Password & Invalidate Sessions"
        extraFields={
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>New Customer Password</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters with upper, lower, number, and symbol"
              className="w-full text-xs p-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[11px] text-slate-500">
              Password must be at least 8 characters long with uppercase, lowercase, digit, and special symbol.
            </p>
          </div>
        }
      />

      {/* Customer Permanent Deletion Modal */}
      <ReasonConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => {
          setShowDeactivateModal(false);
          setModalError(null);
        }}
        onConfirm={handleConfirmDeactivate}
        isLoading={actionLoading}
        errorMessage={modalError}
        targetIdentity={`${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""})`.trim()}
        actionType="delete"
        isDestructive={true}
        requireAcknowledgment={true}
        acknowledgmentText="I acknowledge that permanently deleting this customer account removes authentication credentials and active sessions, while preserving historical orders, payments, and invoices for legal compliance."
        title="Permanently Delete Customer Account"
        description="Permanent customer deletion removes the user authentication record from the database, invalidates all sessions and tokens, and clears active shopping carts. This frees the email address for new registrations or Google Sign-In. In accordance with financial and legal compliance policies, all completed orders, invoices, payments, and refunds remain intact in the database."
        confirmLabel="Permanently Delete Customer"
      />
    </div>
  );
}
