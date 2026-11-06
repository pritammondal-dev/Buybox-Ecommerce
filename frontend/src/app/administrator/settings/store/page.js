"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Store,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Package,
  RotateCcw,
  Truck,
  Percent,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  ShieldAlert,
  FileUp,
  ShoppingBag,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader.jsx";
import { adminSettingsService, adminMediaService } from "@/services/admin/admin.service.js";
import { useAuth } from "@/hooks/useAuth.js";
import { invalidateStorefrontSettings } from "@/hooks/useStorefrontSettings.js";
import { LogoSizeManagementModal } from "@/components/admin/settings/LogoSizeManagementModal.jsx";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export default function StoreSettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin =
    user?.role === "super_admin" ||
    user?.role === "SUPERADMIN" ||
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("SUPERADMIN");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Logo Size Management Modal State
  const [showLogoSizeModal, setShowLogoSizeModal] = useState(false);
  const [logoDimensions, setLogoDimensions] = useState({
    desktopWidth: 160,
    desktopMaxHeight: 48,
    mobileWidth: 120,
    mobileMaxHeight: 36,
    footerMaxHeight: 40,
  });

  // Upload States
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState(null);
  const [faviconUploadError, setFaviconUploadError] = useState(null);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [faviconPreviewError, setFaviconPreviewError] = useState(false);

  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  // Form State
  const [form, setForm] = useState({
    storeName: "Buybox Marketplace",
    tagline: "High-Performance Audio, Tech & Peripherals",
    logoUrl: "",
    faviconUrl: "/favicon.ico",
    currencyCode: "INR",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    language: "en",
    maintenanceMode: false,

    // Contact
    email: "support@buybox.test",
    phone: "+91 98765 43210",
    address: "Tech Hub, Sector V, Salt Lake, Kolkata, West Bengal 700091",

    // Feature Flags
    coupons: true,
    flashSale: true,
    vendorRegistration: true,
    vendorApprovalRequired: true,
    productApprovalRequired: true,
    reviews: true,
    wishlist: true,
    compare: true,
    guestCheckout: false,
    customerRegistration: true,
    returns: true,
    giftCards: true,

    // Policies
    returnWindowDays: 7,
    refundWindowDays: 7,
    minOrderValue: 0,
    freeShippingThreshold: 999,
    defaultTaxRate: 18,
    lowStockThreshold: 5,
  });

  const fetchSettings = async () => {
    try {
      const data = await adminSettingsService.get();
      if (data) {
        setForm({
          storeName: data.storeName || "Buybox Marketplace",
          tagline: data.tagline || "High-Performance Audio, Tech & Peripherals",
          logoUrl: data.logoUrl || "",
          faviconUrl: data.faviconUrl || "/favicon.ico",
          currencyCode: data.currency?.code || "INR",
          currencySymbol: data.currency?.symbol || "₹",
          timezone: data.timezone || "Asia/Kolkata",
          language: data.language || "en",
          maintenanceMode: Boolean(data.maintenanceMode),

          email: data.contact?.email || "support@buybox.test",
          phone: data.contact?.phone || "+91 98765 43210",
          address: data.contact?.address || "Tech Hub, Sector V, Salt Lake, Kolkata, West Bengal 700091",

          coupons: data.featureFlags?.coupons !== false,
          flashSale: data.featureFlags?.flashSale !== false,
          vendorRegistration: data.featureFlags?.vendorRegistration !== false,
          vendorApprovalRequired: data.featureFlags?.vendorApprovalRequired !== false,
          productApprovalRequired: data.featureFlags?.productApprovalRequired !== false,
          reviews: data.featureFlags?.reviews !== false,
          wishlist: data.featureFlags?.wishlist !== false,
          compare: data.featureFlags?.compare !== false,
          guestCheckout: Boolean(data.featureFlags?.guestCheckout),
          customerRegistration: data.featureFlags?.customerRegistration !== false,
          returns: data.featureFlags?.returns !== false,
          giftCards: data.featureFlags?.giftCards !== false,

          returnWindowDays: data.policies?.returnWindowDays ?? 7,
          refundWindowDays: data.policies?.refundWindowDays ?? 7,
          minOrderValue: data.policies?.minOrderValue ?? 0,
          freeShippingThreshold: data.policies?.freeShippingThreshold ?? 999,
          defaultTaxRate: data.policies?.defaultTaxRate ?? 18,
          lowStockThreshold: data.policies?.lowStockThreshold ?? 5,
        });

        if (data.logoDimensions) {
          setLogoDimensions({
            desktopWidth: data.logoDimensions.desktopWidth ?? 160,
            desktopMaxHeight: data.logoDimensions.desktopMaxHeight ?? 48,
            mobileWidth: data.logoDimensions.mobileWidth ?? 120,
            mobileMaxHeight: data.logoDimensions.mobileMaxHeight ?? 36,
            footerMaxHeight: data.logoDimensions.footerMaxHeight ?? 40,
          });
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to load store settings.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    setLogoPreviewError(false);
  }, [form.logoUrl]);

  useEffect(() => {
    setFaviconPreviewError(false);
  }, [form.faviconUrl]);

  const handleToggleFlag = (key) => {
    if (!isSuperAdmin) return;
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Logo file upload handler
  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoUploadError(null);

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setLogoUploadError("File size exceeds 2MB limit. Please upload an image smaller than 2MB.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    // Validate format: reject SVG
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type === "image/svg+xml" || ext === "svg") {
      setLogoUploadError("SVG uploads are not permitted for security reasons (XSS risk). Please upload PNG, WebP, JPEG, GIF, or AVIF.");
      if (logoInputRef.current) logoInputRef.current.value = "";
      return;
    }

    setUploadingLogo(true);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const url = res?.data?.url || res?.url;
      if (url) {
        setForm((prev) => ({ ...prev, logoUrl: url }));
        setFeedback({
          type: "success",
          message: "Store logo uploaded successfully. Save settings to persist changes.",
        });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        throw new Error("Invalid response from media upload service.");
      }
    } catch (err) {
      setLogoUploadError(err?.response?.data?.message || err?.message || "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  // Favicon file upload handler
  const handleFaviconFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFaviconUploadError(null);

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setFaviconUploadError("File size exceeds 2MB limit. Please upload a favicon smaller than 2MB.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
      return;
    }

    // Validate format: reject SVG
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (file.type === "image/svg+xml" || ext === "svg") {
      setFaviconUploadError("SVG uploads are not permitted for security reasons (XSS risk). Please upload ICO, PNG, or WebP.");
      if (faviconInputRef.current) faviconInputRef.current.value = "";
      return;
    }

    setUploadingFavicon(true);
    try {
      const res = await adminMediaService.uploadMedia(file);
      const url = res?.data?.url || res?.url;
      if (url) {
        setForm((prev) => ({ ...prev, faviconUrl: url }));
        setFeedback({
          type: "success",
          message: "Favicon uploaded successfully. Save settings to persist changes.",
        });
        setTimeout(() => setFeedback(null), 4000);
      } else {
        throw new Error("Invalid response from media upload service.");
      }
    } catch (err) {
      setFaviconUploadError(err?.response?.data?.message || err?.message || "Failed to upload favicon.");
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) faviconInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: "" }));
    setLogoUploadError(null);
  };

  const handleResetFavicon = () => {
    setForm((prev) => ({ ...prev, faviconUrl: "/favicon.ico" }));
    setFaviconUploadError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = {
      storeName: form.storeName.trim(),
      tagline: form.tagline.trim(),
      logoUrl: form.logoUrl ? form.logoUrl.trim() : null,
      faviconUrl: form.faviconUrl ? form.faviconUrl.trim() : null,
      currency: {
        code: form.currencyCode.trim().toUpperCase(),
        symbol: form.currencySymbol.trim(),
      },
      timezone: form.timezone,
      language: form.language,
      maintenanceMode: form.maintenanceMode,
      contact: {
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      },
      policies: {
        returnWindowDays: Number(form.returnWindowDays),
        refundWindowDays: Number(form.refundWindowDays),
        minOrderValue: Number(form.minOrderValue),
        freeShippingThreshold: Number(form.freeShippingThreshold),
        defaultTaxRate: Number(form.defaultTaxRate),
        lowStockThreshold: Number(form.lowStockThreshold),
      },
      logoDimensions,
    };

    // Feature flags are restricted to Superadmin users
    if (isSuperAdmin) {
      payload.featureFlags = {
        coupons: form.coupons,
        flashSale: form.flashSale,
        vendorRegistration: form.vendorRegistration,
        vendorApprovalRequired: form.vendorApprovalRequired,
        productApprovalRequired: form.productApprovalRequired,
        reviews: form.reviews,
        wishlist: form.wishlist,
        compare: form.compare,
        guestCheckout: form.guestCheckout,
        customerRegistration: form.customerRegistration,
        returns: form.returns,
        giftCards: form.giftCards,
      };
    }

    try {
      await adminSettingsService.update(payload);
      await invalidateStorefrontSettings();
      setFeedback({
        type: "success",
        message: "Platform settings updated successfully. Store branding, identity, and operational thresholds are now active across all portal surfaces.",
      });
      setTimeout(() => setFeedback(null), 5000);
      fetchSettings();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Failed to update platform settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <PageHeader
        title="Authoritative Platform Settings & Branding"
        description="Global single source of truth for marketplace identity, store logo, favicon, real-time feature flags, and operational thresholds."
        backHref="/administrator/settings"
      />

      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500">
          <Loader2 className="size-8 animate-spin mx-auto text-[#007A55] mb-2" />
          <p className="text-xs">Loading authoritative platform settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Brand Assets & Visual Identity (Logo & Favicon) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="size-9 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-bold">
                <ImageIcon className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Brand Assets & Visual Identity</h3>
                <p className="text-xs text-slate-500">
                  Configure store logo and favicon. Changes immediately propagate to storefront headers, footers, and browser tabs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Store Logo Card */}
              <div className="rounded-xl border border-slate-200/90 p-5 bg-slate-50/30 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="store-logo-file" className="block text-xs font-bold text-slate-800">
                      Store Logo
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">Header &amp; Footer Branding</span>
                  </div>

                  {/* Logo Preview Area */}
                  <div className="h-28 w-full rounded-xl border border-dashed border-slate-200 bg-white p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-2xs">
                    {form.logoUrl && !logoPreviewError ? (
                      <div className="flex flex-col items-center justify-center gap-1.5 w-full h-full">
                        <img
                          src={form.logoUrl}
                          alt="Store Logo Preview"
                          className="max-h-14 max-w-full object-contain"
                          onError={() => setLogoPreviewError(true)}
                        />
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                          Custom Logo Active
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-lg bg-[#007A55] text-white">
                            <ShoppingBag className="size-4" />
                          </div>
                          <span className="text-base font-black text-[#007A55]">{form.storeName || "Buybox"}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium pt-1">
                          {logoPreviewError ? "Custom image failed to load — fallback badge active" : "Default Buybox Badge Active"}
                        </span>
                      </div>
                    )}
                  </div>

                  {logoUploadError && (
                    <p className="mt-2 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>{logoUploadError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    ref={logoInputRef}
                    id="store-logo-file"
                    type="file"
                    accept="image/png,image/webp,image/jpeg,image/gif,image/avif"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#007A55] hover:bg-[#006346] text-white text-xs font-semibold px-3 py-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FileUp className="size-3.5" />
                          <span>{form.logoUrl ? "Replace Logo" : "Upload Logo"}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLogoSizeModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Sliders className="size-3.5 text-slate-600" />
                      <span>Logo Size Management</span>
                    </button>

                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5 text-slate-500" />
                        <span>Remove (Use Default)</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label htmlFor="logo-url-input" className="block text-[11px] text-slate-500 mb-1">
                      Or specify logo path / URL:
                    </label>
                    <input
                      id="logo-url-input"
                      type="text"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      placeholder="/uploads/logo.png"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#007A55]"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Max size: 2MB. Formats: PNG, WebP, JPEG, GIF, AVIF. (SVG uploads are disabled for XSS security).
                  </p>
                </div>
              </div>

              {/* Store Favicon Card */}
              <div className="rounded-xl border border-slate-200/90 p-5 bg-slate-50/30 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="store-favicon-file" className="block text-xs font-bold text-slate-800">
                      Store Favicon
                    </label>
                    <span className="text-[10px] font-medium text-slate-500">Browser Tab &amp; Bookmarks</span>
                  </div>

                  {/* Favicon Preview Area with Browser Tab Mockup */}
                  <div className="h-28 w-full rounded-xl border border-dashed border-slate-200 bg-white p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-2xs">
                    <div className="w-full max-w-[220px] rounded-t-lg bg-slate-100 border border-b-0 border-slate-200 px-3 py-1.5 flex items-center gap-2 shadow-2xs">
                      {form.faviconUrl && !faviconPreviewError ? (
                        <img
                          src={form.faviconUrl}
                          alt="Favicon Preview"
                          className="size-4 object-contain"
                          onError={() => setFaviconPreviewError(true)}
                        />
                      ) : (
                        <div className="size-4 rounded-xs bg-[#007A55] text-white flex items-center justify-center text-[9px] font-black">
                          B
                        </div>
                      )}
                      <span className="text-[11px] font-semibold text-slate-700 truncate">
                        {form.storeName || "Buybox"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 pt-2">
                      {form.faviconUrl === "/favicon.ico" ? "Default /favicon.ico Active" : "Custom Favicon Configured"}
                    </span>
                  </div>

                  {faviconUploadError && (
                    <p className="mt-2 text-[11px] text-red-600 font-medium flex items-center gap-1">
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>{faviconUploadError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-1">
                  <input
                    ref={faviconInputRef}
                    id="store-favicon-file"
                    type="file"
                    accept=".ico,image/x-icon,image/vnd.microsoft.icon,image/png,image/webp"
                    className="hidden"
                    onChange={handleFaviconFileChange}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingFavicon}
                      onClick={() => faviconInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#007A55] hover:bg-[#006346] text-white text-xs font-semibold px-3 py-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {uploadingFavicon ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <FileUp className="size-3.5" />
                          <span>{form.faviconUrl && form.faviconUrl !== "/favicon.ico" ? "Replace Favicon" : "Upload Favicon"}</span>
                        </>
                      )}
                    </button>

                    {form.faviconUrl && form.faviconUrl !== "/favicon.ico" && (
                      <button
                        type="button"
                        onClick={handleResetFavicon}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="size-3.5 text-slate-500" />
                        <span>Reset to /favicon.ico</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label htmlFor="favicon-url-input" className="block text-[11px] text-slate-500 mb-1">
                      Or specify favicon path / URL:
                    </label>
                    <input
                      id="favicon-url-input"
                      type="text"
                      value={form.faviconUrl}
                      onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
                      placeholder="/favicon.ico"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-[#007A55]"
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Max size: 2MB. Formats: ICO, PNG, WebP. (SVG uploads are disabled for XSS security).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Marketplace Identity & Localization */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="size-9 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center font-bold">
                <Store className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Marketplace Identity &amp; Localization</h3>
                <p className="text-xs text-slate-500">Authoritative store brand, currency, and operational timezone</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="store-name-input" className="block text-xs font-bold text-slate-700 mb-1">Store Name *</label>
                <input
                  id="store-name-input"
                  type="text"
                  required
                  value={form.storeName}
                  onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="tagline-input" className="block text-xs font-bold text-slate-700 mb-1">Tagline</label>
                <input
                  id="tagline-input"
                  type="text"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="currency-code-input" className="block text-xs font-bold text-slate-700 mb-1">Currency Code (3 letters)</label>
                <input
                  id="currency-code-input"
                  type="text"
                  maxLength={3}
                  value={form.currencyCode}
                  onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase() })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="currency-symbol-input" className="block text-xs font-bold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  id="currency-symbol-input"
                  type="text"
                  maxLength={5}
                  value={form.currencySymbol}
                  onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="timezone-select" className="block text-xs font-bold text-slate-700 mb-1">Timezone</label>
                <select
                  id="timezone-select"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                  <option value="UTC">UTC (+0:00)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                </select>
              </div>

              <div>
                <label htmlFor="language-select" className="block text-xs font-bold text-slate-700 mb-1">Primary Storefront Language</label>
                <select
                  id="language-select"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                >
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="bn">Bengali (bn)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Mail className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Public Marketplace Contact</h3>
                <p className="text-xs text-slate-500">Displayed in storefront footer, order confirmations, and receipts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="support-email-input" className="block text-xs font-bold text-slate-700 mb-1">Support Email</label>
                <input
                  id="support-email-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="support-phone-input" className="block text-xs font-bold text-slate-700 mb-1">Support Phone</label>
                <input
                  id="support-phone-input"
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="operating-address-input" className="block text-xs font-bold text-slate-700 mb-1">Operating Headquarters Address</label>
                <input
                  id="operating-address-input"
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>
            </div>
          </div>

          {/* Centralized Feature Flags */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="size-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Sliders className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Authoritative Feature Flags</h3>
                <p className="text-xs text-slate-500">
                  Enable or disable platform features in real-time. Enforced on both storefront UI and backend API.
                </p>
              </div>
            </div>

            {isSuperAdmin ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 flex items-center gap-3 text-xs text-emerald-900">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Superadmin Full Access:</strong> You have full platform authority to manage, toggle, and configure all global feature flags.
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-center gap-3 text-xs text-amber-800">
                <ShieldAlert className="size-4 shrink-0 text-amber-600" />
                <span>
                  Superadmin has full access to platform settings and feature flag management. Other roles can access only the settings and actions permitted by their assigned permissions.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: "coupons", label: "Coupons & Vouchers", desc: "Allow coupon code application during checkout" },
                { key: "flashSale", label: "Flash Sales & Deals", desc: "Active deal timers and promotional countdowns" },
                { key: "vendorRegistration", label: "Vendor Registration", desc: "Allow new merchants to submit seller applications" },
                { key: "vendorApprovalRequired", label: "Vendor Verification Gate", desc: "Require Superadmin approval before vendor goes live" },
                { key: "productApprovalRequired", label: "Product Approval Gate", desc: "Require admin approval for vendor catalog items" },
                { key: "reviews", label: "Product Reviews", desc: "Enable customer ratings and verified reviews" },
                { key: "wishlist", label: "Customer Wishlist", desc: "Allow shoppers to save favorites to their wishlist" },
                { key: "compare", label: "Product Comparison", desc: "Enable side-by-side spec comparison tool" },
                { key: "guestCheckout", label: "Guest Checkout", desc: "Allow checkout without mandatory customer account (Deferred)" },
                { key: "customerRegistration", label: "Customer Sign-up", desc: "Allow new customer registrations via email/phone" },
                { key: "returns", label: "Returns & RMA", desc: "Allow customers to file return and replacement requests" },
                { key: "giftCards", label: "Gift Cards", desc: "Allow balance redemption via store gift cards" },
              ].map((flag) => {
                const isEnabled = form[flag.key];
                return (
                  <div
                    key={flag.key}
                    onClick={() => handleToggleFlag(flag.key)}
                    className={`p-3.5 rounded-xl border transition-all select-none flex flex-col justify-between ${
                      !isSuperAdmin ? "cursor-not-allowed" : "cursor-pointer"
                    } ${
                      isEnabled
                        ? "bg-emerald-50/40 border-emerald-200 hover:border-emerald-300"
                        : "bg-slate-50 border-slate-200 opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900">{flag.label}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isEnabled
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isEnabled ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{flag.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operational Policies & Thresholds */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="size-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Policies &amp; Marketplace Thresholds</h3>
                <p className="text-xs text-slate-500">Business rules for returns, free shipping, and stock level warnings</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="return-window-input" className="block text-xs font-bold text-slate-700 mb-1">Return Window (Days)</label>
                <input
                  id="return-window-input"
                  type="number"
                  min={0}
                  value={form.returnWindowDays}
                  onChange={(e) => setForm({ ...form, returnWindowDays: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="refund-window-input" className="block text-xs font-bold text-slate-700 mb-1">Refund Window (Days)</label>
                <input
                  id="refund-window-input"
                  type="number"
                  min={0}
                  value={form.refundWindowDays}
                  onChange={(e) => setForm({ ...form, refundWindowDays: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="free-shipping-input" className="block text-xs font-bold text-slate-700 mb-1">Free Shipping Threshold (₹)</label>
                <input
                  id="free-shipping-input"
                  type="number"
                  min={0}
                  value={form.freeShippingThreshold}
                  onChange={(e) => setForm({ ...form, freeShippingThreshold: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="default-tax-rate-input" className="block text-xs font-bold text-slate-700 mb-1">Default Tax Rate (%)</label>
                <input
                  id="default-tax-rate-input"
                  type="number"
                  min={0}
                  max={100}
                  value={form.defaultTaxRate}
                  onChange={(e) => setForm({ ...form, defaultTaxRate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="low-stock-alert-input" className="block text-xs font-bold text-slate-700 mb-1">Low Stock Alert Level (Units)</label>
                <input
                  id="low-stock-alert-input"
                  type="number"
                  min={0}
                  value={form.lowStockThreshold}
                  onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-[#007A55]"
                />
              </div>

              <div>
                <label htmlFor="maintenance-mode-select" className="block text-xs font-bold text-slate-700 mb-1">Maintenance Mode</label>
                <select
                  id="maintenance-mode-select"
                  value={form.maintenanceMode ? "true" : "false"}
                  onChange={(e) => setForm({ ...form, maintenanceMode: e.target.value === "true" })}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-bold focus:outline-none ${
                    form.maintenanceMode
                      ? "bg-red-50 text-red-800 border-red-300"
                      : "bg-slate-50/50 text-slate-900 border-slate-200"
                  }`}
                >
                  <option value="false">Live (Storefront Operational)</option>
                  <option value="true">Maintenance Mode (Storefront Suspended)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs px-6 py-2.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span>Save Authoritative Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Logo Size Management Modal */}
      <LogoSizeManagementModal
        isOpen={showLogoSizeModal}
        onClose={() => setShowLogoSizeModal(false)}
        logoUrl={form.logoUrl}
        storeName={form.storeName}
        currentDimensions={logoDimensions}
        onSave={async (newDims) => {
          try {
            await adminSettingsService.update({ logoDimensions: newDims });
            setLogoDimensions(newDims);
            await invalidateStorefrontSettings();
            setFeedback({
              type: "success",
              message: "Logo sizing updated successfully and broadcast to all storefront views.",
            });
            setTimeout(() => setFeedback(null), 4000);
          } catch (err) {
            setFeedback({
              type: "error",
              message: err?.response?.data?.message || err?.message || "Failed to update logo sizing.",
            });
            throw err;
          }
        }}
      />
    </div>
  );
}
