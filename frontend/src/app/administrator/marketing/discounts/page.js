"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Tag,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Percent,
  DollarSign,
  Eye,
  PauseCircle,
  PlayCircle,
  XCircle,
  Trash2,
  Sliders,
  ShieldAlert,
  ArrowRight,
  Layers,
  Sparkles,
  Check,
  X,
  Clock,
  Filter,
} from "lucide-react";
import { discountService } from "@/services/admin/admin.service.js";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog.jsx";
import { toast } from "sonner";

export default function MarketingDiscountsPage() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [discountTypeFilter, setDiscountTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [fundingFilter, setFundingFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 15 });

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const defaultFormState = {
    name: "",
    description: "",
    discountType: "percentage",
    value: "",
    scope: "all",
    targetIds: "",
    startsAt: "",
    endsAt: "",
    priority: "0",
    maxDiscountAmount: "",
    minSellingPrice: "",
    fundingSource: "platform",
    allowCoupons: true,
    status: "active",
  };
  const [form, setForm] = useState(defaultFormState);

  // Preview State
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [overrideFloorChecked, setOverrideFloorChecked] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [reconciling, setReconciling] = useState(false);

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "destructive",
    confirmLabel: "Confirm",
    isLoading: false,
  });

  const fetchPromotions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (discountTypeFilter !== "all") params.discountType = discountTypeFilter;
      if (scopeFilter !== "all") params.scope = scopeFilter;
      if (fundingFilter !== "all") params.fundingSource = fundingFilter;

      const res = await discountService.list(params);
      const items = res?.promotions || [];
      setPromotions(items);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load promotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, [page, statusFilter, discountTypeFilter, scopeFilter, fundingFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPromotions();
  };

  const handleReconcileScheduler = async () => {
    try {
      setReconciling(true);
      const res = await discountService.reconcile();
      toast.success(
        `Lifecycle reconciliation complete: ${res.activated || 0} activated, ${res.expired || 0} expired, ${res.scanned || 0} evaluated.`
      );
      fetchPromotions();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to trigger schedule reconciliation");
    } finally {
      setReconciling(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    return {
      total: pagination.total || promotions.length,
      active: promotions.filter((p) => p.status === "active" || p.effectiveStatus === "active").length,
      scheduled: promotions.filter((p) => p.status === "scheduled" || p.effectiveStatus === "scheduled").length,
      paused: promotions.filter((p) => p.status === "paused").length,
    };
  }, [promotions, pagination.total]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPromotion(null);
    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 86400000 * 30);

    setForm({
      ...defaultFormState,
      startsAt: now.toISOString().slice(0, 16),
      endsAt: oneMonthLater.toISOString().slice(0, 16),
    });
    setPreviewData(null);
    setOverrideFloorChecked(false);
    setOverrideReason("");
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (p) => {
    setEditingPromotion(p);
    let targetIdsStr = "";
    if (p.scope === "products" && p.productIds) {
      targetIdsStr = p.productIds.map((x) => x._id || x).join(", ");
    } else if (p.scope === "variants" && p.variantIds) {
      targetIdsStr = p.variantIds.map((x) => x._id || x).join(", ");
    } else if (p.scope === "categories" && p.categoryIds) {
      targetIdsStr = p.categoryIds.map((x) => x._id || x).join(", ");
    } else if (p.scope === "brands" && p.brandIds) {
      targetIdsStr = p.brandIds.map((x) => x._id || x).join(", ");
    }

    setForm({
      name: p.name || "",
      description: p.description || "",
      discountType: p.discountType || "percentage",
      value: p.value?.$numberDecimal || p.value?.toString() || "",
      scope: p.scope || "all",
      targetIds: targetIdsStr,
      startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : "",
      endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : "",
      priority: String(p.priority ?? 0),
      maxDiscountAmount: p.maxDiscountAmount?.$numberDecimal || p.maxDiscountAmount?.toString() || "",
      minSellingPrice: p.minSellingPrice?.$numberDecimal || p.minSellingPrice?.toString() || "",
      fundingSource: p.fundingSource || "platform",
      allowCoupons: p.allowCoupons !== false,
      status: p.status || "active",
    });
    setPreviewData(null);
    setShowModal(true);
  };

  // Submit Create or Update
  const handleSavePromotion = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedTargets = form.targetIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        discountType: form.discountType,
        value: Number(form.value),
        scope: form.scope,
        startsAt: new Date(form.startsAt),
        endsAt: new Date(form.endsAt),
        priority: Number(form.priority) || 0,
        fundingSource: form.fundingSource,
        allowCoupons: form.allowCoupons,
        status: form.status,
      };

      if (form.scope === "products") payload.productIds = parsedTargets;
      if (form.scope === "variants") payload.variantIds = parsedTargets;
      if (form.scope === "categories") payload.categoryIds = parsedTargets;
      if (form.scope === "brands") payload.brandIds = parsedTargets;

      if (form.maxDiscountAmount !== "") {
        payload.maxDiscountAmount = Number(form.maxDiscountAmount);
      }
      if (form.minSellingPrice !== "") {
        payload.minSellingPrice = Number(form.minSellingPrice);
      }

      if (editingPromotion) {
        await discountService.update(editingPromotion._id, payload);
        toast.success("Promotion updated successfully");
      } else {
        await discountService.create(payload);
        toast.success("Promotion created successfully");
      }

      setShowModal(false);
      fetchPromotions();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save promotion");
    } finally {
      setSubmitting(false);
    }
  };

  // Run Server-Calculated Price Preview
  const handleRunPreview = async () => {
    setPreviewLoading(true);
    try {
      const parsedTargets = form.targetIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const previewPayload = {
        promotionData: {
          name: form.name || "Preview Test",
          discountType: form.discountType,
          value: Number(form.value) || 0,
          scope: form.scope,
          productIds: form.scope === "products" ? parsedTargets : [],
          variantIds: form.scope === "variants" ? parsedTargets : [],
          categoryIds: form.scope === "categories" ? parsedTargets : [],
          brandIds: form.scope === "brands" ? parsedTargets : [],
          maxDiscountAmount: form.maxDiscountAmount !== "" ? Number(form.maxDiscountAmount) : null,
          minSellingPrice: form.minSellingPrice !== "" ? Number(form.minSellingPrice) : null,
          fundingSource: form.fundingSource,
          allowCoupons: form.allowCoupons,
        },
        limit: 10,
        overrideFloor: overrideFloorChecked,
        overrideReason: overrideFloorChecked ? overrideReason : null,
      };

      const res = await discountService.preview(previewPayload);
      setPreviewData(res);
      toast.success("Server pricing preview updated");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Open Preview Modal for existing promotion
  const handleOpenExistingPreview = async (p) => {
    setPreviewLoading(true);
    setShowPreviewModal(true);
    setPreviewData(null);
    try {
      const res = await discountService.preview({ promotionId: p._id, limit: 15 });
      setPreviewData(res);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to preview promotion");
      setShowPreviewModal(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Status Action Handlers
  const handleActivate = (p) => {
    setConfirmDialog({
      isOpen: true,
      title: `Activate '${p.name}'?`,
      description: "Activating this promotion will make it eligible for customer price evaluations within its scheduled window.",
      variant: "default",
      confirmLabel: "Activate",
      onConfirm: async () => {
        try {
          await discountService.activate(p._id);
          toast.success("Promotion activated");
          fetchPromotions();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to activate promotion");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handlePause = (p) => {
    setConfirmDialog({
      isOpen: true,
      title: `Pause '${p.name}'?`,
      description: "Pausing this promotion will immediately stop applying its discounts without modifying product base prices.",
      variant: "default",
      confirmLabel: "Pause",
      onConfirm: async () => {
        try {
          await discountService.pause(p._id);
          toast.success("Promotion paused");
          fetchPromotions();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to pause promotion");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleResume = (p) => {
    setConfirmDialog({
      isOpen: true,
      title: `Resume '${p.name}'?`,
      description: "Resuming will re-enable discount calculation if within the active date window.",
      variant: "default",
      confirmLabel: "Resume",
      onConfirm: async () => {
        try {
          await discountService.resume(p._id);
          toast.success("Promotion resumed");
          fetchPromotions();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to resume promotion");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleCancel = (p) => {
    setConfirmDialog({
      isOpen: true,
      title: `Cancel '${p.name}'?`,
      description: "Cancelling is permanent. A cancelled promotion cannot be resumed.",
      variant: "destructive",
      confirmLabel: "Cancel Promotion",
      onConfirm: async () => {
        try {
          await discountService.cancel(p._id);
          toast.success("Promotion cancelled");
          fetchPromotions();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to cancel promotion");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDelete = (p) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete '${p.name}'?`,
      description: "This will soft-delete the promotion from active listings.",
      variant: "destructive",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await discountService.delete(p._id);
          toast.success("Promotion deleted");
          fetchPromotions();
        } catch (err) {
          toast.error(err?.response?.data?.message || "Failed to delete promotion");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Helper badge renderers
  const renderStatusBadge = (p) => {
    const status = p.effectiveStatus || p.status;
    const styles = {
      active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      paused: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      expired: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
      cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/20",
      draft: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
          styles[status] || styles.draft
        }`}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Tag className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Discounts & Promotions Engine
              </h1>
              <p className="text-sm text-zinc-500">
                Centralized Superadmin dynamic discount management. Evaluates promotions without mutating product base prices.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReconcileScheduler}
            disabled={reconciling || loading}
            title="Trigger automated schedule reconciliation"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
          >
            <Clock className={`size-4 ${reconciling ? "animate-spin" : ""}`} />
            {reconciling ? "Reconciling..." : "Run Scheduler Sync"}
          </button>
          <button
            onClick={fetchPromotions}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="size-4" />
            Create Promotion
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Promotions</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{metrics.total}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Active Deals</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.active}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-xs">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Scheduled (Upcoming)</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{metrics.scheduled}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-xs">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Paused</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.paused}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-xl border border-zinc-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search promotions by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>

            <select
              value={discountTypeFilter}
              onChange={(e) => {
                setDiscountTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed Amount (₹)</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => {
                setScopeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Scopes</option>
              <option value="all">Storewide</option>
              <option value="products">Products</option>
              <option value="variants">Variants</option>
              <option value="categories">Categories</option>
              <option value="brands">Brands</option>
            </select>

            <select
              value={fundingFilter}
              onChange={(e) => {
                setFundingFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Funding</option>
              <option value="platform">Platform Funded</option>
              <option value="vendor">Vendor Funded</option>
            </select>
          </div>
        </form>
      </div>

      {/* Main Promotions Table */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <RefreshCw className="size-8 animate-spin mx-auto mb-3 text-indigo-600" />
            <p className="text-sm font-medium">Loading promotional rules...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="size-8 mx-auto mb-2" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchPromotions}
              className="mt-3 text-xs underline text-indigo-600 hover:text-indigo-800"
            >
              Try again
            </button>
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Tag className="size-10 mx-auto mb-3 text-zinc-300" />
            <p className="text-base font-semibold text-zinc-900">No promotions found</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              Get started by creating a new promotional pricing rule with discount caps and price floor safeguards.
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Plus className="size-4" />
              Create First Promotion
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  <th className="py-3.5 px-4">Promotion Name</th>
                  <th className="py-3.5 px-4">Discount</th>
                  <th className="py-3.5 px-4">Scope & Targets</th>
                  <th className="py-3.5 px-4">Validity Window</th>
                  <th className="py-3.5 px-4">Funding & Stacking</th>
                  <th className="py-3.5 px-4">Price Floor</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {promotions.map((p) => {
                  const valStr = p.value?.$numberDecimal || p.value?.toString() || "0";
                  const maxCapStr = p.maxDiscountAmount?.$numberDecimal || p.maxDiscountAmount?.toString();
                  const floorStr = p.minSellingPrice?.$numberDecimal || p.minSellingPrice?.toString();

                  return (
                    <tr key={p._id} className="hover:bg-zinc-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-900">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{p.description}</div>
                        )}
                        <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                          Priority: {p.priority ?? 0}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-zinc-900">
                          {p.discountType === "percentage" ? `${valStr}% OFF` : `₹${valStr} OFF`}
                        </span>
                        {maxCapStr && (
                          <div className="text-xs text-zinc-500 mt-0.5">Cap: ₹{maxCapStr}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-zinc-800 capitalize">{p.scope}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {p.targetCount || "All Store Products"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                        <div>From: {new Date(p.startsAt).toLocaleDateString()}</div>
                        <div>To: {new Date(p.endsAt).toLocaleDateString()}</div>
                        {p.lastTransitionAt && (
                          <div className="text-[10px] text-zinc-400 mt-1">
                            Reconciled: {new Date(p.lastTransitionAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
                              p.fundingSource === "vendor"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {p.fundingSource === "vendor" ? "Vendor Funded" : "Platform Funded"}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {p.allowCoupons ? "Coupons: Allowed" : "Coupons: Blocked"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-zinc-700">
                        {floorStr ? `₹${floorStr}` : <span className="text-zinc-400 font-sans">None</span>}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">{renderStatusBadge(p)}</td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Live Preview Button */}
                          <button
                            onClick={() => handleOpenExistingPreview(p)}
                            title="Live Price Preview"
                            className="p-1.5 text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100 rounded-md transition"
                          >
                            <Eye className="size-4" />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Promotion"
                            className="p-1.5 text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100 rounded-md transition"
                          >
                            <Edit2 className="size-4" />
                          </button>

                          {/* Lifecycle Pause / Resume */}
                          {p.status === "active" && (
                            <button
                              onClick={() => handlePause(p)}
                              title="Pause Promotion"
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition"
                            >
                              <PauseCircle className="size-4" />
                            </button>
                          )}

                          {p.status === "paused" && (
                            <button
                              onClick={() => handleResume(p)}
                              title="Resume Promotion"
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition"
                            >
                              <PlayCircle className="size-4" />
                            </button>
                          )}

                          {p.status === "draft" && (
                            <button
                              onClick={() => handleActivate(p)}
                              title="Activate Promotion"
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition"
                            >
                              <PlayCircle className="size-4" />
                            </button>
                          )}

                          {/* Cancel Button */}
                          {["active", "scheduled", "paused", "draft"].includes(p.status) && (
                            <button
                              onClick={() => handleCancel(p)}
                              title="Cancel Promotion"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                            >
                              <XCircle className="size-4" />
                            </button>
                          )}

                          {/* Soft Delete */}
                          <button
                            onClick={() => handleDelete(p)}
                            title="Delete Promotion"
                            className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="py-3 px-4 border-t border-zinc-200 flex items-center justify-between text-sm text-zinc-600">
            <div>
              Showing page <span className="font-semibold">{pagination.page}</span> of{" "}
              <span className="font-semibold">{pagination.totalPages}</span> ({pagination.total} total)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-zinc-300 rounded-md text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 border border-zinc-300 rounded-md text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PROMOTION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-zinc-200 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-xl font-bold text-zinc-900">
                {editingPromotion ? "Edit Promotion" : "Create Dynamic Promotion"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSavePromotion} className="mt-4 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-700">Promotion Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Diwali Mega Electronics 20% Off"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-zinc-700">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Internal or customer-facing promotional remarks..."
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Discount Value and Caps */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-4">
                <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Discount Configuration
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Discount Type *</label>
                    <select
                      value={form.discountType}
                      onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed_amount">Fixed Amount (₹)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">
                      Discount Value * {form.discountType === "percentage" ? "(%)" : "(₹)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      max={form.discountType === "percentage" ? "100" : undefined}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder={form.discountType === "percentage" ? "20" : "500"}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Max Discount Cap (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.maxDiscountAmount}
                      onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                      placeholder="Optional cap (e.g., 2000)"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Price Floor Safeguard (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.minSellingPrice}
                      onChange={(e) => setForm({ ...form, minSellingPrice: e.target.value })}
                      placeholder="Minimum selling price"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-700">Priority (Conflict Tie-breaker)</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Scope & Targeting */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Scope *</label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                  >
                    <option value="all">Storewide (All Products)</option>
                    <option value="products">Specific Products</option>
                    <option value="variants">Specific Variants</option>
                    <option value="categories">Specific Categories</option>
                    <option value="brands">Specific Brands</option>
                  </select>
                </div>

                {form.scope !== "all" && (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-zinc-700">
                      Target {form.scope} Object IDs (comma-separated) *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.targetIds}
                      onChange={(e) => setForm({ ...form, targetIds: e.target.value })}
                      placeholder="e.g., 671d1234..., 671d5678..."
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Starts At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Ends At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Policies: Funding & Coupon Stacking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200/80">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700">Funding Policy *</label>
                  <select
                    value={form.fundingSource}
                    onChange={(e) => setForm({ ...form, fundingSource: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white"
                  >
                    <option value="platform">Platform Funded</option>
                    <option value="vendor">Vendor Funded</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-5">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700">Coupon Stacking</label>
                    <p className="text-[11px] text-zinc-500">Allow customers to stack eligible cart coupons</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.allowCoupons}
                    onChange={(e) => setForm({ ...form, allowCoupons: e.target.checked })}
                    className="size-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Price Preview Section Inside Modal */}
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-indigo-600" />
                    Live Price Preview & Floor Safety Validation
                  </div>
                  <button
                    type="button"
                    onClick={handleRunPreview}
                    disabled={previewLoading || !form.value}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${previewLoading ? "animate-spin" : ""}`} />
                    Test Pricing Engine
                  </button>
                </div>

                {previewData && (
                  <div className="mt-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-3">
                    <div className="flex items-center justify-between text-zinc-600 font-medium">
                      <span>Tested Items: {previewData.summary.totalTested}</span>
                      <span className="text-emerald-600">Eligible: {previewData.summary.eligibleCount}</span>
                      {previewData.summary.floorViolationsCount > 0 && (
                        <span className="text-rose-600 font-bold">
                          Floor Violations: {previewData.summary.floorViolationsCount}
                        </span>
                      )}
                    </div>

                    {/* Table of Preview results */}
                    <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-md bg-white">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-zinc-100 text-zinc-600">
                          <tr>
                            <th className="p-2">Item</th>
                            <th className="p-2">Regular</th>
                            <th className="p-2">MRP</th>
                            <th className="p-2">Discount</th>
                            <th className="p-2">Effective</th>
                            <th className="p-2">Floor Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {previewData.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="p-2 font-medium truncate max-w-[120px]">{item.productName}</td>
                              <td className="p-2">₹{item.regularPrice}</td>
                              <td className="p-2">{item.compareAtPrice ? `₹${item.compareAtPrice}` : "-"}</td>
                              <td className="p-2 text-indigo-600 font-semibold">-₹{item.promotionalDiscountAmount}</td>
                              <td className="p-2 font-bold text-zinc-900">₹{item.effectivePrice}</td>
                              <td className="p-2">
                                {item.floorPriceCheck.passed ? (
                                  <span className="text-emerald-600 font-medium">
                                    {item.floorPriceCheck.wasOverridden ? "Overridden" : "Passed"}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold">Floor Violation</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Floor Override Controls if Violations Detected */}
                    {previewData.summary.floorViolationsCount > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="size-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-800">
                            <strong>Price floor violation detected.</strong> By default, this promotion will not be applied to items falling below ₹{form.minSellingPrice}.
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="overrideCheckbox"
                            checked={overrideFloorChecked}
                            onChange={(e) => setOverrideFloorChecked(e.target.checked)}
                            className="size-4 text-amber-600 rounded"
                          />
                          <label htmlFor="overrideCheckbox" className="text-xs font-semibold text-amber-900">
                            Apply Audited Superadmin Override
                          </label>
                        </div>

                        {overrideFloorChecked && (
                          <div className="space-y-1 pt-1">
                            <label className="text-[11px] font-semibold text-amber-900">
                              Mandatory Override Reason (Logged in Audit Log) *
                            </label>
                            <input
                              type="text"
                              required
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="e.g., Executive approval for clearance flash sale"
                              className="w-full px-2.5 py-1.5 text-xs border border-amber-300 rounded bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingPromotion ? "Update Promotion" : "Create Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED LIVE PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-zinc-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="size-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-zinc-900">Authoritative Pricing Engine Preview</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-lg"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {previewLoading ? (
                <div className="p-12 text-center text-zinc-500">
                  <RefreshCw className="size-8 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-sm font-medium">Running pricing engine against candidate catalog...</p>
                </div>
              ) : previewData ? (
                <>
                  <div className="grid grid-cols-4 gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                    <div>
                      <span className="text-zinc-500">Tested Sample:</span>{" "}
                      <span className="font-bold text-zinc-900">{previewData.summary.totalTested}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Eligible:</span>{" "}
                      <span className="font-bold text-emerald-600">{previewData.summary.eligibleCount}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Floor Violations:</span>{" "}
                      <span className="font-bold text-rose-600">{previewData.summary.floorViolationsCount}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Evaluated At:</span>{" "}
                      <span className="font-mono text-zinc-700">
                        {new Date(previewData.summary.evaluationTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-100 text-zinc-600 font-semibold border-b border-zinc-200">
                        <tr>
                          <th className="p-3">Product / SKU</th>
                          <th className="p-3">Regular Price</th>
                          <th className="p-3">Reference MRP</th>
                          <th className="p-3">Discount</th>
                          <th className="p-3">Effective Price</th>
                          <th className="p-3">Discount %</th>
                          <th className="p-3">Floor Check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {previewData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/70">
                            <td className="p-3">
                              <div className="font-semibold text-zinc-900">{item.productName}</div>
                              <div className="font-mono text-[11px] text-zinc-400">{item.sku}</div>
                            </td>
                            <td className="p-3 font-medium text-zinc-800">₹{item.regularPrice}</td>
                            <td className="p-3 text-zinc-500">{item.compareAtPrice ? `₹${item.compareAtPrice}` : "None"}</td>
                            <td className="p-3 text-indigo-600 font-bold">-₹{item.promotionalDiscountAmount}</td>
                            <td className="p-3 text-emerald-700 font-bold text-sm">₹{item.effectivePrice}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                                {item.discountPercentage}% OFF
                              </span>
                            </td>
                            <td className="p-3">
                              {item.floorPriceCheck.passed ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <Check className="size-3.5" /> Passed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                  <X className="size-3.5" /> Below Floor (₹{item.floorPriceCheck.floorPrice})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            <div className="border-t border-zinc-100 pt-3 flex justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Component */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        isLoading={confirmDialog.isLoading}
      />
    </div>
  );
}
