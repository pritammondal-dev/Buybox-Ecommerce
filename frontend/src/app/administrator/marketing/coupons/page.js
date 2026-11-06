"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Ticket,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Percent,
  DollarSign,
  Users,
  Eye,
  Power,
  X,
  Clock,
  ArrowRight,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { couponService } from "@/services/admin/admin.service.js";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog.jsx";
import { toast } from "sonner";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    code: "",
    description: "",
    type: "percentage",
    value: "",
    minOrderAmount: "0",
    maxDiscountAmount: "",
    startsAt: "",
    expiresAt: "",
    usageLimit: "",
    perCustomerLimit: "1",
    scope: "all",
    firstOrderOnly: false,
  });

  // Analytics Modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [redemptions, setRedemptions] = useState([]);

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      const data = await couponService.list(params);
      const items = Array.isArray(data) ? data : data?.coupons || [];
      setCoupons(items);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load discount coupons"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [statusFilter]);

  const openCreateModal = () => {
    setEditingCoupon(null);
    const now = new Date();
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setForm({
      code: "",
      description: "",
      type: "percentage",
      value: "10",
      minOrderAmount: "0",
      maxDiscountAmount: "",
      startsAt: now.toISOString().slice(0, 16),
      expiresAt: nextMonth.toISOString().slice(0, 16),
      usageLimit: "100",
      perCustomerLimit: "1",
      scope: "all",
      firstOrderOnly: false,
    });
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingCoupon(c);
    const val = typeof c.value === "object" && c.value?.$numberDecimal ? c.value.$numberDecimal : c.value;
    const minOrder = typeof c.minOrderAmount === "object" && c.minOrderAmount?.$numberDecimal ? c.minOrderAmount.$numberDecimal : c.minOrderAmount;
    const maxDisc = typeof c.maxDiscountAmount === "object" && c.maxDiscountAmount?.$numberDecimal ? c.maxDiscountAmount.$numberDecimal : c.maxDiscountAmount;

    setForm({
      code: c.code,
      description: c.description || "",
      type: c.type || "percentage",
      value: String(val || ""),
      minOrderAmount: String(minOrder || "0"),
      maxDiscountAmount: maxDisc ? String(maxDisc) : "",
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : "",
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : "",
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      perCustomerLimit: String(c.perCustomerLimit || "1"),
      scope: c.scope || "all",
      firstOrderOnly: Boolean(c.firstOrderOnly),
    });
    setShowModal(true);
  };

  const openAnalytics = async (coupon) => {
    setSelectedCoupon(coupon);
    setShowAnalyticsModal(true);
    setAnalyticsLoading(true);
    try {
      const data = await couponService.getRedemptions(coupon._id || coupon.id);
      setRedemptions(Array.isArray(data) ? data : data?.redemptions || []);
    } catch {
      setRedemptions([]);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    const valNum = parseFloat(form.value);
    if (!valNum || valNum <= 0) {
      toast.error("Discount value must be greater than 0");
      return;
    }
    if (form.type === "percentage" && valNum > 100) {
      toast.error("Percentage discount cannot exceed 100%");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        type: form.type,
        value: valNum,
        minOrderAmount: parseFloat(form.minOrderAmount) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
        usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : undefined,
        perCustomerLimit: parseInt(form.perCustomerLimit, 10) || 1,
        scope: form.scope,
        firstOrderOnly: form.firstOrderOnly,
      };

      if (editingCoupon) {
        await couponService.update(editingCoupon._id || editingCoupon.id, payload);
        toast.success(`Coupon '${payload.code}' updated successfully`);
        setSuccess(`Coupon '${payload.code}' updated successfully`);
      } else {
        await couponService.create(payload);
        toast.success(`Coupon '${payload.code}' created successfully`);
        setSuccess(`Coupon '${payload.code}' created successfully`);
      }

      setShowModal(false);
      setTimeout(() => setSuccess(null), 4000);
      fetchCoupons();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save coupon");
    } finally {
      setSubmitting(false);
    }
  };

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "destructive",
    onConfirm: null,
    isLoading: false,
  });

  const handleToggleStatus = (c) => {
    const isActivating = c.status !== "active";
    const action = isActivating ? "activate" : "deactivate";
    setConfirmDialog({
      isOpen: true,
      title: `${isActivating ? "Activate" : "Deactivate"} Coupon '${c.code}'?`,
      description: `Are you sure you want to ${action} coupon '${c.code}'? ${
        isActivating
          ? "Eligible shoppers will be able to apply this coupon discount in checkout immediately."
          : "This coupon will be immediately disabled and cannot be applied in new checkouts."
      }`,
      confirmLabel: isActivating ? "Activate Coupon" : "Deactivate Coupon",
      variant: isActivating ? "default" : "destructive",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          if (isActivating) {
            await couponService.activate(c._id || c.id);
            toast.success(`Coupon '${c.code}' activated`);
            setSuccess(`Coupon '${c.code}' activated`);
          } else {
            await couponService.deactivate(c._id || c.id);
            toast.success(`Coupon '${c.code}' deactivated`);
            setSuccess(`Coupon '${c.code}' deactivated`);
          }
          setTimeout(() => setSuccess(null), 4000);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchCoupons();
        } catch (err) {
          toast.error(err?.response?.data?.message || err?.message || `Failed to ${action} coupon`);
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleDeleteCoupon = (c) => {
    setConfirmDialog({
      isOpen: true,
      title: `Archive Coupon '${c.code}'?`,
      description: `Are you sure you want to archive coupon '${c.code}'? It will be removed from all active consumers. Historical order redemption records will be retained.`,
      confirmLabel: "Archive Coupon",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await couponService.delete(c._id || c.id);
          toast.success(`Coupon '${c.code}' archived successfully`);
          setSuccess(`Coupon '${c.code}' archived successfully`);
          setTimeout(() => setSuccess(null), 4000);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          fetchCoupons();
        } catch (err) {
          toast.error(err?.response?.data?.message || err?.message || "Failed to archive coupon");
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const formatCurrency = (val) => {
    const num = typeof val === "object" && val?.$numberDecimal ? Number(val.$numberDecimal) : Number(val) || 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      !search ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const activeCount = coupons.filter((c) => c.status === "active").length;
  const expiredCount = coupons.filter((c) => c.status === "expired" || new Date(c.expiresAt) < new Date()).length;
  const totalRedemptionsCount = coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Ticket className="size-6 text-[#004D38]" />
            <span>Platform Coupon &amp; Discount Management</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure promotional promo codes, cart thresholds, usage limits, and track redemption analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCoupons}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="size-4" />
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Total Coupons</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{coupons.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-emerald-600">Active Coupons</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-amber-600">Expired / Inactive</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{expiredCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-purple-600">Total Redemptions</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{totalRedemptionsCount}</div>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "All Coupons" },
            { id: "active", label: "Active" },
            { id: "inactive", label: "Disabled / Inactive" },
            { id: "expired", label: "Expired" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st.id
                  ? "bg-[#004D38] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by promo code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          />
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Coupon Code</th>
                <th className="px-5 py-3.5">Discount</th>
                <th className="px-5 py-3.5">Min Order</th>
                <th className="px-5 py-3.5">Max Discount</th>
                <th className="px-5 py-3.5">Redemptions / Limit</th>
                <th className="px-5 py-3.5">Valid Range</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    <RefreshCw className="size-4 animate-spin mx-auto mb-2 text-[#004D38]" />
                    <span>Loading discount coupons...</span>
                  </td>
                </tr>
              ) : filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    No coupons found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((c) => {
                  const valNum = typeof c.value === "object" && c.value?.$numberDecimal ? Number(c.value.$numberDecimal) : Number(c.value) || 0;
                  const minOrder = typeof c.minOrderAmount === "object" && c.minOrderAmount?.$numberDecimal ? Number(c.minOrderAmount.$numberDecimal) : Number(c.minOrderAmount) || 0;
                  const maxDisc = typeof c.maxDiscountAmount === "object" && c.maxDiscountAmount?.$numberDecimal ? Number(c.maxDiscountAmount.$numberDecimal) : Number(c.maxDiscountAmount);

                  return (
                    <tr key={c._id || c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                          {c.code}
                        </div>
                        {c.description && (
                          <div className="text-slate-400 text-[11px] truncate max-w-xs mt-0.5">
                            {c.description}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-[#004D38]">
                        {c.type === "percentage" ? `${valNum}% OFF` : `₹${valNum} OFF`}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {minOrder > 0 ? formatCurrency(minOrder) : "No minimum"}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600">
                        {maxDisc ? formatCurrency(maxDisc) : "No cap"}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-800">{c.usageCount || 0}</span>
                        <span className="text-slate-400 font-normal"> / {c.usageLimit || "∞"}</span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 text-[11px]">
                        <div>{c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN") : "—"}</div>
                        <div className="text-slate-400">to {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "—"}</div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              c.status === "active" ? "bg-emerald-600" : "bg-slate-400"
                            }`}
                          />
                          {c.status || "inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAnalytics(c)}
                            className="p-1 text-slate-500 hover:text-[#004D38] hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Coupon Analytics"
                          >
                            <TrendingUp className="size-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(c)}
                            className={`p-1 rounded-lg transition-colors ${
                              c.status === "active"
                                ? "text-amber-600 hover:bg-amber-50"
                                : "text-emerald-700 hover:bg-emerald-50"
                            }`}
                            title={c.status === "active" ? "Disable Coupon" : "Enable Coupon"}
                          >
                            <Power className="size-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Coupon"
                          >
                            <Edit2 className="size-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCoupon(c)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Archive / Delete Coupon"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-100 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCoupon ? "Edit Discount Coupon" : "Create New Coupon"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })}
                    placeholder="e.g. FESTIVE20"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl uppercase font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount Discount (₹)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. 20% off on all festive orders above ₹999"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {form.type === "percentage" ? "Percentage (%) *" : "Amount (₹) *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                    placeholder="No cap"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expiry Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Global Usage Limit</label>
                  <input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Limit Per Customer</label>
                  <input
                    type="number"
                    value={form.perCustomerLimit}
                    onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Applicable Scope</label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                >
                  <option value="all">All Products Across Marketplace</option>
                  <option value="products">Restricted Products</option>
                  <option value="categories">Restricted Categories</option>
                  <option value="vendors">Restricted Vendors</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.firstOrderOnly}
                    onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
                    className="rounded text-[#004D38] focus:ring-[#004D38]"
                  />
                  <span className="font-semibold text-slate-800">First-time orders only</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 font-semibold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANALYTICS MODAL */}
      {showAnalyticsModal && selectedCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Ticket className="size-5 text-[#004D38]" />
                  <span>Coupon Analytics: {selectedCoupon.code}</span>
                </h3>
                <p className="text-slate-500 text-[11px]">Real-time redemption statistics and orders</p>
              </div>
              <button
                onClick={() => setShowAnalyticsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Performance KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="text-slate-400 font-medium">Total Uses</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{selectedCoupon.usageCount || 0}</div>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <div className="text-emerald-700 font-medium">Remaining</div>
                <div className="text-lg font-bold text-[#004D38] mt-0.5">
                  {selectedCoupon.usageLimit ? selectedCoupon.usageLimit - (selectedCoupon.usageCount || 0) : "∞"}
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                <div className="text-blue-700 font-medium">Redemptions</div>
                <div className="text-lg font-bold text-blue-900 mt-0.5">{redemptions.length}</div>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                <div className="text-purple-700 font-medium">Status</div>
                <div className="text-lg font-bold text-purple-900 mt-0.5 capitalize">{selectedCoupon.status}</div>
              </div>
            </div>

            {/* Redemptions Table */}
            <div className="space-y-2 pt-2">
              <div className="font-bold text-slate-800">Redemption History ({redemptions.length}):</div>
              {analyticsLoading ? (
                <div className="py-8 text-center text-slate-400">Loading redemption logs...</div>
              ) : redemptions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No redemptions recorded for this coupon yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl max-h-56 overflow-y-auto">
                  {redemptions.map((r, i) => (
                    <div key={r._id || i} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">
                          Order #{r.orderId?.orderNumber || String(r.orderId || "").slice(-8).toUpperCase()}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          Customer: {r.customerId?.firstName || r.customerId?.email || "Registered customer"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#004D38]">
                          {formatCurrency(r.discountAmount || 0)} Saved
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAnalyticsModal(false)}
                className="px-5 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action / Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        isLoading={confirmDialog.isLoading}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
