"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Link as LinkIcon,
  Layers,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ExternalLink,
  Eye,
  RefreshCw,
  Plus,
  Trash2,
  Tag,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminMediaService,
  couponService,
  discountService,
  adminCatalogService,
} from "@/services/admin/admin.service.js";

const CAMPAIGN_TYPES = [
  { value: "seasonal", label: "Seasonal Sale (e.g. Diwali, Summer, Monsoon)" },
  { value: "flash_sale", label: "Flash Sale / Limited Hour Drop" },
  { value: "holiday", label: "Holiday & Festival Event" },
  { value: "clearance", label: "Clearance & Warehouse Liquidation" },
  { value: "brand_special", label: "Brand Showcase / Exclusive Drop" },
  { value: "general", label: "General Promotional Event" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST - UTC+5:30)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "America/New_York", label: "Eastern Time (EST/EDT - UTC-5/UTC-4)" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT/BST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST - UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore Standard Time (SGT - UTC+8)" },
];

const SCOPES = [
  { value: "all", label: "Entire Platform (All Store Products)" },
  { value: "categories", label: "Specific Categories" },
  { value: "products", label: "Specific Products" },
  { value: "vendors", label: "Specific Vendors" },
];

const safeId = (item) => {
  if (!item) return "";
  if (typeof item === "object") {
    return String(item._id || item.id || "");
  }
  return String(item);
};

export function CampaignFormModal({
  isOpen,
  onClose,
  campaign = null,
  onSave,
}) {
  const isEditing = Boolean(campaign?._id || campaign?.id);

  // Active form section (1 to 7)
  const [activeSection, setActiveSection] = useState(1);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    type: "general",
    description: "",
    startsAt: "",
    endsAt: "",
    timezone: "Asia/Kolkata",
    status: "draft",
    bannerUrl: "",
    mobileBannerUrl: "",
    destinationUrl: "",
    scope: "all",
    productIds: [],
    categoryIds: [],
    vendorIds: [],
    couponIds: [],
    discountIds: [],
  });

  const [initialData, setInitialData] = useState(null);
  const [errors, setErrors] = useState({});
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Catalog / Promotion lookups
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Initialize form state
  useEffect(() => {
    if (!isOpen) return;

    if (campaign) {
      const init = {
        name: campaign.name || "",
        slug: campaign.slug || "",
        type: campaign.type || "general",
        description: campaign.description || "",
        startsAt: campaign.startsAt
          ? new Date(campaign.startsAt).toISOString().slice(0, 16)
          : "",
        endsAt: campaign.endsAt
          ? new Date(campaign.endsAt).toISOString().slice(0, 16)
          : "",
        timezone: campaign.timezone || "Asia/Kolkata",
        status: campaign.status || "draft",
        bannerUrl: campaign.bannerUrl || "",
        mobileBannerUrl: campaign.mobileBannerUrl || "",
        destinationUrl: campaign.destinationUrl || "",
        scope: campaign.scope || "all",
        productIds: Array.isArray(campaign.productIds)
          ? campaign.productIds.map(safeId).filter(Boolean)
          : [],
        categoryIds: Array.isArray(campaign.categoryIds)
          ? campaign.categoryIds.map(safeId).filter(Boolean)
          : [],
        vendorIds: Array.isArray(campaign.vendorIds)
          ? campaign.vendorIds.map(safeId).filter(Boolean)
          : [],
        couponIds: Array.isArray(campaign.couponIds)
          ? campaign.couponIds.map(safeId).filter(Boolean)
          : [],
        discountIds: Array.isArray(campaign.discountIds)
          ? campaign.discountIds.map(safeId).filter(Boolean)
          : [],
      };
      setFormData(init);
      setInitialData(init);
    } else {
      const now = new Date();
      const nextWeek = new Date(Date.now() + 7 * 86400000);
      const init = {
        name: "",
        slug: "",
        type: "general",
        description: "",
        startsAt: now.toISOString().slice(0, 16),
        endsAt: nextWeek.toISOString().slice(0, 16),
        timezone: "Asia/Kolkata",
        status: "draft",
        bannerUrl: "",
        mobileBannerUrl: "",
        destinationUrl: "",
        scope: "all",
        productIds: [],
        categoryIds: [],
        vendorIds: [],
        couponIds: [],
        discountIds: [],
      };
      setFormData(init);
      setInitialData(init);
    }

    setActiveSection(1);
    setErrors({});
    setShowDiscardConfirm(false);
  }, [isOpen, campaign]);

  // Load auxiliary catalog resources when opened
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchResources = async () => {
      setCatalogLoading(true);
      try {
        const [catsRes, prodsRes, coupsRes, discsRes] = await Promise.allSettled([
          adminCatalogService.listCategories(),
          adminCatalogService.listProducts({ limit: 50 }),
          couponService.list(),
          discountService.list(),
        ]);

        if (mounted) {
          if (catsRes.status === "fulfilled") {
            const list = Array.isArray(catsRes.value) ? catsRes.value : catsRes.value?.categories || [];
            setCategories(list);
          }
          if (prodsRes.status === "fulfilled") {
            const list = Array.isArray(prodsRes.value) ? prodsRes.value : prodsRes.value?.products || [];
            setProducts(list);
          }
          if (coupsRes.status === "fulfilled") {
            const list = Array.isArray(coupsRes.value) ? coupsRes.value : coupsRes.value?.coupons || [];
            setCoupons(list);
          }
          if (discsRes.status === "fulfilled") {
            const list = Array.isArray(discsRes.value) ? discsRes.value : discsRes.value?.discounts || [];
            setDiscounts(list);
          }
        }
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };

    fetchResources();
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Is form dirty?
  const isDirty = useMemo(() => {
    if (!initialData) return false;
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  // Name change handler with auto-slug generation
  const handleNameChange = (val) => {
    const slug = isEditing
      ? formData.slug
      : val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

    setFormData((prev) => ({
      ...prev,
      name: val,
      slug,
      destinationUrl: isEditing || prev.destinationUrl ? prev.destinationUrl : `/campaign/${slug}`,
    }));

    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: null }));
    }
  };

  // Banner image upload via adminMediaService
  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Creative asset must be under 5MB");
      return;
    }

    setUploadingBanner(true);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const url = res?.data?.url || res?.url;
      if (url) {
        setFormData((prev) => ({ ...prev, bannerUrl: url }));
        toast.success("Banner asset uploaded successfully");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to upload banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  // Section Validation
  const validateForm = (targetStatus) => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Campaign name is required (max 150 characters).";
    }
    if (!formData.slug.trim()) {
      newErrors.slug = "A URL slug is required.";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug.trim())) {
      newErrors.slug = "Slug must contain only lowercase alphanumeric characters and hyphens.";
    }

    if (!formData.startsAt) {
      newErrors.startsAt = "Start date and time are required.";
    }
    if (!formData.endsAt) {
      newErrors.endsAt = "End date and time are required.";
    } else if (new Date(formData.endsAt) <= new Date(formData.startsAt)) {
      newErrors.endsAt = "End date must be strictly after the start date.";
    }

    // Schedule validation
    if (targetStatus === "scheduled") {
      if (new Date(formData.startsAt) <= new Date()) {
        newErrors.startsAt = "To schedule, start date must be set in the future.";
      }
    }

    // Scope targeting validation
    if (formData.scope === "products" && (!formData.productIds || formData.productIds.length === 0)) {
      newErrors.productIds = "Product scope requires at least one product.";
    }
    if (formData.scope === "categories" && (!formData.categoryIds || formData.categoryIds.length === 0)) {
      newErrors.categoryIds = "Category scope requires at least one category.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submission handler with status semantics
  const handleSave = async (targetStatus) => {
    if (!validateForm(targetStatus)) {
      toast.error("Please resolve highlighted validation errors before saving.");
      return;
    }

    setSaving(true);
    try {
      const targetIsActive = (targetStatus || formData.status) === "active";
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        type: formData.type,
        description: formData.description.trim() || undefined,
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        timezone: formData.timezone,
        status: targetStatus || formData.status,
        isActive: targetIsActive,
        bannerUrl: formData.bannerUrl.trim() || undefined,
        mobileBannerUrl: formData.mobileBannerUrl.trim() || undefined,
        destinationUrl: formData.destinationUrl.trim() || `/campaign/${formData.slug.trim().toLowerCase()}`,
        scope: formData.scope,
        productIds: formData.productIds,
        categoryIds: formData.categoryIds,
        vendorIds: formData.vendorIds,
        couponIds: formData.couponIds,
        discountIds: formData.discountIds,
      };

      await onSave(payload, campaign?._id || campaign?.id);
      setInitialData(formData);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#004D38]/10 text-[#004D38] flex items-center justify-center font-bold">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isEditing ? `Edit Campaign: ${campaign.name}` : "Create Marketing Campaign & Sales Event"}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Storefront route: {formData.destinationUrl || `/campaign/${formData.slug || "your-slug"}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 7 Section Step Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto px-6 py-2.5 bg-slate-50/40 border-b border-slate-100 text-xs shrink-0 font-medium">
          {[
            { id: 1, label: "1. Info & Type", icon: Tag },
            { id: 2, label: "2. Schedule & Time", icon: Calendar },
            { id: 3, label: "3. Creative Banner", icon: ImageIcon },
            { id: 4, label: "4. Destination URL", icon: LinkIcon },
            { id: 5, label: "5. Audience & Scope", icon: Layers },
            { id: 6, label: "6. Discounts & Deals", icon: Percent },
            { id: 7, label: "7. Review & Confirm", icon: CheckCircle2 },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#004D38] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* SECTION 1: General Info & Type */}
          {activeSection === 1 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">General Information &amp; Campaign Type</h3>
                <p className="text-slate-500 text-[11px]">Define the campaign title, public identifier, and marketing category.</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Great Indian Festive Sale 2026"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] ${
                    errors.name ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                  }`}
                />
                {errors.name && <p className="text-rose-600 text-[11px] font-semibold">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">URL Slug *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. festive-sale-2026"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""),
                      })
                    }
                    className={`w-full px-3.5 py-2.5 border rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#004D38] ${
                      errors.slug ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {errors.slug && <p className="text-rose-600 text-[11px] font-semibold">{errors.slug}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">Campaign Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  >
                    {CAMPAIGN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Description / Promotional Terms</label>
                <textarea
                  rows="3"
                  placeholder="Promotional copy, headline offers, terms & conditions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                />
              </div>
            </div>
          )}

          {/* SECTION 2: Schedule & Timezone */}
          {activeSection === 2 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Schedule &amp; Timezone Controls</h3>
                <p className="text-slate-500 text-[11px]">Specify start and end dates. Start date must be before end date.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">Start Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] ${
                      errors.startsAt ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {errors.startsAt && <p className="text-rose-600 text-[11px] font-semibold">{errors.startsAt}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">End Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] ${
                      errors.endsAt ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                    }`}
                  />
                  {errors.endsAt && <p className="text-rose-600 text-[11px] font-semibold">{errors.endsAt}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">Event Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800">Current Status</label>
                  <div className="px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>{formData.status}</span>
                    <span className="text-[10px] lowercase text-slate-400 font-normal">Controlled via publish actions</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: Creative Banner */}
          {activeSection === 3 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Creative Banner &amp; Marketing Media</h3>
                <p className="text-slate-500 text-[11px]">Upload promotional imagery displayed in hero banners and storefront listings.</p>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-800">Upload Campaign Banner (5MB Max, PNG/JPEG/WEBP)</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 cursor-pointer transition-colors">
                    <Upload className="size-4" />
                    <span>{uploadingBanner ? "Uploading..." : "Choose Image File"}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner}
                      className="hidden"
                    />
                  </label>
                  <span className="text-slate-400 text-[11px]">or specify URL directly</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Desktop Banner Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/banners/diwali-hero.jpg or /uploads/media_..."
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Mobile Banner Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="/uploads/media_mobile_banner.jpg"
                  value={formData.mobileBannerUrl}
                  onChange={(e) => setFormData({ ...formData, mobileBannerUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#004D38] font-mono text-[11px]"
                />
              </div>

              {formData.bannerUrl && (
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-700">Creative Asset Live Preview:</p>
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48">
                    <img
                      src={formData.bannerUrl}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: Destination & Landing Page */}
          {activeSection === 4 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Landing Page &amp; Destination Navigation</h3>
                <p className="text-slate-500 text-[11px]">Define where storefront clicks and marketing links resolve.</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Primary Destination URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.destinationUrl || `/campaign/${formData.slug || "your-slug"}`}
                    onChange={(e) => setFormData({ ...formData, destinationUrl: e.target.value })}
                    className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                  />
                  <a
                    href={formData.destinationUrl || `/campaign/${formData.slug}?preview=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                  >
                    <ExternalLink className="size-4" />
                    <span>Test Link</span>
                  </a>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Default route is `/campaign/{formData.slug || "slug"}` with dynamic countdown, event coupons, and curated deals.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 5: Audience & Scope Targeting */}
          {activeSection === 5 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Audience &amp; Product Scope Targeting</h3>
                <p className="text-slate-500 text-[11px]">Configure whether the campaign applies store-wide or to selected categories/products.</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">Targeting Scope</label>
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#004D38]"
                >
                  {SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Specific Categories Picker */}
              {formData.scope === "categories" && (
                <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800">Select Applicable Categories ({categories.length} available)</label>
                  {errors.categoryIds && <p className="text-rose-600 text-[11px] font-semibold">{errors.categoryIds}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pt-1">
                    {categories.map((cat) => {
                      const id = safeId(cat);
                      const isSelected = formData.categoryIds.some((cid) => safeId(cid) === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              categoryIds: isSelected
                                ? prev.categoryIds.filter((cid) => safeId(cid) !== id)
                                : [...prev.categoryIds, id],
                            }));
                          }}
                          className={`p-2 rounded-xl text-left border transition-colors cursor-pointer text-[11px] ${
                            isSelected
                              ? "bg-[#004D38]/10 border-[#004D38] text-[#004D38] font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Specific Products Picker */}
              {formData.scope === "products" && (
                <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800">Select Included Products ({formData.productIds.length} selected)</label>
                  {errors.productIds && <p className="text-rose-600 text-[11px] font-semibold">{errors.productIds}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pt-1">
                    {products.map((prod) => {
                      const id = safeId(prod);
                      const isSelected = formData.productIds.some((pid) => safeId(pid) === id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              productIds: isSelected
                                ? prev.productIds.filter((pid) => safeId(pid) !== id)
                                : [...prev.productIds, id],
                            }));
                          }}
                          className={`p-2.5 rounded-xl text-left border flex items-center justify-between transition-colors cursor-pointer text-[11px] ${
                            isSelected
                              ? "bg-[#004D38]/10 border-[#004D38] text-[#004D38] font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className="truncate pr-2">{prod.name}</span>
                          <span className="font-mono text-slate-500 shrink-0">₹{prod.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 6: Discounts & Coupons */}
          {activeSection === 6 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Discounts &amp; Exclusive Coupons Association</h3>
                <p className="text-slate-500 text-[11px]">
                  Integrate with the authoritative Pricing Engine by binding promotional event coupons and product discounts.
                </p>
              </div>

              {/* Coupons Association */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800">Event Exclusive Coupons ({coupons.length} available)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {coupons.map((c) => {
                    const id = safeId(c);
                    const isSelected = formData.couponIds.some((cid) => safeId(cid) === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            couponIds: isSelected
                              ? prev.couponIds.filter((cid) => safeId(cid) !== id)
                              : [...prev.couponIds, id],
                          }));
                        }}
                        className={`p-2.5 rounded-xl text-left border flex items-center justify-between transition-colors cursor-pointer text-[11px] ${
                          isSelected
                            ? "bg-amber-50 border-amber-400 text-amber-900 font-bold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-mono">{c.code}</span>
                        <span className="text-slate-500">{c.discountType === "percentage" ? `${c.discountAmount}% off` : `₹${c.discountAmount} off`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discounts Association */}
              <div className="space-y-2 pt-2">
                <label className="font-bold text-slate-800">Associated Product Discounts ({discounts.length} available)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {discounts.map((d) => {
                    const id = safeId(d);
                    const isSelected = formData.discountIds.some((did) => safeId(did) === id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            discountIds: isSelected
                              ? prev.discountIds.filter((did) => safeId(did) !== id)
                              : [...prev.discountIds, id],
                          }));
                        }}
                        className={`p-2.5 rounded-xl text-left border flex items-center justify-between transition-colors cursor-pointer text-[11px] ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-400 text-emerald-900 font-bold"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate pr-2">{d.name}</span>
                        <span className="text-slate-500 shrink-0 capitalize">{d.discountType}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: Review & Confirm */}
          {activeSection === 7 && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="border-b pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Review &amp; Final Confirmation</h3>
                <p className="text-slate-500 text-[11px]">Verify campaign specifications before committing or publishing.</p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-900 text-sm">{formData.name || "Untitled Campaign"}</span>
                  <span className="font-mono text-slate-500 text-xs">/{formData.slug}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Type:</span>
                    <span className="font-bold capitalize text-slate-700">{formData.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Target Scope:</span>
                    <span className="font-bold capitalize text-slate-700">{formData.scope}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Timezone:</span>
                    <span className="font-bold text-slate-700">{formData.timezone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Starts:</span>
                    <span className="font-bold text-slate-700">{formData.startsAt || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Ends:</span>
                    <span className="font-bold text-slate-700">{formData.endsAt || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Items:</span>
                    <span className="font-bold text-slate-700">
                      {formData.couponIds.length} Coupons • {formData.discountIds.length} Discounts
                    </span>
                  </div>
                </div>

                {formData.bannerUrl && (
                  <div className="pt-2">
                    <span className="text-slate-400 block text-[11px] mb-1">Banner Asset:</span>
                    <img
                      src={formData.bannerUrl}
                      alt="Banner"
                      className="rounded-xl h-24 w-full object-cover border border-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Explicit Action Semantics */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {formData.slug && (
              <a
                href={`/campaign/${formData.slug}?preview=true`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-[#004D38] font-bold rounded-xl hover:bg-slate-200/50 transition-colors"
              >
                <Eye className="size-3.5" />
                <span>Preview</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeSection > 1 && (
              <button
                type="button"
                onClick={() => setActiveSection((p) => p - 1)}
                className="px-3.5 py-2 font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Previous
              </button>
            )}

            {activeSection < 7 ? (
              <button
                type="button"
                onClick={() => setActiveSection((p) => p + 1)}
                className="px-4 py-2 font-bold text-white bg-[#004D38] hover:bg-[#003828] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Next Section
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("draft")}
                  className="px-3.5 py-2 font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("scheduled")}
                  className="px-3.5 py-2 font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Schedule
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave("active")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  <span>Publish Immediately</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Unsaved Changes Confirmation Modal */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-2xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-amber-600 font-bold">
                <AlertTriangle className="size-5" />
                <span>Discard Unsaved Changes?</span>
              </div>
              <p className="text-slate-600">
                You have unsaved changes in this campaign form. Discarding will lose all recent inputs.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-100"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
                >
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CampaignFormModal;
