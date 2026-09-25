"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
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
  Eye,
  Sliders,
  Sparkles,
  Info,
  X,
  Save,
  Check,
  Power,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { BANNER_SLOTS, BANNER_SECTIONS } from "../../../constants/banner-slots.constants.js";
import { adminBannerService } from "../../../services/admin/banner.service.js";
import { PermissionGate } from "../PermissionGate.jsx";
import { cn } from "../../../utils/cn.js";
import { PERMISSIONS } from "../../../constants/permissions.js";

export function BannerSlotManager() {
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    altText: "",
    linkUrl: "",
    displayOrder: 0,
    isActive: true,
  });

  const [imageInputMode, setImageInputMode] = useState("upload"); // "upload" | "url" | "preset"
  const fileInputRef = useRef(null);

  // Fetch all banners (for manual refresh and after saves)
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
    let isMounted = true;
    adminBannerService
      .listBanners()
      .then((res) => {
        if (!isMounted) return;
        const items = Array.isArray(res?.data)
          ? res.data
          : res?.data?.banners || [];
        setBanners(items);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to load banners:", err);
        setError(err?.message || "Failed to load storefront banners. Please try again.");
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Map each slot to its configured banner in database (if any)
  const slotData = useMemo(() => {
    return BANNER_SLOTS.map((slot) => {
      const configured = banners.find(
        (b) => b.slotKey === slot.slotKey || b.placement === slot.slotKey
      );

      const isConfigured = !!configured;
      const isActive = configured ? configured.isActive !== false : true;
      const effectiveImage =
        configured?.imageUrl && configured.imageUrl.trim().length > 0
          ? configured.imageUrl
          : slot.defaultImage;
      const effectiveLink = configured?.linkUrl || slot.defaultLink;
      const effectiveAlt = configured?.altText || configured?.title || slot.defaultAlt;

      return {
        slot,
        configuredBanner: configured || null,
        isConfigured,
        isActive,
        effectiveImage,
        effectiveLink,
        effectiveAlt,
        isCustom: isConfigured && configured.imageUrl && configured.isActive,
      };
    });
  }, [banners]);

  // Filtered Slots
  const filteredSlots = useMemo(() => {
    return slotData.filter(({ slot }) => {
      const matchesSection =
        activeSection === "all" || slot.section === activeSection;
      const matchesSearch =
        !searchQuery ||
        slot.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        slot.slotKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        slot.sectionLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSection && matchesSearch;
    });
  }, [slotData, activeSection, searchQuery]);

  // Open Edit Modal for a slot
  const handleOpenEdit = (item) => {
    const { slot, configuredBanner } = item;
    setSelectedSlot(slot);
    setEditingBanner(configuredBanner);
    setValidationError(null);

    if (configuredBanner) {
      setFormData({
        title: configuredBanner.title || slot.title,
        imageUrl: configuredBanner.imageUrl || slot.defaultImage,
        altText: configuredBanner.altText || slot.defaultAlt,
        linkUrl: configuredBanner.linkUrl || slot.defaultLink,
        displayOrder: configuredBanner.displayOrder ?? slot.displayOrder ?? 0,
        isActive: configuredBanner.isActive !== false,
      });
      setImageInputMode(
        configuredBanner.imageUrl?.startsWith("data:") ? "upload" : "url"
      );
    } else {
      setFormData({
        title: slot.title,
        imageUrl: slot.defaultImage,
        altText: slot.defaultAlt,
        linkUrl: slot.defaultLink,
        displayOrder: slot.displayOrder ?? 0,
        isActive: true,
      });
      setImageInputMode("preset");
    }

    setIsModalOpen(true);
  };

  // Handle Image File Upload (FileReader to Data URL)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setValidationError("Please select a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError("Image file size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl && typeof dataUrl === "string") {
        setFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
        setValidationError(null);
        toast.info("Image loaded for preview");
      }
    };
    reader.onerror = () => {
      setValidationError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  // Toggle Active Status directly from card
  const handleToggleActive = async (item) => {
    const { slot, configuredBanner, isActive } = item;
    const newActiveState = !isActive;

    try {
      if (configuredBanner) {
        // Update existing banner
        await adminBannerService.updateBanner(configuredBanner._id, {
          isActive: newActiveState,
        });
        toast.success(
          `Slot ${slot.slotKey} ${newActiveState ? "enabled" : "disabled"}`
        );
      } else {
        // Create new banner with inactive/active state
        await adminBannerService.createBanner({
          title: slot.title,
          slotKey: slot.slotKey,
          placement: slot.slotKey,
          imageUrl: slot.defaultImage,
          linkUrl: slot.defaultLink,
          altText: slot.defaultAlt,
          isActive: newActiveState,
        });
        toast.success(`Slot ${slot.slotKey} updated`);
      }
      await fetchBanners();
    } catch (err) {
      console.error("Toggle active error:", err);
      toast.error(err?.message || "Failed to update banner status");
    }
  };

  // Reset to default / Delete custom banner
  const handleResetToDefault = async (item) => {
    const { slot, configuredBanner } = item;
    if (!configuredBanner) {
      toast.info("Slot is already using system default artwork");
      return;
    }

    const confirmed = window.confirm(
      `Reset "${slot.title}" to system default artwork? This will remove custom configuration.`
    );
    if (!confirmed) return;

    try {
      await adminBannerService.deleteBanner(configuredBanner._id);
      toast.success(`Slot ${slot.slotKey} reset to system fallback`);
      await fetchBanners();
    } catch (err) {
      console.error("Reset banner error:", err);
      toast.error(err?.message || "Failed to reset banner");
    }
  };

  // Save Banner Form
  const handleSaveBanner = async (e) => {
    e.preventDefault();
    setValidationError(null);

    if (!formData.title?.trim()) {
      setValidationError("Banner title is required.");
      return;
    }

    if (!formData.imageUrl?.trim()) {
      setValidationError("Banner image URL or file is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        slotKey: selectedSlot.slotKey,
        placement: selectedSlot.slotKey,
        altText: formData.altText?.trim() || selectedSlot.defaultAlt,
        imageUrl: formData.imageUrl.trim(),
        linkUrl: formData.linkUrl?.trim() || selectedSlot.defaultLink,
        displayOrder: Number(formData.displayOrder) || 0,
        isActive: formData.isActive,
      };

      if (editingBanner?._id) {
        await adminBannerService.updateBanner(editingBanner._id, payload);
        toast.success(`Banner slot "${selectedSlot.slotKey}" updated successfully!`);
      } else {
        await adminBannerService.createBanner(payload);
        toast.success(`Banner slot "${selectedSlot.slotKey}" saved successfully!`);
      }

      setIsModalOpen(false);
      await fetchBanners();
    } catch (err) {
      console.error("Save banner error:", err);
      setValidationError(err?.message || "Failed to save banner slot. Please check fields.");
      toast.error("Failed to save banner slot");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <ImageIcon className="size-6 text-emerald-400" />
              Homepage Banner Slot Manager
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              CMS Live
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Control homepage promotional artwork without code deployment. Changes reflect live on the storefront.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchBanners}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            <span>Refresh</span>
          </button>
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500 transition-all cursor-pointer"
          >
            <span>View Storefront</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Section Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Section Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {BANNER_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                )}
              >
                {sec.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search slot or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && slotData.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 rounded-2xl border border-slate-800 bg-slate-900/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-rose-800/40 bg-rose-950/20 p-4 text-rose-300 flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Banner Slot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSlots.map((item) => {
          const {
            slot,
            configuredBanner,
            isConfigured,
            isActive,
            effectiveImage,
            effectiveLink,
            effectiveAlt,
            isCustom,
          } = item;

          return (
            <div
              key={slot.slotKey}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-slate-900/90 shadow-sm transition-all duration-200 hover:border-slate-700",
                !isActive
                  ? "border-slate-800/60 opacity-75"
                  : isCustom
                  ? "border-emerald-500/40 shadow-emerald-950/20"
                  : "border-slate-800"
              )}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-800/80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {slot.sectionLabel}
                    </span>
                    <h3 className="text-sm font-bold text-white leading-snug">
                      {slot.title}
                    </h3>
                    <code className="text-[11px] text-slate-400 font-mono">
                      {slot.slotKey}
                    </code>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {!isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-700">
                        Disabled
                      </span>
                    ) : isCustom ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Admin Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                        Fallback Default
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Visual Image Preview */}
              <div className="p-4 flex flex-col gap-3">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center group-hover:border-slate-700 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={effectiveImage}
                    alt={effectiveAlt}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.src = slot.defaultImage;
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-2.5 flex items-center justify-between text-[11px] text-slate-300">
                    <span className="truncate max-w-[200px]" title={effectiveAlt}>
                      {effectiveAlt}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {slot.recommendedDimensions}
                    </span>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <LinkIcon className="size-3 text-slate-500 shrink-0" />
                    <span className="text-slate-500 shrink-0">Link:</span>
                    <span className="text-slate-300 truncate font-mono text-[11px]">
                      {effectiveLink}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Action Controls */}
              <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-2">
                {/* Active Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  title={isActive ? "Disable this banner (will use fallback)" : "Enable this banner"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                    isActive
                      ? "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
                  )}
                >
                  <Power className="size-3" />
                  <span>{isActive ? "Active" : "Inactive"}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Reset to default */}
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => handleResetToDefault(item)}
                      title="Reset to system fallback artwork"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}

                  {/* Edit Artwork Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white border border-slate-700 transition-all cursor-pointer"
                  >
                    <Edit3 className="size-3.5 text-emerald-400" />
                    <span>Configure Slot</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Slot Modal / Slide-Over Drawer */}
      {isModalOpen && selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  {selectedSlot.sectionLabel}
                </span>
                <h2 className="text-lg font-black text-white">
                  Configure Slot: {selectedSlot.title}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Slot Key: <code className="text-emerald-400 font-mono">{selectedSlot.slotKey}</code> • Recommended: {selectedSlot.recommendedDimensions}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Validation Error Alert */}
            {validationError && (
              <div className="mt-4 rounded-lg border border-rose-800/50 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveBanner} className="mt-4 space-y-4">
              {/* Visual Live Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Artwork Preview
                </label>
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formData.imageUrl || selectedSlot.defaultImage}
                    alt={formData.altText || selectedSlot.defaultAlt}
                    className="size-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = selectedSlot.defaultImage;
                    }}
                  />
                  <div className="absolute top-2 right-2 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-mono text-slate-300 backdrop-blur-xs">
                    Live Preview
                  </div>
                </div>
              </div>

              {/* Image Input Selector Tabs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Artwork Source
                  </label>
                  <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                    <button
                      type="button"
                      onClick={() => setImageInputMode("upload")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                        imageInputMode === "upload"
                          ? "bg-slate-800 text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      File Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode("url")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                        imageInputMode === "url"
                          ? "bg-slate-800 text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Image URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageInputMode("preset");
                        setFormData((p) => ({ ...p, imageUrl: selectedSlot.defaultImage }));
                      }}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                        imageInputMode === "preset"
                          ? "bg-slate-800 text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Preset Default
                    </button>
                  </div>
                </div>

                {imageInputMode === "upload" && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 text-center hover:border-emerald-500/50 hover:bg-slate-950 transition-all cursor-pointer group"
                  >
                    <Upload className="size-7 text-slate-500 group-hover:text-emerald-400 transition-colors mb-2" />
                    <p className="text-xs font-semibold text-slate-300">
                      Click to upload replacement image
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      PNG, JPG, WebP, or SVG (Up to 5MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {imageInputMode === "url" && (
                  <input
                    type="text"
                    placeholder="https://... or /images/banners/..."
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                )}

                {imageInputMode === "preset" && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-300">System Default Asset</p>
                      <code className="text-[11px] text-emerald-400 font-mono">
                        {selectedSlot.defaultImage}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({ ...p, imageUrl: selectedSlot.defaultImage }))
                      }
                      className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-white hover:bg-slate-700"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Title & Alt Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Slot Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alt Text (Accessibility)
                  </label>
                  <input
                    type="text"
                    value={formData.altText}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, altText: e.target.value }))
                    }
                    placeholder="Short description of artwork"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Destination Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.linkUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, linkUrl: e.target.value }))
                    }
                    placeholder="/shop?category=audio or https://..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({ ...p, linkUrl: selectedSlot.defaultLink }))
                    }
                    title="Reset to default category link"
                    className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs text-slate-300 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Display Order & Active Switch */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                      }
                      className="size-4 rounded-sm border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-300">
                      Enable Banner on Storefront
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Order:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        displayOrder: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white text-center"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Saving Artwork...</span>
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      <span>Save Artwork</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BannerSlotManager;
