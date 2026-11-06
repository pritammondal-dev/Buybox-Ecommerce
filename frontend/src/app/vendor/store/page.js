"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Store,
  Building2,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Lock,
  Send,
  Clock,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  Globe,
  FileText,
  Truck,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";
import {
  VendorPageHeader,
  VendorBreadcrumbs,
  VendorStatusBadge,
} from "@/components/vendor";
import {
  validateGSTIN,
  validatePAN,
  normalizeGSTIN,
  normalizePAN,
} from "@/utils/compliance-validation.util";

export default function VendorStoreSettingsPage() {
  const [vendor, setVendor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [form, setForm] = useState({
    businessName: "",
    businessSlug: "",
    phone: "",
    supportEmail: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    gstin: "",
    pan: "",
    // Branding
    displayName: "",
    logo: "",
    banner: "",
    description: "",
    publicContactEmail: "",
    publicContactPhone: "",
    operatingHours: "",
    shippingPolicy: "",
    returnPolicy: "",
    refundPolicy: "",
    website: "",
    instagram: "",
    facebook: "",
    twitter: "",
  });

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const res = await vendorService.getMyProfile();
      const v = res?.data?.data?.vendor || res?.data?.vendor || res?.data;
      setVendor(v);

      const addr = v?.businessAddress || {};
      const tax = v?.taxInformation || {};
      const branding = v?.branding || {};
      const policies = branding.policies || {};
      const social = branding.socialLinks || {};

      setForm({
        businessName: v?.businessName || "",
        businessSlug: v?.businessSlug || "",
        phone: v?.phone || "",
        supportEmail: v?.supportEmail || "",
        addressLine1: addr.addressLine1 || "",
        city: addr.city || "",
        state: addr.state || "",
        postalCode: addr.postalCode || "",
        country: addr.country || "India",
        gstin: tax.gstin || "",
        pan: tax.pan || "",
        displayName: branding.displayName || v?.businessName || "",
        logo: branding.logo || "",
        banner: branding.banner || "",
        description: branding.description || "",
        publicContactEmail: branding.publicContactEmail || v?.supportEmail || "",
        publicContactPhone: branding.publicContactPhone || v?.phone || "",
        operatingHours: branding.operatingHours || "",
        shippingPolicy: policies.shippingPolicy || "",
        returnPolicy: policies.returnPolicy || "",
        refundPolicy: policies.refundPolicy || "",
        website: social.website || "",
        instagram: social.instagram || "",
        facebook: social.facebook || "",
        twitter: social.twitter || "",
      });
    } catch (err) {
      toast.error("Failed to load vendor store profile", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      await vendorService.resubmitApplication();
      toast.success("Application resubmitted successfully! It is now pending operations review.");
      await loadProfile();
    } catch (err) {
      toast.error("Failed to resubmit application", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleAssetUpload = async (file, assetType) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size exceeds 2MB limit");
      return;
    }

    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
      toast.error("SVG uploads are not permitted for security reasons");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetType", assetType);

    if (assetType === "logo") setUploadingLogo(true);
    if (assetType === "banner") setUploadingBanner(true);

    try {
      const res = await vendorService.uploadBrandingAsset(formData);
      const uploadedUrl = res?.data?.data?.url || res?.data?.url;
      if (assetType === "logo") {
        setForm((prev) => ({ ...prev, logo: uploadedUrl }));
        toast.success("Store logo uploaded successfully!");
      } else {
        setForm((prev) => ({ ...prev, banner: uploadedUrl }));
        toast.success("Store banner uploaded successfully!");
      }
    } catch (err) {
      toast.error(`Failed to upload store ${assetType}`, {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      if (assetType === "logo") setUploadingLogo(false);
      if (assetType === "banner") setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.gstin && form.gstin.trim()) {
      const gstinCheck = validateGSTIN(form.gstin);
      if (!gstinCheck.isValid) {
        toast.error("Invalid GSTIN", { description: gstinCheck.error });
        return;
      }
    }

    if (form.pan && form.pan.trim()) {
      const panCheck = validatePAN(form.pan);
      if (!panCheck.isValid) {
        toast.error("Invalid PAN", { description: panCheck.error });
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update basic profile & tax
      await vendorService.updateMyProfile({
        businessName: form.businessName.trim(),
        phone: form.phone.trim(),
        supportEmail: form.supportEmail.trim(),
        businessAddress: {
          addressLine1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          country: form.country.trim(),
        },
        taxInformation: {
          gstin: form.gstin.trim(),
          pan: form.pan.trim(),
        },
      });

      // 2. Update store branding & policies
      await vendorService.updateMyBranding({
        displayName: form.displayName.trim() || form.businessName.trim(),
        logo: form.logo ? form.logo.trim() : null,
        banner: form.banner ? form.banner.trim() : null,
        description: form.description ? form.description.trim() : null,
        publicContactEmail: form.publicContactEmail ? form.publicContactEmail.trim() : null,
        publicContactPhone: form.publicContactPhone ? form.publicContactPhone.trim() : null,
        operatingHours: form.operatingHours ? form.operatingHours.trim() : null,
        policies: {
          shippingPolicy: form.shippingPolicy ? form.shippingPolicy.trim() : null,
          returnPolicy: form.returnPolicy ? form.returnPolicy.trim() : null,
          refundPolicy: form.refundPolicy ? form.refundPolicy.trim() : null,
        },
        socialLinks: {
          website: form.website ? form.website.trim() : null,
          instagram: form.instagram ? form.instagram.trim() : null,
          facebook: form.facebook ? form.facebook.trim() : null,
          twitter: form.twitter ? form.twitter.trim() : null,
        },
      });

      toast.success("Store branding and settings updated successfully!");
      await loadProfile();
    } catch (err) {
      toast.error("Failed to update store settings", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/vendor/dashboard" },
    { label: "Settings", href: "/vendor/store" },
    { label: "Store Settings & Branding" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-8 w-44 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <VendorBreadcrumbs items={breadcrumbs} />

      <VendorPageHeader
        title="Store Settings & Brand Identity"
        description="Manage your customer-facing merchant profile, storefront logo, banner, policies, operating hours, and tax credentials."
        actions={
          <div className="flex items-center gap-2">
            {form.businessSlug && (
              <Link
                href={`/stores/${form.businessSlug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
              >
                <ExternalLink className="size-3.5 text-[#004D38]" />
                <span>Preview Storefront</span>
              </Link>
            )}
            <Link
              href="/vendor/compliance"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#004D38] hover:bg-emerald-100 text-xs font-bold shadow-xs transition-colors"
            >
              <ShieldCheck className="size-3.5" />
              <span>KYC & Compliance</span>
            </Link>
          </div>
        }
      />

      {/* Onboarding Lifecycle Banners */}
      {vendor?.onboardingStatus === "changes_requested" && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Action Required: Changes Requested</h4>
              <p className="text-xs text-amber-800 mt-1 font-medium">
                Marketplace Operations notes: &ldquo;{vendor.changesRequestedReason}&rdquo;
              </p>
              <p className="text-[11px] text-amber-600 mt-0.5">
                Please review or update your store information below, then click Resubmit Application.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResubmit}
            disabled={isResubmitting || isSaving}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            <span>{isResubmitting ? "Resubmitting..." : "Resubmit Application"}</span>
          </button>
        </div>
      )}

      {vendor?.onboardingStatus === "pending" && (
        <div className="p-4 rounded-3xl bg-blue-50 border border-blue-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0">
            <Clock className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900">Application Pending Review</h4>
            <p className="text-xs text-blue-700 mt-0.5">
              Your merchant application is currently being evaluated by Buybox Marketplace Operations.
            </p>
          </div>
        </div>
      )}

      {/* KYC Compliance Status Callout */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 text-[#004D38]">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Legal Compliance & KYC</h4>
            <p className="text-[11px] text-slate-500">
              Submit PAN, GST Certificate, and Address proof to attain official Verified Merchant status.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <VendorStatusBadge status={vendor?.kycStatus || "not_submitted"} size="sm" />
          <Link
            href="/vendor/compliance"
            className="text-xs font-bold text-[#004D38] hover:underline"
          >
            Manage KYC &rarr;
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: STOREFRONT BRANDING & ASSETS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Store className="size-4 text-[#004D38]" />
              <span>1. Storefront Brand Identity &amp; Visuals</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize how your store appears to customers on the Buybox marketplace.
            </p>
          </div>

          {/* Logo & Banner Upload Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Store Logo */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Store Logo (Square, 1:1)
              </label>
              <div className="flex items-center gap-4">
                <div className="size-20 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative shrink-0">
                  {form.logo ? (
                    <img
                      src={form.logo}
                      alt="Store Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="size-8 text-slate-300" />
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors">
                    <Upload className="size-3.5 text-slate-500" />
                    <span>{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={(e) => handleAssetUpload(e.target.files?.[0], "logo")}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                  </label>
                  <p className="text-[10px] text-slate-400">
                    PNG, JPEG, or WebP. Max 2MB. Recommended 400x400px.
                  </p>
                </div>
              </div>
            </div>

            {/* Store Banner */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Storefront Banner (Landscape, 16:5)
              </label>
              <div className="h-20 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative">
                {form.banner ? (
                  <img
                    src={form.banner}
                    alt="Store Banner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                    <ImageIcon className="size-5" />
                    <span>No banner uploaded</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors">
                  <Upload className="size-3.5 text-slate-500" />
                  <span>{uploadingBanner ? "Uploading..." : "Upload Banner"}</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleAssetUpload(e.target.files?.[0], "banner")}
                    className="hidden"
                    disabled={uploadingBanner}
                  />
                </label>
                <p className="text-[10px] text-slate-400">
                  Max 2MB. Recommended 1200x380px.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Display Name
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="e.g. Acme Tech Store"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Friendly storefront name displayed on product badges and store header.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Operating Hours
              </label>
              <input
                type="text"
                value={form.operatingHours}
                onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
                placeholder="e.g. Mon - Sat: 9:00 AM - 7:00 PM IST"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Bio / Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tell customers about your business, quality standards, and product specialization..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Customer Contact Email
              </label>
              <input
                type="email"
                value={form.publicContactEmail}
                onChange={(e) => setForm({ ...form, publicContactEmail: e.target.value })}
                placeholder="contact@store.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Customer Contact Phone
              </label>
              <input
                type="text"
                value={form.publicContactPhone}
                onChange={(e) => setForm({ ...form, publicContactPhone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: STOREFRONT POLICIES */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="size-4 text-[#004D38]" />
              <span>2. Storefront Operational Policies</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Clear policies improve buyer trust and minimize fulfillment disputes.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Truck className="size-3.5 text-[#004D38]" />
                <span>Shipping Policy</span>
              </label>
              <textarea
                rows={2}
                value={form.shippingPolicy}
                onChange={(e) => setForm({ ...form, shippingPolicy: e.target.value })}
                placeholder="e.g. Orders dispatched within 24 hours. Express courier delivery available across India."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <RotateCcw className="size-3.5 text-[#004D38]" />
                <span>Return Policy</span>
              </label>
              <textarea
                rows={2}
                value={form.returnPolicy}
                onChange={(e) => setForm({ ...form, returnPolicy: e.target.value })}
                placeholder="e.g. 7-day hassle-free replacement for defective or damaged items."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-[#004D38]" />
                <span>Refund Policy</span>
              </label>
              <textarea
                rows={2}
                value={form.refundPolicy}
                onChange={(e) => setForm({ ...form, refundPolicy: e.target.value })}
                placeholder="e.g. Refunds processed within 5-7 business days back to the original payment source."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: LEGAL ENTITY & TAX INFORMATION */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="size-4 text-[#004D38]" />
              <span>3. Legal Business Entity &amp; Tax Information</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Official legal registration details required for marketplace compliance and invoicing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Legal Entity Business Name
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Storefront Slug (Permanent URL Handle)
              </label>
              <input
                type="text"
                value={form.businessSlug}
                disabled
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400">
                https://buybox.market/stores/{form.businessSlug}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GSTIN (Goods and Services Tax Identification)
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: normalizeGSTIN(e.target.value) })}
                placeholder="27AAPFU0939F1ZV"
                maxLength={15}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono focus:ring-2 focus:ring-[#004D38] outline-none"
              />
              {form.gstin && !validateGSTIN(form.gstin).isValid && (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  {validateGSTIN(form.gstin).error}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PAN (Permanent Account Number)
              </label>
              <input
                type="text"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: normalizePAN(e.target.value) })}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono focus:ring-2 focus:ring-[#004D38] outline-none"
              />
              {form.pan && !validatePAN(form.pan).isValid && (
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  {validatePAN(form.pan).error}
                </p>
              )}
            </div>
          </div>

          {/* Business Address */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Street Address
              </label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                placeholder="Shop No., Building, Street Name"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#004D38] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={form.country}
                  disabled
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            <span>{isSaving ? "Saving Changes..." : "Save Store & Branding Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
