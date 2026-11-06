"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Percent,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  Power,
  History,
  Calculator,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Calendar,
  Layers,
  Building2,
  Package,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { adminFinanceService } from "@/services/admin/finance.service";

export default function AdminCommissionPoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const [selectedPolicy, setSelectedPolicy] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    scope: "global",
    productId: "",
    vendorId: "",
    categoryId: "",
    percentage: 10,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: "",
    priority: 10,
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview form states
  const [previewInput, setPreviewInput] = useState({
    amount: "1000",
    productId: "",
    vendorId: "",
    categoryId: "",
    currency: "INR",
  });
  const [previewResult, setPreviewResult] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const formatPercentage = (val) => {
    const num = Number(val || 0);
    return `${(num <= 1 ? num * 100 : num).toFixed(2)}%`;
  };

  const formatCurrency = (val, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(Number(val || 0));
  };

  const loadPolicies = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await adminFinanceService.listCommissionPolicies({
        page,
        limit: 20,
        scope: scopeFilter !== "all" ? scopeFilter : undefined,
        isActive: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
        search: searchQuery.trim() || undefined,
      });

      const list = res?.data || res?.items || [];
      setPolicies(Array.isArray(list) ? list : []);
      if (res?.meta) {
        setMeta(res.meta);
      }
    } catch (err) {
      toast.error("Failed to load commission policies", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies(1);
  }, [scopeFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadPolicies(1);
  };

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      description: "",
      scope: "global",
      productId: "",
      vendorId: "",
      categoryId: "",
      percentage: 10,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveUntil: "",
      priority: 10,
      notes: "Initial creation",
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Policy name is required");
      return;
    }
    const rateNum = Number(formData.percentage) / 100;
    if (rateNum < 0 || rateNum > 1.0) {
      toast.error("Commission percentage must be between 0% and 100%");
      return;
    }

    setIsSubmitting(true);
    try {
      await adminFinanceService.createCommissionPolicy({
        name: formData.name.trim(),
        description: formData.description.trim(),
        scope: formData.scope,
        productId: formData.scope === "product" ? formData.productId || undefined : undefined,
        vendorId: formData.scope === "vendor" ? formData.vendorId || undefined : undefined,
        categoryId: formData.scope === "category" ? formData.categoryId || undefined : undefined,
        rate: rateNum,
        percentage: Number(formData.percentage),
        effectiveFrom: formData.effectiveFrom ? new Date(formData.effectiveFrom) : undefined,
        effectiveUntil: formData.effectiveUntil ? new Date(formData.effectiveUntil) : null,
        priority: Number(formData.priority) || undefined,
        notes: formData.notes.trim() || "Policy created",
      });

      toast.success("Commission policy created successfully");
      setCreateModalOpen(false);
      loadPolicies(1);
    } catch (err) {
      toast.error("Failed to create policy", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (policy) => {
    setSelectedPolicy(policy);
    const pct = policy.percentage || (policy.rate ? Number(policy.rate.toString()) * 100 : 10);
    setFormData({
      name: policy.name,
      description: policy.description || "",
      scope: policy.scope,
      percentage: pct,
      effectiveFrom: policy.effectiveFrom ? new Date(policy.effectiveFrom).toISOString().slice(0, 10) : "",
      effectiveUntil: policy.effectiveUntil ? new Date(policy.effectiveUntil).toISOString().slice(0, 10) : "",
      priority: policy.priority || 10,
      notes: "",
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.notes.trim()) {
      toast.error("Mandatory update notes / reason required for audit tracking");
      return;
    }

    const rateNum = Number(formData.percentage) / 100;
    setIsSubmitting(true);
    try {
      await adminFinanceService.updateCommissionPolicy(selectedPolicy._id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rate: rateNum,
        percentage: Number(formData.percentage),
        effectiveFrom: formData.effectiveFrom ? new Date(formData.effectiveFrom) : undefined,
        effectiveUntil: formData.effectiveUntil ? new Date(formData.effectiveUntil) : null,
        priority: Number(formData.priority) || undefined,
        notes: formData.notes.trim(),
      });

      toast.success(`Policy updated to Version ${(selectedPolicy.version || 1) + 1}`);
      setEditModalOpen(false);
      loadPolicies(meta.page);
    } catch (err) {
      toast.error("Failed to update policy", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (policy) => {
    const targetStatus = !policy.isActive;
    const actionText = targetStatus ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${actionText} policy '${policy.name}'?`)) {
      return;
    }

    try {
      await adminFinanceService.toggleCommissionPolicyStatus(policy._id, {
        isActive: targetStatus,
        notes: `Policy manually ${targetStatus ? "activated" : "deactivated"} by admin`,
      });
      toast.success(`Policy ${targetStatus ? "activated" : "deactivated"}`);
      loadPolicies(meta.page);
    } catch (err) {
      toast.error(`Failed to ${actionText} policy`, {
        description: err.response?.data?.message || err.message,
      });
    }
  };

  const handleDeletePolicy = async (policy) => {
    const reason = window.prompt(`Enter reason to soft-delete policy '${policy.name}':`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Deletion reason is required for immutable audit logging");
      return;
    }

    try {
      await adminFinanceService.deleteCommissionPolicy(policy._id, { notes: reason.trim() });
      toast.success("Policy soft-deleted successfully");
      loadPolicies(meta.page);
    } catch (err) {
      toast.error("Failed to delete policy", {
        description: err.response?.data?.message || err.message,
      });
    }
  };

  const handleRunPreview = async (e) => {
    e.preventDefault();
    const amountNum = Number(previewInput.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Please enter a valid positive preview amount");
      return;
    }

    setIsPreviewing(true);
    setPreviewResult(null);
    try {
      const res = await adminFinanceService.previewCommissionCalculation({
        amount: amountNum,
        currency: previewInput.currency,
        productId: previewInput.productId.trim() || undefined,
        vendorId: previewInput.vendorId.trim() || undefined,
        categoryId: previewInput.categoryId.trim() || undefined,
      });
      setPreviewResult(res?.data || res);
    } catch (err) {
      toast.error("Preview calculation failed", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const getScopeBadge = (scope) => {
    switch (scope) {
      case "product":
        return <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Package className="w-3 h-3" /> Product Override</span>;
      case "vendor":
        return <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Building2 className="w-3 h-3" /> Vendor Agreement</span>;
      case "category":
        return <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Layers className="w-3 h-3" /> Category Rule</span>;
      case "global":
      default:
        return <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Globe className="w-3 h-3" /> Global Default</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Marketplace Commission Policies
            </h1>
            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              5-Tier Precedence
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure, version, and preview hierarchical commission rates across global defaults, categories, vendors, and products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setPreviewResult(null);
              setPreviewModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition shadow-sm"
          >
            <Calculator className="w-4 h-4 text-indigo-600" />
            Simulation & Preview Tool
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Policy
          </button>
        </div>
      </div>

      {/* Precedence Hierarchy Banner */}
      <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Deterministic Precedence Resolution Hierarchy (Highest to Lowest):
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 px-2 py-1 rounded font-medium">1. Product Override (Rank 1)</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-medium">2. Vendor Agreement (Rank 2)</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2 py-1 rounded font-medium">3. Category Rule (Rank 3)</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2 py-1 rounded font-medium">4. Global Platform Default (Rank 4)</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-2 py-1 rounded font-medium">5. Platform Legacy Fallback (10%)</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter className="w-3.5 h-3.5" /> Scope:
          </div>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="all">All Scopes</option>
            <option value="global">Global Defaults</option>
            <option value="category">Category Rules</option>
            <option value="vendor">Vendor Agreements</option>
            <option value="product">Product Overrides</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search policy name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg w-56 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm">Loading commission policies...</span>
          </div>
        ) : policies.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Percent className="w-10 h-10 mx-auto text-gray-400 mb-2 opacity-50" />
            <p className="text-sm font-medium">No commission policies found</p>
            <p className="text-xs text-gray-400 mt-1">Try resetting your filters or create a new policy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Policy Name</th>
                  <th className="px-5 py-3.5">Scope</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Commission Rate</th>
                  <th className="px-5 py-3.5">Effective Window</th>
                  <th className="px-5 py-3.5">Version</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {policies.map((p) => {
                  let targetLabel = "Marketplace Wide";
                  if (p.scope === "product") targetLabel = p.productId?.name || p.productId?.sku || p.productId || "Product";
                  else if (p.scope === "vendor") targetLabel = p.vendorId?.storeName || p.vendorId?.businessName || p.vendorId || "Vendor";
                  else if (p.scope === "category") targetLabel = p.categoryId?.name || p.categoryId || "Category";

                  return (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">{p.description}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getScopeBadge(p.scope)}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {targetLabel}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          {formatPercentage(p.percentage || p.rate)}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500">
                        <div>From: {p.effectiveFrom ? new Date(p.effectiveFrom).toLocaleDateString() : "Immediate"}</div>
                        <div>Until: {p.effectiveUntil ? new Date(p.effectiveUntil).toLocaleDateString() : "Indefinite"}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedPolicy(p);
                            setHistoryModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                        >
                          v{p.version || 1}
                          <History className="w-3 h-3 text-gray-400" />
                        </button>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.isActive
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                        }`}>
                          {p.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit policy rate"
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(p)}
                            title={p.isActive ? "Deactivate policy" : "Activate policy"}
                            className={`p-1.5 rounded transition ${
                              p.isActive
                                ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePolicy(p)}
                            title="Soft delete policy"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <h3 className="font-bold text-gray-900 dark:text-white">Create Commission Policy</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Electronics 8%"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Scope *</label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                >
                  <option value="global">Global Platform Default (Priority 10)</option>
                  <option value="category">Category Specific (Priority 20)</option>
                  <option value="vendor">Vendor Agreement (Priority 30)</option>
                  <option value="product">Product Override (Priority 40)</option>
                </select>
              </div>

              {formData.scope === "category" && (
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Category ObjectId *</label>
                  <input
                    type="text"
                    required
                    placeholder="Category 24-char hex ID"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              )}

              {formData.scope === "vendor" && (
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor ObjectId *</label>
                  <input
                    type="text"
                    required
                    placeholder="Vendor 24-char hex ID"
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              )}

              {formData.scope === "product" && (
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Product ObjectId *</label>
                  <input
                    type="text"
                    required
                    placeholder="Product 24-char hex ID"
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Commission Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (Default)</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Effective From</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Effective Until (Optional)</label>
                  <input
                    type="date"
                    value={formData.effectiveUntil}
                    onChange={(e) => setFormData({ ...formData, effectiveUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  placeholder="Policy context..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Update Commission Policy</h3>
                <p className="text-xs text-gray-500">Will increment version to v{(selectedPolicy?.version || 1) + 1}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Policy Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">New Commission Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={formData.percentage}
                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold text-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Reason for Update (Audit Tracked) *</label>
                <textarea
                  rows="2"
                  required
                  placeholder="Mandatory reason for changing commission terms..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update & Increment Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {historyModalOpen && selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Immutable Version History</h3>
                <p className="text-xs text-gray-500">{selectedPolicy.name}</p>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(selectedPolicy.versionHistory || []).map((v, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-lg border border-gray-200 dark:border-gray-700 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">Version {v.version}</span>
                    <span className="text-gray-400">{v.updatedAt ? new Date(v.updatedAt).toLocaleString() : ""}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Rate: {formatPercentage(v.percentage || v.rate)}
                  </div>
                  <div className="text-gray-500">
                    Notes: <span className="text-gray-700 dark:text-gray-300">{v.notes || "No notes"}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server-Authoritative Simulation & Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-900 dark:text-white">Commission Calculation Simulation Tool</h3>
              </div>
              <button onClick={() => setPreviewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Read-Only Illustrative Preview: This tool queries authoritative live policies without creating orders, ledger journals, or wallet balance mutations.</span>
            </div>

            <form onSubmit={handleRunPreview} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Simulated Order Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000"
                  value={previewInput.amount}
                  onChange={(e) => setPreviewInput({ ...previewInput, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Vendor 24-char hex ID"
                  value={previewInput.vendorId}
                  onChange={(e) => setPreviewInput({ ...previewInput, vendorId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Product ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Product 24-char hex ID"
                  value={previewInput.productId}
                  onChange={(e) => setPreviewInput({ ...previewInput, productId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Category ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Category 24-char hex ID"
                  value={previewInput.categoryId}
                  onChange={(e) => setPreviewInput({ ...previewInput, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isPreviewing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                  Run Server Calculation
                </button>
              </div>
            </form>

            {/* Preview Results Panel */}
            {previewResult && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                  <div className="font-bold text-sm text-gray-900 dark:text-white">
                    Calculation Breakdown
                  </div>
                  <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded text-xs font-semibold">
                    {previewResult.policy?.precedenceLabel || "Resolved Policy"}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Resolved Policy:</span>
                    <div className="font-semibold text-gray-900 dark:text-white mt-0.5">{previewResult.policy?.name}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Precedence Rank:</span>
                    <div className="font-semibold text-indigo-600 mt-0.5">Rank {previewResult.policy?.precedenceRank}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Commission Rate:</span>
                    <div className="font-semibold text-indigo-600 mt-0.5">{previewResult.calculation?.commissionPercentage}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Gross Amount:</span>
                    <div className="font-semibold text-gray-900 dark:text-white mt-0.5">{formatCurrency(previewResult.calculation?.grossAmount)}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">Platform Commission:</span>
                    <span className="font-bold text-rose-600 ml-2">{formatCurrency(previewResult.calculation?.commissionAmount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vendor Net Payout:</span>
                    <span className="font-bold text-emerald-600 ml-2">{formatCurrency(previewResult.calculation?.vendorNetAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

