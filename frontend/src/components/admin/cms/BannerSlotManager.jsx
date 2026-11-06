"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
  ExternalLink,
  Sparkles,
  Info,
  X,
  Power,
  Layers,
  LayoutGrid,
  List,
  Search,
  Plus,
  ArrowRight,
  Tag,
  Globe,
  SlidersHorizontal,
  Calendar,
  Eye,
  Check,
  Clock,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { BANNER_SLOTS, BANNER_SECTIONS } from "../../../constants/banner-slots.constants.js";
import { adminBannerService } from "../../../services/admin/banner.service.js";
import { cn } from "../../../utils/cn.js";
import { StoreBannerFormModal } from "./StoreBannerFormModal.jsx";
import {
  StoreBannerPreviewModal,
  getBannerScheduleStatus,
} from "./StoreBannerPreviewModal.jsx";

// Human-friendly section categorization for clean UI separation
const SECTION_CONFIG = [
  {
    id: "all",
    label: "All Store Banners",
    description: "Complete catalogue of promotional assets across the entire storefront",
    icon: Layers,
  },
  {
    id: "hero_main",
    label: "Hero Showcase Carousel",
    description: "Main showcase carousel slides (2/3 width) on homepage hero",
    icon: Sparkles,
    slotKeys: ["hero_main"],
    dimensions: "840 × 430 px (~2:1)",
  },
  {
    id: "hero_mini",
    label: "Hero Mini Side Cards",
    description: "3 vertical mini cards adjacent to the hero showcase carousel",
    icon: LayoutGrid,
    slotKeys: ["hero_audio", "hero_smart_home", "hero_brand_deals"],
    dimensions: "384 × 115 px (~3.3:1)",
  },
  {
    id: "mid_page",
    label: "Mid-Page Campaign Banners",
    description: "High-impact split row banners (67% productivity / 33% lifestyle)",
    icon: SlidersHorizontal,
    slotKeys: ["mid_work_smarter", "mid_stylish_looks"],
    dimensions: "840 × 260 px & 420 × 260 px",
  },
  {
    id: "category_highlights",
    label: "Category Highlights",
    description: "3-column curated category feature promotion cards",
    icon: Tag,
    slotKeys: ["category_audio", "category_workspace", "category_smart_living"],
    dimensions: "400 × 300 px (4:3 or 16:9)",
  },
  {
    id: "bottom_promos",
    label: "Bottom Seasonal Promos",
    description: "Seasonal promotional tri-banners near the page footer",
    icon: Globe,
    slotKeys: ["bottom_home_kitchen", "bottom_smart_gadgets", "bottom_monsoon_special"],
    dimensions: "400 × 300 px (4:3 or 16:9)",
  },
];

export function BannerSlotManager() {
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & View State
  const [activeSection, setActiveSection] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive" | "scheduled" | "expired"
  const [slotFilter, setSlotFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order"); // "order" | "title" | "newest"
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

  // Modal State for Add / Edit
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);

  // Modal State for Preview
  const [previewingBanner, setPreviewingBanner] = useState(null);

  // Delete Confirmation Modal State
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all banners from backend
  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminBannerService.listBanners();
      const items = Array.isArray(res?.data)
        ? res.data
        : res?.data?.banners || [];
      setBanners(items);
    } catch (err) {
      console.error("Failed to load banners:", err);
      setError(err?.message || "Failed to load storefront banners. Please try again.");
      toast.error("Failed to fetch banners");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Aggregate KPI Statistics
  const stats = useMemo(() => {
    const total = banners.length;
    const now = new Date();

    const active = banners.filter((b) => {
      if (b.isActive === false) return false;
      if (b.startsAt && new Date(b.startsAt) > now) return false;
      if (b.endsAt && new Date(b.endsAt) < now) return false;
      return true;
    }).length;

    const inactive = banners.filter((b) => b.isActive === false).length;

    const scheduled = banners.filter(
      (b) => b.isActive !== false && Boolean(b.startsAt || b.endsAt)
    ).length;

    // Slot Utilization: How many of the 12 predefined slots have at least 1 active banner
    const populatedSlots = new Set(
      banners
        .filter((b) => b.isActive !== false)
        .map((b) => b.slotKey || b.placement)
        .filter(Boolean)
    );
    const totalSlots = BANNER_SLOTS.length;
    const slotCoveragePercent = Math.round((populatedSlots.size / totalSlots) * 100);

    return {
      total,
      active,
      inactive,
      scheduled,
      activeSlots: populatedSlots.size,
      totalSlots,
      slotCoveragePercent,
    };
  }, [banners]);

  // Filtered & Sorted Banners
  const filteredBanners = useMemo(() => {
    const now = new Date();

    return banners
      .filter((b) => {
        const slot = b.slotKey || b.placement || "";

        // Section filtering
        if (activeSection !== "all") {
          const secConfig = SECTION_CONFIG.find((s) => s.id === activeSection);
          if (secConfig && secConfig.slotKeys && !secConfig.slotKeys.includes(slot)) {
            return false;
          }
        }

        // Specific slot filtering
        if (slotFilter !== "all" && slot !== slotFilter) {
          return false;
        }

        // Status filtering
        if (statusFilter === "active") {
          if (b.isActive === false) return false;
          if (b.startsAt && new Date(b.startsAt) > now) return false;
          if (b.endsAt && new Date(b.endsAt) < now) return false;
        } else if (statusFilter === "inactive") {
          if (b.isActive !== false) return false;
        } else if (statusFilter === "scheduled") {
          if (b.isActive === false || !b.startsAt || new Date(b.startsAt) <= now) {
            return false;
          }
        } else if (statusFilter === "expired") {
          if (!b.endsAt || new Date(b.endsAt) >= now) return false;
        }

        // Search query filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const titleMatch = (b.title || "").toLowerCase().includes(q);
          const slotMatch = slot.toLowerCase().includes(q);
          const subtitleMatch = (b.subtitle || "").toLowerCase().includes(q);
          const badgeMatch = (b.badge || "").toLowerCase().includes(q);
          const linkMatch = (b.linkUrl || "").toLowerCase().includes(q);
          if (!titleMatch && !slotMatch && !subtitleMatch && !badgeMatch && !linkMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "order") {
          return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        }
        if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "");
        }
        if (sortBy === "newest") {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        return 0;
      });
  }, [banners, activeSection, slotFilter, statusFilter, searchQuery, sortBy]);

  // Open Create Modal
  const handleOpenCreate = (presetSlotKey = null) => {
    setEditingBanner(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (banner) => {
    setEditingBanner(banner);
    setIsFormModalOpen(true);
  };

  // Toggle Active/Inactive Status directly from card
  const handleToggleActive = async (banner) => {
    const newStatus = !banner.isActive;
    try {
      await adminBannerService.updateBanner(banner._id, {
        isActive: newStatus,
      });
      toast.success(
        `Banner "${banner.title}" is now ${newStatus ? "LIVE on storefront" : "HIDDEN from storefront"}`
      );
      await fetchBanners();
    } catch (err) {
      console.error("Toggle banner error:", err);
      toast.error(err?.message || "Failed to update banner status");
    }
  };

  // Save Banner (Create or Update from Modal)
  const handleSaveBanner = async (payload, bannerId) => {
    if (bannerId) {
      await adminBannerService.updateBanner(bannerId, payload);
      toast.success(`Banner "${payload.title}" updated successfully!`);
    } else {
      await adminBannerService.createBanner(payload);
      toast.success(`New banner "${payload.title}" created successfully!`);
    }
    await fetchBanners();
  };

  // Confirm Delete Action
  const handleDeleteConfirm = async () => {
    if (!bannerToDelete) return;
    setIsDeleting(true);
    try {
      await adminBannerService.deleteBanner(bannerToDelete._id);
      toast.success(`Banner "${bannerToDelete.title}" deleted successfully`);
      setBannerToDelete(null);
      await fetchBanners();
    } catch (err) {
      console.error("Delete banner error:", err);
      toast.error(err?.message || "Failed to delete banner");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to get friendly slot details
  const getSlotDetails = (slotKey) => {
    return (
      BANNER_SLOTS.find((s) => s.slotKey === slotKey) || {
        slotKey,
        title: slotKey,
        sectionLabel: "General Banner",
        recommendedDimensions: "Responsive Banner",
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card with Live Status & Controls */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <ImageIcon className="size-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Store Banners (CMS)
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CMS Live
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Publish, schedule, and curate homepage promotional artwork across all 12 storefront placement slots.
              Changes reflect live on the storefront immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fetchBanners}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>

            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              <span>View Storefront</span>
              <ExternalLink className="size-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>Add New Banner</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Banners</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">All configured banners</p>
          </div>

          <div className="rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 p-4 border border-emerald-100 dark:border-emerald-900/40">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active on Store</p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{stats.active}</p>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Currently visible live</p>
          </div>

          <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 p-4 border border-amber-100 dark:border-amber-900/40">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Scheduled Windows</p>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">{stats.scheduled}</p>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Time-bound dates</p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Inactive / Hidden</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.inactive}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Unpublished drafts</p>
          </div>

          <div className="rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 p-4 border border-purple-100 dark:border-purple-900/40 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">Slot Coverage</p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300">
                {stats.activeSlots}
              </span>
              <span className="text-xs text-purple-500 font-bold">/ {stats.totalSlots} Slots</span>
            </div>
            <div className="w-full bg-purple-200 dark:bg-purple-900/50 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-500"
                style={{ width: `${stats.slotCoveragePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Section Placement Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SECTION_CONFIG.map((sec) => {
          const isActive = activeSection === sec.id;
          const Icon = sec.icon;

          let count = 0;
          if (sec.id === "all") {
            count = banners.length;
          } else if (sec.slotKeys) {
            count = banners.filter((b) =>
              sec.slotKeys.includes(b.slotKey || b.placement)
            ).length;
          }

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer",
                isActive
                  ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
              )}
            >
              <Icon className="size-3.5" />
              <span>{sec.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Search, Status Filters, Slot Dropdown & View Mode Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-800/70 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Pills */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 text-xs">
            {[
              { id: "all", label: "All Status" },
              { id: "active", label: "Active Live" },
              { id: "scheduled", label: "Scheduled" },
              { id: "inactive", label: "Hidden" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={cn(
                  "rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer",
                  statusFilter === st.id
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Specific Slot Filter Dropdown */}
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="all">Filter: All Specific Slots</option>
            {BANNER_SLOTS.map((s) => (
              <option key={s.slotKey} value={s.slotKey}>
                {s.title}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="order">Sort: Display Order</option>
            <option value="title">Sort: Title A-Z</option>
            <option value="newest">Sort: Newest First</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, slot, badge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-7 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid View"
              className={cn(
                "rounded-lg p-1.5 transition-all cursor-pointer",
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-label="Table View"
              className={cn(
                "rounded-lg p-1.5 transition-all cursor-pointer",
                viewMode === "table"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Loading & Error States */}
      {isLoading && banners.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-80 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchBanners}
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 5. Empty State */}
      {!isLoading && filteredBanners.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-12 text-center space-y-4">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ImageIcon className="size-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No store banners found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {searchQuery || statusFilter !== "all" || slotFilter !== "all"
                ? "No banners match your active filters. Try clearing your search or status filters."
                : "No promotional banners configured yet for this section. Click below to add one."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {(searchQuery || statusFilter !== "all" || slotFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSlotFilter("all");
                }}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create New Banner</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. Card Grid View */}
      {!isLoading && viewMode === "grid" && filteredBanners.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBanners.map((banner) => {
            const slotKey = banner.slotKey || banner.placement;
            const slotDetails = getSlotDetails(slotKey);
            const scheduleInfo = getBannerScheduleStatus(banner);
            const isActive = banner.isActive !== false;

            return (
              <div
                key={banner._id}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white dark:bg-slate-900 shadow-xs transition-all duration-300 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700",
                  !isActive
                    ? "border-slate-200 dark:border-slate-800/70 opacity-80"
                    : "border-slate-200 dark:border-slate-800"
                )}
              >
                <div>
                  {/* Top Bar on Card */}
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {slotDetails.sectionLabel || "Placement"}
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {slotDetails.title}
                      </span>
                    </div>

                    {/* Active Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner)}
                      title={isActive ? "Click to deactivate" : "Click to activate"}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer border",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <Power className={cn("size-3", isActive ? "text-emerald-600" : "text-slate-400")} />
                      <span>{isActive ? "Active" : "Inactive"}</span>
                    </button>
                  </div>

                  {/* Artwork Preview Box */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                    {banner.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={banner.imageUrl}
                        alt={banner.altText || banner.title}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center text-slate-500">
                        <ImageIcon className="size-8 mb-1 opacity-50" />
                        <span className="text-xs">No artwork set</span>
                      </div>
                    )}

                    {/* Badges Overlay */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                      {banner.badge && (
                        <span className="rounded-lg bg-emerald-600/90 text-white px-2 py-0.5 text-[10px] font-bold backdrop-blur-xs shadow-2xs">
                          {banner.badge}
                        </span>
                      )}
                      <span className="rounded-lg bg-slate-900/80 text-white px-2 py-0.5 text-[10px] font-mono backdrop-blur-xs border border-slate-700">
                        {slotKey}
                      </span>
                    </div>

                    {/* Schedule Status Badge Top-Right */}
                    <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold border backdrop-blur-xs",
                          scheduleInfo.badgeClass
                        )}
                      >
                        {scheduleInfo.label}
                      </span>
                    </div>

                    {!isActive && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10">
                        <span className="rounded-full bg-slate-900/90 border border-slate-700 text-amber-300 px-3 py-1 text-xs font-bold shadow-lg">
                          Hidden on Storefront
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                      {banner.title}
                    </h4>
                    {banner.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {banner.subtitle}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <LinkIcon className="size-3 shrink-0" />
                        <span className="truncate font-mono">{banner.linkUrl || "/shop"}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Order #{banner.displayOrder ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    type="button"
                    onClick={() => setPreviewingBanner(banner)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    <Eye className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Preview</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(banner)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBannerToDelete(banner)}
                      className="inline-flex items-center justify-center size-8 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                      title="Delete banner"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Detailed Data Table View */}
      {!isLoading && viewMode === "table" && filteredBanners.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Artwork</th>
                  <th className="py-3.5 px-4">Title & Placement</th>
                  <th className="py-3.5 px-4">Dimensions</th>
                  <th className="py-3.5 px-4">Destination Link</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Schedule / Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBanners.map((banner) => {
                  const slotKey = banner.slotKey || banner.placement;
                  const slotDetails = getSlotDetails(slotKey);
                  const scheduleInfo = getBannerScheduleStatus(banner);
                  const isActive = banner.isActive !== false;

                  return (
                    <tr
                      key={banner._id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="size-12 rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                          {banner.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={banner.imageUrl}
                              alt={banner.title}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="size-5 text-slate-600" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {banner.title}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                              {slotKey}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              • {slotDetails.sectionLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {slotDetails.recommendedDimensions}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-slate-500 font-mono text-[11px]">
                        {banner.linkUrl || "/shop"}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        #{banner.displayOrder ?? 0}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(banner)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-all cursor-pointer border",
                              isActive
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            )}
                          >
                            <Power className={cn("size-3", isActive ? "text-emerald-600" : "text-slate-400")} />
                            <span>{isActive ? "Active" : "Inactive"}</span>
                          </button>
                          {(banner.startsAt || banner.endsAt) && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {scheduleInfo.label}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewingBanner(banner)}
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            title="Preview in slot"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(banner)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit banner"
                          >
                            <Edit3 className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setBannerToDelete(banner)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Delete banner"
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
        </div>
      )}

      {/* 8. Structured Create / Edit Banner Modal */}
      <StoreBannerFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        banner={editingBanner}
        onSave={handleSaveBanner}
      />

      {/* 9. Live Storefront Preview Modal */}
      <StoreBannerPreviewModal
        isOpen={Boolean(previewingBanner)}
        onClose={() => setPreviewingBanner(null)}
        banner={previewingBanner}
      />

      {/* 10. Delete Confirmation Modal */}
      {bannerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900/60">
              <Trash2 className="size-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Banner Artwork?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  &quot;{bannerToDelete.title}&quot;
                </span>
                ? This banner will be permanently removed from the storefront.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBannerToDelete(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BannerSlotManager;
