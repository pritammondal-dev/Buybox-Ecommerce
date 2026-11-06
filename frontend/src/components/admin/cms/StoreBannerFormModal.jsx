"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Link as LinkIcon,
  Layers,
  Upload,
  ExternalLink,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Tag,
  Clock,
  Check,
  AlertCircle,
  Smartphone,
  Monitor,
  CheckCircle2,
  SlidersHorizontal,
  FileCheck,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BANNER_SLOTS } from "../../../constants/banner-slots.constants.js";
import { adminMediaService } from "../../../services/admin/admin.service.js";
import { cn } from "../../../utils/cn.js";

// Presets for quick asset selection
const PRESET_ASSETS = [
  {
    name: "Work Smarter (Mid-Banner 1)",
    url: "/images/banners/banner-work-smarter.png",
    slotKey: "mid_work_smarter",
    alt: "Work Smarter Productivity Setup",
  },
  {
    name: "Stylish Looks (Mid-Banner 2)",
    url: "/images/banners/banner-stylish-looks.png",
    slotKey: "mid_stylish_looks",
    alt: "Stylish Looks Fashion & Accessories",
  },
  {
    name: "Audio Essentials (Hero Card 1)",
    url: "/images/banners/promo-audio-essentials.svg",
    slotKey: "hero_audio",
    alt: "Audio Essentials - Up to 40% Off",
  },
  {
    name: "Smart Home (Hero Card 2)",
    url: "/images/banners/promo-smart-home.svg",
    slotKey: "hero_smart_home",
    alt: "Smart Devices for a Smarter Home",
  },
  {
    name: "Brand Deals (Hero Card 3)",
    url: "/images/banners/promo-brand-deals.svg",
    slotKey: "hero_brand_deals",
    alt: "Exclusive Brand Deals",
  },
  {
    name: "Audio Mood (Category 1)",
    url: "/images/banners/cat-audio-mood.png",
    slotKey: "category_audio",
    alt: "Audio for Every Mood",
  },
  {
    name: "Workspace Upgrade (Category 2)",
    url: "/images/banners/cat-workspace-upgrade.png",
    slotKey: "category_workspace",
    alt: "Upgrade Your Workspace",
  },
  {
    name: "Smart Living (Category 3)",
    url: "/images/banners/cat-smart-living.png",
    slotKey: "category_smart_living",
    alt: "Smart Living Essentials",
  },
  {
    name: "Home & Kitchen (Bottom 1)",
    url: "/images/banners/promo-home-kitchen.png",
    slotKey: "bottom_home_kitchen",
    alt: "Home & Kitchen - Up to 60% Off",
  },
  {
    name: "Smart Gadgets (Bottom 2)",
    url: "/images/banners/promo-smart-gadgets.svg",
    slotKey: "bottom_smart_gadgets",
    alt: "Smart Gadgets for a Smarter You",
  },
  {
    name: "Monsoon Special (Bottom 3)",
    url: "/images/banners/promo-monsoon-special.svg",
    slotKey: "bottom_monsoon_special",
    alt: "Monsoon Special - Waterproof Gear",
  },
  {
    name: "Bank Offers (Hero Showcase)",
    url: "/images/banners/banner-bank-offers.svg",
    slotKey: "hero_main",
    alt: "Bank & Partner Offers",
  },
];

// 6 Form Workflow Sections
const FORM_SECTIONS = [
  { id: 1, label: "General Information", icon: Tag },
  { id: 2, label: "Artwork & Media", icon: ImageIcon },
  { id: 3, label: "Placement & Order", icon: Layers },
  { id: 4, label: "Destination & Link", icon: LinkIcon },
  { id: 5, label: "Schedule & Status", icon: Calendar },
  { id: 6, label: "Preview & Publish", icon: Eye },
];

// Helper to convert ISO string to datetime-local input value
function toDatetimeLocal(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

// Helper to convert datetime-local input string to ISO string or null
function toIsoOrNull(localStr) {
  if (!localStr || !localStr.trim()) return null;
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function StoreBannerFormModal({
  isOpen,
  onClose,
  banner = null,
  onSave,
}) {
  const isEditing = Boolean(banner?._id || banner?.id);

  // Active workflow section tab (1 to 6)
  const [activeSection, setActiveSection] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    badge: "",
    ctaText: "Shop Now",
    slotKey: "hero_main",
    imageUrl: "",
    mobileImageUrl: "",
    linkUrl: "/shop",
    altText: "",
    campaignId: "",
    displayOrder: 0,
    isActive: true,
    isScheduled: false,
    startsAt: "",
    endsAt: "",
  });

  const [initialData, setInitialData] = useState(null);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingMobile, setIsUploadingMobile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageInputMode, setImageInputMode] = useState("upload"); // "upload" | "url" | "preset"
  const [previewDevice, setPreviewDevice] = useState("desktop"); // "desktop" | "mobile"

  const fileInputRef = useRef(null);
  const mobileFileInputRef = useRef(null);

  // Populate form when modal opens or banner changes
  useEffect(() => {
    if (isOpen) {
      if (banner) {
        const slot = banner.slotKey || banner.placement || "hero_main";
        const initial = {
          title: banner.title || "",
          subtitle: banner.subtitle || "",
          badge: banner.badge || "",
          ctaText: banner.ctaText || "Shop Now",
          slotKey: slot,
          imageUrl: banner.imageUrl || "",
          mobileImageUrl: banner.mobileImageUrl || "",
          linkUrl: banner.linkUrl || "/shop",
          altText: banner.altText || "",
          campaignId: banner.campaignId?._id || banner.campaignId || "",
          displayOrder: banner.displayOrder ?? 0,
          isActive: banner.isActive !== false,
          isScheduled: Boolean(banner.startsAt || banner.endsAt),
          startsAt: toDatetimeLocal(banner.startsAt),
          endsAt: toDatetimeLocal(banner.endsAt),
        };
        setFormData(initial);
        setInitialData(initial);
        setImageInputMode(initial.imageUrl?.startsWith("data:") ? "upload" : "url");
      } else {
        const defaultSlot = "hero_main";
        const initial = {
          title: "",
          subtitle: "",
          badge: "Featured Showcase",
          ctaText: "Shop Now",
          slotKey: defaultSlot,
          imageUrl: "",
          mobileImageUrl: "",
          linkUrl: "/shop",
          altText: "",
          campaignId: "",
          displayOrder: 0,
          isActive: true,
          isScheduled: false,
          startsAt: "",
          endsAt: "",
        };
        setFormData(initial);
        setInitialData(initial);
        setImageInputMode("upload");
      }
      setErrors({});
      setActiveSection(1);
    }
  }, [isOpen, banner]);

  if (!isOpen) return null;

  // Selected slot definition
  const currentSlotDef =
    BANNER_SLOTS.find((s) => s.slotKey === formData.slotKey) || BANNER_SLOTS[0];

  // Client-side Validation
  const validateForm = () => {
    const errs = {};

    if (!formData.title?.trim()) {
      errs.title = "Banner title is required.";
    } else if (formData.title.trim().length > 200) {
      errs.title = "Title cannot exceed 200 characters.";
    }

    if (formData.subtitle && formData.subtitle.length > 300) {
      errs.subtitle = "Subtitle cannot exceed 300 characters.";
    }

    if (formData.badge && formData.badge.length > 50) {
      errs.badge = "Badge cannot exceed 50 characters.";
    }

    if (formData.ctaText && formData.ctaText.length > 50) {
      errs.ctaText = "CTA button text cannot exceed 50 characters.";
    }

    if (!formData.imageUrl?.trim()) {
      errs.imageUrl = "Primary banner artwork is required.";
    } else if (formData.imageUrl.trim().startsWith("data:image/")) {
      errs.imageUrl =
        "Base64 raw image data is not allowed. Please upload to server storage.";
    }

    if (formData.linkUrl?.trim()) {
      const url = formData.linkUrl.trim();
      const isValid =
        url.startsWith("/") ||
        url.startsWith("#") ||
        url.startsWith("http://") ||
        url.startsWith("https://");
      if (!isValid) {
        errs.linkUrl =
          "Destination link must be a valid path (e.g. /shop) or full URL (https://...).";
      }
    }

    if (formData.isScheduled) {
      if (formData.startsAt && formData.endsAt) {
        const start = new Date(formData.startsAt);
        const end = new Date(formData.endsAt);
        if (start >= end) {
          errs.endsAt = "End date and time must be after the start date and time.";
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Upload handler for primary desktop artwork
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict security check matching backend
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (ext === ".svg" || file.type === "image/svg+xml") {
      setErrors((prev) => ({
        ...prev,
        imageUrl:
          "SVG uploads are disabled for security reasons (XSS prevention). Please upload PNG, WebP, JPEG, or AVIF.",
      }));
      toast.error("SVG uploads are disabled for security reasons.");
      return;
    }

    // 2 MB Size check
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: "File size exceeds 2MB limit. Please upload an image smaller than 2MB.",
      }));
      toast.error("Image file size exceeds 2MB limit.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setErrors((prev) => ({ ...prev, imageUrl: null }));

    try {
      setUploadProgress(50);
      const res = await adminMediaService.uploadMedia(file);
      setUploadProgress(90);

      const fileUrl =
        res?.data?.url || res?.url || res?.data?.fileUrl || res?.fileUrl;

      if (!fileUrl) {
        throw new Error("Invalid upload response from server.");
      }

      setFormData((prev) => ({
        ...prev,
        imageUrl: fileUrl,
        altText: prev.altText || file.name.replace(/\.[^/.]+$/, ""),
      }));
      setUploadProgress(100);
      toast.success("Primary artwork uploaded to server storage!");
    } catch (err) {
      console.error("Artwork upload error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to upload image. Please try again.";
      setErrors((prev) => ({ ...prev, imageUrl: msg }));
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  // Upload handler for optional mobile artwork
  const handleMobileFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (ext === ".svg" || file.type === "image/svg+xml") {
      toast.error("SVG uploads are disabled for security. Please upload PNG, WebP, or JPEG.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Mobile image file exceeds 2MB limit.");
      return;
    }

    setIsUploadingMobile(true);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const fileUrl =
        res?.data?.url || res?.url || res?.data?.fileUrl || res?.fileUrl;

      if (!fileUrl) {
        throw new Error("Invalid upload response.");
      }

      setFormData((prev) => ({ ...prev, mobileImageUrl: fileUrl }));
      toast.success("Mobile artwork uploaded!");
    } catch (err) {
      console.error("Mobile upload error:", err);
      toast.error(err?.response?.data?.message || err?.message || "Failed to upload mobile image");
    } finally {
      setIsUploadingMobile(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle?.trim() || null,
        badge: formData.badge?.trim() || null,
        ctaText: formData.ctaText?.trim() || "Shop Now",
        slotKey: formData.slotKey,
        placement: formData.slotKey,
        imageUrl: formData.imageUrl.trim(),
        mobileImageUrl: formData.mobileImageUrl?.trim() || null,
        linkUrl: formData.linkUrl?.trim() || "/shop",
        altText: formData.altText?.trim() || formData.title.trim(),
        campaignId: formData.campaignId?.trim() || null,
        displayOrder: Number(formData.displayOrder) || 0,
        isActive: formData.isActive,
        startsAt: formData.isScheduled ? toIsoOrNull(formData.startsAt) : null,
        endsAt: formData.isScheduled ? toIsoOrNull(formData.endsAt) : null,
      };

      await onSave(payload, isEditing ? banner._id : null);
      onClose();
    } catch (err) {
      console.error("Save banner error:", err);
      const msg =
        err?.response?.data?.message || err?.message || "Failed to save banner.";
      setErrors((prev) => ({ ...prev, form: msg }));
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
              <ImageIcon className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isEditing ? `Edit Banner: "${formData.title || "Untitled"}"` : "Create New Storefront Banner"}
                </h3>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                    formData.isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  )}
                >
                  {formData.isActive ? "Published Live" : "Draft / Hidden"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Targeting placement:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                  {formData.slotKey}
                </span>{" "}
                • {currentSlotDef.recommendedDimensions}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Workflow Step Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-2.5 bg-slate-50/80 dark:bg-slate-900/80">
          {FORM_SECTIONS.map((sec) => {
            const isActive = activeSection === sec.id;
            const Icon = sec.icon;
            const hasError =
              (sec.id === 1 && (errors.title || errors.subtitle || errors.badge || errors.ctaText)) ||
              (sec.id === 2 && errors.imageUrl) ||
              (sec.id === 4 && errors.linkUrl) ||
              (sec.id === 5 && errors.endsAt);

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
                  hasError && !isActive && "text-rose-500 font-bold"
                )}
              >
                <Icon className="size-3.5" />
                <span>{sec.label}</span>
                {hasError && <span className="size-1.5 rounded-full bg-rose-500" />}
              </button>
            );
          })}
        </div>

        {/* Global Error Banner */}
        {errors.form && (
          <div className="mx-6 mt-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Form Body - Sectioned Views */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
          {/* SECTION 1: GENERAL INFORMATION */}
          {activeSection === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>General Information & Copy</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure headline text, marketing badge, promotional description, and call to action.
                </p>
              </div>

              {/* Title & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Banner Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. Next-Gen Gaming Hardware"
                    className={cn(
                      "w-full rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden",
                      errors.title
                        ? "border-rose-500 focus:border-rose-500"
                        : "border-slate-300 dark:border-slate-700 focus:border-emerald-500"
                    )}
                  />
                  {errors.title && (
                    <p className="text-[11px] text-rose-500">{errors.title}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Badge Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, badge: e.target.value }))
                    }
                    placeholder="e.g. 40% OFF, Limited Drop"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-400">High-contrast tag overlay</p>
                </div>
              </div>

              {/* Subtitle / Promo Copy */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Subtitle / Promo Copy (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  placeholder="e.g. Audiophile acoustic architecture with active noise cancellation and 40-hour battery life."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden resize-none"
                />
                <p className="text-[10px] text-slate-400">
                  Supporting promotional text displayed below the headline (max 300 characters).
                </p>
              </div>

              {/* CTA Button Text & Alt Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Call To Action Button Label
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ctaText: e.target.value }))
                    }
                    placeholder="Shop Now, Discover Deals, Explore..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Accessibility Alt Text (SEO)
                  </label>
                  <input
                    type="text"
                    value={formData.altText}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, altText: e.target.value }))
                    }
                    placeholder="Descriptive text for screen readers"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: ARTWORK & MEDIA */}
          {activeSection === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Banner Artwork & Creative Media</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload high-resolution promotional artwork or select from curated catalog presets.
                </p>
              </div>

              {/* Mode Selection Pill */}
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Primary Desktop Artwork <span className="text-rose-500">*</span>
                </label>
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setImageInputMode("upload")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer",
                      imageInputMode === "upload"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode("url")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer",
                      imageInputMode === "url"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Image URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode("preset")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer",
                      imageInputMode === "preset"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    Sample Presets
                  </button>
                </div>
              </div>

              {/* Upload Mode */}
              {imageInputMode === "upload" && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all text-center",
                      errors.imageUrl
                        ? "border-rose-400 bg-rose-50/30 dark:bg-rose-950/20"
                        : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30"
                    )}
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                      <Upload className={cn("size-6", isUploading && "animate-bounce")} />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isUploading ? "Uploading artwork to server..." : "Click or drag artwork image to upload"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      PNG, WebP, JPEG, AVIF up to 2MB. SVG disabled for security.
                    </p>
                    {isUploading && (
                      <div className="w-48 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-3 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {errors.imageUrl && (
                    <p className="text-xs text-rose-500">{errors.imageUrl}</p>
                  )}
                </div>
              )}

              {/* URL Mode */}
              {imageInputMode === "url" && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                    }
                    placeholder="https://... or /images/banners/..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    Supports static paths (e.g. /images/banners/...) or hosted URLs.
                  </p>
                </div>
              )}

              {/* Preset Mode */}
              {imageInputMode === "preset" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  {PRESET_ASSETS.map((asset) => (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          imageUrl: asset.url,
                          altText: prev.altText || asset.alt,
                          slotKey: asset.slotKey,
                        }))
                      }
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer text-xs",
                        formData.imageUrl === asset.url
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <div className="size-8 rounded-lg overflow-hidden bg-slate-950 shrink-0 border border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={asset.name} className="size-full object-cover" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate font-semibold">{asset.name}</p>
                        <p className="text-[10px] text-slate-400 truncate font-mono">{asset.slotKey}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Current Artwork Preview & Replace Control */}
              {formData.imageUrl && (
                <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Selected Primary Artwork
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        Replace Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
                        className="text-xs text-rose-500 font-semibold hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="relative aspect-[16/9] max-h-48 w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center border border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.imageUrl}
                      alt="Current Banner Artwork"
                      className="size-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 rounded-md bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 text-[10px] text-white font-mono">
                      {formData.imageUrl}
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Mobile Banner Artwork */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      Mobile Responsive Artwork (Optional)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Optimized artwork shown on mobile screens (smartphones). Defaults to primary artwork if omitted.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={mobileFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={handleMobileFileUpload}
                    className="hidden"
                  />
                  <input
                    type="text"
                    value={formData.mobileImageUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, mobileImageUrl: e.target.value }))
                    }
                    placeholder="URL or upload mobile artwork..."
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => mobileFileInputRef.current?.click()}
                    disabled={isUploadingMobile}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Upload className="size-3.5" />
                    <span>{isUploadingMobile ? "Uploading..." : "Upload Mobile"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: PLACEMENT & PRIORITY */}
          {activeSection === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Target Placement Slot & Display Priority</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the exact storefront placement slot where this banner will render.
                </p>
              </div>

              {/* Slot Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Storefront Placement Slot <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.slotKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slotKey: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-hidden"
                >
                  <optgroup label="Hero Section Big Banners (Carousel Slides)">
                    <option value="hero_main">
                      Hero Main — Primary Carousel Slide (840 × 430 px)
                    </option>
                  </optgroup>
                  <optgroup label="Hero Section Side Little Cards">
                    <option value="hero_audio">
                      Hero Card 1 — Audio Essentials (384 × 115 px)
                    </option>
                    <option value="hero_smart_home">
                      Hero Card 2 — Smart Devices (384 × 115 px)
                    </option>
                    <option value="hero_brand_deals">
                      Hero Card 3 — Brand Deals (384 × 115 px)
                    </option>
                  </optgroup>
                  <optgroup label="Mid-Page Campaign Banners">
                    <option value="mid_work_smarter">
                      Mid Banner 1 — Work Smarter 67% (840 × 260 px)
                    </option>
                    <option value="mid_stylish_looks">
                      Mid Banner 2 — Stylish Looks 33% (420 × 260 px)
                    </option>
                  </optgroup>
                  <optgroup label="Category Highlight Cards">
                    <option value="category_audio">
                      Category Highlight 1 — Audio Mood (400 × 300 px)
                    </option>
                    <option value="category_workspace">
                      Category Highlight 2 — Workspace Upgrade (400 × 300 px)
                    </option>
                    <option value="category_smart_living">
                      Category Highlight 3 — Smart Living (400 × 300 px)
                    </option>
                  </optgroup>
                  <optgroup label="Bottom Promotional Deals">
                    <option value="bottom_home_kitchen">
                      Bottom Promo 1 — Home & Kitchen (400 × 300 px)
                    </option>
                    <option value="bottom_smart_gadgets">
                      Bottom Promo 2 — Smart Gadgets (400 × 300 px)
                    </option>
                    <option value="bottom_monsoon_special">
                      Bottom Promo 3 — Monsoon Special (400 × 300 px)
                    </option>
                  </optgroup>
                </select>
              </div>

              {/* Slot Details Banner */}
              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      {currentSlotDef.title}
                    </span>
                    <span className="rounded-md bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-mono font-bold">
                      {currentSlotDef.recommendedDimensions}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    {currentSlotDef.sectionLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {currentSlotDef.description}
                </p>
              </div>

              {/* Display Order Priority */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Display Order / Priority Index
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        displayOrder: e.target.value,
                      }))
                    }
                    className="w-32 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Lower numbers render first (e.g. 0 displays before 1). Useful for carousel rotating slides.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: DESTINATION & LINK */}
          {activeSection === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LinkIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Destination Link & Navigation</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Where should customers be taken when they click this banner on the storefront?
                </p>
              </div>

              {/* Link URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Destination Link URL <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={formData.linkUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, linkUrl: e.target.value }))
                    }
                    placeholder="/shop?category=audio or https://..."
                    className={cn(
                      "flex-1 rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-hidden",
                      errors.linkUrl
                        ? "border-rose-500 focus:border-rose-500"
                        : "border-slate-300 dark:border-slate-700 focus:border-emerald-500"
                    )}
                  />
                  {formData.linkUrl && (
                    <Link
                      href={formData.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      <span>Test Link</span>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                </div>
                {errors.linkUrl && (
                  <p className="text-[11px] text-rose-500">{errors.linkUrl}</p>
                )}
              </div>

              {/* Quick Destination Suggestions */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Quick Destination Suggestions:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Marketplace (/shop)", url: "/shop" },
                    { label: "Audio Gear", url: "/shop?category=audio" },
                    { label: "Laptops & Setup", url: "/shop?category=laptops" },
                    { label: "Smart Home", url: "/shop?category=smart-home" },
                    { label: "Campaigns Discovery", url: "/campaigns" },
                  ].map((s) => (
                    <button
                      key={s.url}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, linkUrl: s.url }))
                      }
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-all cursor-pointer font-mono text-[11px]"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Campaign Association */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Associated Marketing Campaign ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.campaignId}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, campaignId: e.target.value }))
                  }
                  placeholder="Optional 24-character Campaign ObjectId"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Store banners and Campaigns remain independent. Providing an ID links telemetry if desired.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 5: SCHEDULE & STATUS */}
          {activeSection === 5 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Publication Status & Schedule Window</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Control immediate storefront visibility or schedule a time-bound promotional window.
                </p>
              </div>

              {/* Master Publication Toggle */}
              <div
                onClick={() =>
                  setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                className={cn(
                  "flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all",
                  formData.isActive
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300"
                    : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {formData.isActive ? "Storefront Status: Published Live" : "Storefront Status: Draft / Hidden"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formData.isActive
                      ? "Eligible for public rendering on the storefront (subject to schedule window)."
                      : "Completely hidden from public storefront views."}
                  </p>
                </div>
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center text-white text-xs font-bold",
                    formData.isActive ? "bg-emerald-600" : "bg-slate-400"
                  )}
                >
                  {formData.isActive ? "✓" : "✕"}
                </div>
              </div>

              {/* Scheduled Window Switch */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Enable Time-Bound Publication Window
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Automatically activate and expire this banner within specific calendar dates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        isScheduled: !prev.isScheduled,
                      }))
                    }
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                      formData.isScheduled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                        formData.isScheduled ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {formData.isScheduled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Start Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.startsAt}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            startsAt: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-hidden"
                      />
                      <p className="text-[10px] text-slate-400">
                        Banner will become active on this date.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        End Date & Time (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.endsAt}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            endsAt: e.target.value,
                          }))
                        }
                        className={cn(
                          "w-full rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-hidden",
                          errors.endsAt
                            ? "border-rose-500"
                            : "border-slate-300 dark:border-slate-700 focus:border-emerald-500"
                        )}
                      />
                      {errors.endsAt ? (
                        <p className="text-[11px] text-rose-500">{errors.endsAt}</p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          Banner will automatically expire after this date.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 6: PREVIEW & PUBLISH */}
          {activeSection === 6 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Eye className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Live Interactive Storefront Preview</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Review simulated storefront rendering and settings before saving.
                  </p>
                </div>

                {/* Device Mode Switch */}
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
                      previewDevice === "desktop"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Monitor className="size-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer",
                      previewDevice === "mobile"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Smartphone className="size-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>

              {/* Simulated Card */}
              <div className="flex justify-center">
                <div
                  className={cn(
                    "w-full transition-all duration-300",
                    previewDevice === "mobile" ? "max-w-sm" : "max-w-3xl"
                  )}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl group">
                    <div
                      className={cn(
                        "relative w-full overflow-hidden bg-slate-950 flex items-center justify-center",
                        formData.slotKey === "hero_main"
                          ? "aspect-[2/1]"
                          : formData.slotKey.startsWith("hero_")
                          ? "aspect-[3.3/1]"
                          : formData.slotKey.startsWith("mid_")
                          ? "aspect-[3/1]"
                          : "aspect-[16/9]"
                      )}
                    >
                      {formData.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            previewDevice === "mobile" && formData.mobileImageUrl
                              ? formData.mobileImageUrl
                              : formData.imageUrl
                          }
                          alt={formData.altText || formData.title}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-102"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                          <ImageIcon className="size-8 mb-2 opacity-50" />
                          <span className="text-xs">No artwork set</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent pointer-events-none" />

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
                        {formData.badge && (
                          <span className="rounded-lg bg-emerald-600/90 text-white px-2.5 py-0.5 text-xs font-bold shadow-xs">
                            {formData.badge}
                          </span>
                        )}
                        <span className="rounded-lg bg-slate-900/80 text-slate-200 px-2 py-0.5 text-[10px] font-mono border border-slate-700">
                          {formData.slotKey}
                        </span>
                      </div>

                      {/* Content Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white space-y-1.5 z-10">
                        <h4 className="text-base sm:text-xl font-black tracking-tight leading-snug drop-shadow-md">
                          {formData.title || "Banner Headline Goes Here"}
                        </h4>
                        {formData.subtitle && (
                          <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 max-w-xl drop-shadow-sm font-medium">
                            {formData.subtitle}
                          </p>
                        )}
                        {formData.ctaText && (
                          <div className="pt-2">
                            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white text-slate-950 px-3.5 py-1.5 text-xs font-bold shadow-md">
                              <span>{formData.ctaText}</span>
                              <ExternalLink className="size-3" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Checklist */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 text-xs space-y-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                  Pre-Publishing Verification Checklist
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Placement:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {formData.slotKey}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formData.isActive ? "Live" : "Draft"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Priority:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Order {formData.displayOrder}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Link:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block font-mono text-[11px]">
                      {formData.linkUrl || "/shop"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            {activeSection > 1 && (
              <button
                type="button"
                onClick={() => setActiveSection((prev) => prev - 1)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Previous Step
              </button>
            )}
            {activeSection < 6 && (
              <button
                type="button"
                onClick={() => setActiveSection((prev) => prev + 1)}
                className="rounded-xl bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Next Step →
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-4 stroke-[2.5]" />
                  <span>{isEditing ? "Update Banner" : "Publish Banner"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoreBannerFormModal;
