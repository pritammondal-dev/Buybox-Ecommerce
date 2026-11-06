"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Clock,
  Layers,
  Play,
  Pause,
  Copy,
  Archive,
  BarChart2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { campaignService } from "@/services/admin/admin.service.js";
import { apiClient } from "@/lib/api/axios.js";
import { CampaignFormModal } from "@/components/admin/marketing/CampaignFormModal.jsx";

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // KPI Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    draft: 0,
    paused: 0,
    completed: 0,
    archived: 0,
  });

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  // High-impact Action Confirmation Modal
  const [actionConfirm, setActionConfirm] = useState(null); // { type: 'activate' | 'pause' | 'archive', campaign }

  // Performance Modal State
  const [showPerfModal, setShowPerfModal] = useState(false);
  const [selectedPerfCampaign, setSelectedPerfCampaign] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfData, setPerfData] = useState(null);

  // Fetch campaigns with full server-side parameters
  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        paginate: "true",
        page,
        limit,
      };

      if (search.trim()) params.search = search.trim();
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (scopeFilter && scopeFilter !== "all") params.scope = scopeFilter;
      if (typeFilter && typeFilter !== "all") params.type = typeFilter;
      if (startDateFilter) params.startDate = startDateFilter;
      if (endDateFilter) params.endDate = endDateFilter;

      const data = await campaignService.list(params);

      if (data && data.campaigns) {
        setCampaigns(data.campaigns);
        if (data.pagination) setPagination(data.pagination);
        if (data.stats) setStats(data.stats);
      } else {
        const items = Array.isArray(data) ? data : [];
        setCampaigns(items);
        setPagination({
          total: items.length,
          page: 1,
          limit: items.length || 10,
          totalPages: 1,
        });
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load marketing campaigns"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [
    page,
    limit,
    statusFilter,
    scopeFilter,
    typeFilter,
    startDateFilter,
    endDateFilter,
  ]);

  // Handle Search on Enter or debounced
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCampaigns();
  };

  const openCreateModal = () => {
    setEditingCampaign(null);
    setShowModal(true);
  };

  const openEditModal = (c) => {
    setEditingCampaign(c);
    setShowModal(true);
  };

  // Save campaign from modal (create or update)
  const handleSaveCampaign = async (payload, campaignId) => {
    if (campaignId) {
      await campaignService.update(campaignId, payload);
      toast.success(`Campaign '${payload.name}' updated successfully`);
      setSuccess(`Campaign '${payload.name}' updated successfully`);
    } else {
      await campaignService.create(payload);
      toast.success(`Campaign '${payload.name}' created successfully`);
      setSuccess(`Campaign '${payload.name}' created successfully`);
    }
    setTimeout(() => setSuccess(null), 4000);
    fetchCampaigns();
  };

  // Duplicate campaign
  const handleDuplicate = async (c) => {
    try {
      const id = c._id || c.id;
      await campaignService.duplicate(id);
      toast.success(`Duplicated '${c.name}' as a new draft`);
      setSuccess(`Duplicated '${c.name}' successfully`);
      setTimeout(() => setSuccess(null), 4000);
      fetchCampaigns();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to duplicate campaign");
    }
  };

  // Execute High-Impact Action upon confirmation
  const handleExecuteAction = async () => {
    if (!actionConfirm) return;
    const { type, campaign: c } = actionConfirm;
    const id = c._id || c.id;

    try {
      if (type === "activate") {
        await campaignService.activate(id);
        toast.success(`Campaign '${c.name}' is now active`);
        setSuccess(`Campaign '${c.name}' activated successfully`);
      } else if (type === "pause") {
        await campaignService.deactivate(id);
        toast.success(`Campaign '${c.name}' paused`);
        setSuccess(`Campaign '${c.name}' paused successfully`);
      } else if (type === "archive") {
        await campaignService.archive(id);
        toast.success(`Campaign '${c.name}' archived`);
        setSuccess(`Campaign '${c.name}' archived successfully`);
      }
      setTimeout(() => setSuccess(null), 4000);
      setActionConfirm(null);
      fetchCampaigns();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || `Failed to ${type} campaign`);
    }
  };

  // Open Performance modal
  const handleOpenPerformance = async (c) => {
    setSelectedPerfCampaign(c);
    setShowPerfModal(true);
    setPerfLoading(true);
    setPerfData(null);
    try {
      const res = await apiClient.get(`/campaign-performance/campaign/${c._id || c.id}`);
      setPerfData(res?.data?.data || res?.data);
    } catch {
      // Graceful fallback if no aggregated performance recorded yet
      setPerfData({
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      });
    } finally {
      setPerfLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#004D38] uppercase tracking-wider mb-1">
            <Sparkles className="size-3.5" />
            <span>Marketing Operations &amp; Sales Events</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Megaphone className="size-6 text-[#004D38]" />
            <span>Marketing Campaigns &amp; Flash Sales</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Coordinate seasonal sales events, promotional schedules, countdown deals, and multi-channel marketing campaigns across the marketplace.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCampaigns}
            className="p-2.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Campaigns"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Total Campaigns</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Live &amp; Active</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xl font-bold text-emerald-700">{stats.active}</span>
            {stats.active > 0 && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Scheduled</p>
          <p className="text-xl font-bold text-blue-700 mt-0.5">{stats.scheduled}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Drafts</p>
          <p className="text-xl font-bold text-slate-600 mt-0.5">{stats.draft}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Paused</p>
          <p className="text-xl font-bold text-amber-700 mt-0.5">{stats.paused}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-[11px] text-slate-500 font-medium">Completed / Archived</p>
          <p className="text-xl font-bold text-slate-700 mt-0.5">{stats.completed + stats.archived}</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Campaigns" },
            { id: "active", label: "Active" },
            { id: "scheduled", label: "Scheduled" },
            { id: "draft", label: "Draft" },
            { id: "paused", label: "Paused" },
            { id: "completed", label: "Completed" },
            { id: "archived", label: "Archived" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setStatusFilter(st.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? "bg-[#004D38] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Search, Scope, Type, and Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] text-xs bg-slate-50/50"
            />
          </form>

          <select
            value={scopeFilter}
            onChange={(e) => {
              setScopeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          >
            <option value="all">All Scopes</option>
            <option value="products">Products Only</option>
            <option value="categories">Categories Only</option>
            <option value="vendors">Vendors Only</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
          >
            <option value="all">All Campaign Types</option>
            <option value="seasonal">Seasonal Sales</option>
            <option value="flash_sale">Flash Sales</option>
            <option value="holiday">Holiday Specials</option>
            <option value="clearance">Clearance</option>
            <option value="brand_special">Brand Specials</option>
            <option value="general">General Events</option>
          </select>

          <input
            type="date"
            placeholder="Starts From"
            value={startDateFilter}
            onChange={(e) => {
              setStartDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
            title="Starts after this date"
          />

          <input
            type="date"
            placeholder="Ends Before"
            value={endDateFilter}
            onChange={(e) => {
              setEndDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
            title="Ends before this date"
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Campaign Event</th>
                <th className="px-5 py-3.5">Type &amp; Scope</th>
                <th className="px-5 py-3.5">Schedule Window</th>
                <th className="px-5 py-3.5">Target Assets</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-14 text-slate-400">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#004D38]" />
                    <span>Loading campaigns...</span>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-14 text-slate-400">
                    <Megaphone className="size-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="font-semibold text-slate-700">No campaigns found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Create your first marketing campaign or adjust active search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const id = c._id || c.id;
                  const isActive = c.status === "active";
                  const isScheduled = c.status === "scheduled";
                  const isDraft = c.status === "draft";
                  const isPaused = c.status === "paused";
                  const isCompleted = c.status === "completed";
                  const isArchived = c.status === "archived";

                  return (
                    <tr key={id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Campaign Name & Creative Thumbnail */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {c.bannerUrl ? (
                            <img
                              src={c.bannerUrl}
                              alt={c.name}
                              className="size-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="size-10 rounded-xl bg-[#004D38]/10 text-[#004D38] flex items-center justify-center shrink-0 font-bold">
                              <Megaphone className="size-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono mt-0.5">
                              <span>/{c.slug}</span>
                              <Link
                                href={`/campaign/${c.slug}${isDraft ? "?preview=true" : ""}`}
                                target="_blank"
                                className="text-[#004D38] hover:underline inline-flex items-center gap-0.5"
                                title="Open Storefront View"
                              >
                                <ExternalLink className="size-3" />
                              </Link>
                            </div>
                            {c.description && (
                              <p className="text-slate-500 text-[11px] mt-0.5 max-w-xs truncate">
                                {c.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type & Scope */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#004D38]/10 text-[#004D38] capitalize">
                            {c.type ? c.type.replace(/_/g, " ") : "general"}
                          </span>
                          <div className="text-slate-500 capitalize text-[11px]">
                            Scope: {c.scope || "Entire Store"}
                          </div>
                        </div>
                      </td>

                      {/* Schedule Window */}
                      <td className="px-5 py-3.5 text-slate-600">
                        <div className="space-y-0.5">
                          <div className="font-medium">
                            {c.startsAt ? new Date(c.startsAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }) : "—"}
                            <span className="text-slate-400 mx-1">→</span>
                            {c.endsAt ? new Date(c.endsAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }) : "—"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {c.timezone || "IST"}
                          </div>
                        </div>
                      </td>

                      {/* Target Assets Summary */}
                      <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                        <div>
                          {c.productIds?.length ? `${c.productIds.length} Products` : ""}
                          {c.categoryIds?.length ? `${c.categoryIds.length} Categories` : ""}
                          {!c.productIds?.length && !c.categoryIds?.length ? "Global Platform" : ""}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {c.couponIds?.length ? `${c.couponIds.length} Coupons` : "0 Coupons"}
                          {c.discountIds?.length ? ` • ${c.discountIds.length} Discounts` : ""}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isScheduled
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : isPaused
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : isArchived
                              ? "bg-slate-100 text-slate-400 border border-slate-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive
                                ? "bg-emerald-500 animate-pulse"
                                : isScheduled
                                ? "bg-blue-500"
                                : isPaused
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                          />
                          <span>{c.status || "draft"}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Play / Pause toggle with confirmation */}
                          {!isArchived && !isCompleted && (
                            <button
                              type="button"
                              onClick={() =>
                                setActionConfirm({
                                  type: isActive ? "pause" : "activate",
                                  campaign: c,
                                })
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isActive
                                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                              title={isActive ? "Pause Campaign" : "Activate Campaign"}
                            >
                              {isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                            </button>
                          )}

                          {/* Performance Stats Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenPerformance(c)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Performance Analytics"
                          >
                            <BarChart2 className="size-3.5" />
                          </button>

                          {/* Duplicate Campaign */}
                          <button
                            type="button"
                            onClick={() => handleDuplicate(c)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Duplicate Campaign"
                          >
                            <Copy className="size-3.5" />
                          </button>

                          {/* Edit Campaign */}
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Edit Campaign"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {/* Archive Campaign */}
                          {!isArchived && (
                            <button
                              type="button"
                              onClick={() =>
                                setActionConfirm({
                                  type: "archive",
                                  campaign: c,
                                })
                              }
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                              title="Archive Campaign"
                            >
                              <Archive className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing{" "}
            <span className="font-bold text-slate-700">
              {campaigns.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-bold text-slate-700">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            of <span className="font-bold text-slate-700">{pagination.total}</span> campaigns
          </div>

          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2 font-bold text-slate-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT CAMPAIGN MODAL */}
      <CampaignFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        campaign={editingCampaign}
        onSave={handleSaveCampaign}
      />

      {/* ACTION CONFIRMATION MODAL */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <AlertTriangle className="size-5 text-amber-500" />
              <span className="capitalize">{actionConfirm.type} Campaign</span>
            </div>

            <p className="text-slate-600">
              Are you sure you want to{" "}
              <strong className="text-slate-900">{actionConfirm.type}</strong> the campaign{" "}
              <span className="font-semibold text-slate-900">&quot;{actionConfirm.campaign.name}&quot;</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                className={`px-4 py-2 rounded-xl text-white font-bold cursor-pointer transition-colors ${
                  actionConfirm.type === "archive"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : actionConfirm.type === "pause"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#004D38] hover:bg-[#003828]"
                }`}
              >
                Confirm {actionConfirm.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERFORMANCE STATS MODAL */}
      {showPerfModal && selectedPerfCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BarChart2 className="size-5 text-[#004D38]" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {selectedPerfCampaign.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Performance Metrics &amp; Customer Conversions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPerfModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {perfLoading ? (
                <div className="text-center py-8 text-slate-400">
                  <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-[#004D38]" />
                  <span>Loading performance metrics...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <p className="text-[11px] text-slate-500 font-medium">Impressions</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {perfData?.impressions?.toLocaleString?.() || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                      <p className="text-[11px] text-slate-500 font-medium">Redemptions</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {perfData?.redemptions?.toLocaleString?.() || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/60">
                      <p className="text-[11px] text-emerald-800 font-medium">Orders Placed</p>
                      <p className="text-lg font-bold text-emerald-800 mt-0.5">
                        {perfData?.orders?.toLocaleString?.() || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/60">
                      <p className="text-[11px] text-emerald-800 font-medium">Net Revenue</p>
                      <p className="text-lg font-bold text-emerald-800 mt-0.5">
                        ₹{(perfData?.netRevenue ? Number(perfData.netRevenue.toString()) : 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 text-[11px] text-slate-600 border border-slate-200/60 flex items-center justify-between">
                    <span>Storefront Destination:</span>
                    <Link
                      href={`/campaign/${selectedPerfCampaign.slug}`}
                      target="_blank"
                      className="font-mono text-[#004D38] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>/campaign/{selectedPerfCampaign.slug}</span>
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPerfModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
