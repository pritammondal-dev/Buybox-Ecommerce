"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendor.service";

export default function VendorStoreSettingsPage() {
  const [vendor, setVendor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

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
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await vendorService.getMyProfile();
        const v = res?.data?.data?.vendor || res?.data?.vendor || res?.data;
        setVendor(v);

        const addr = v?.businessAddress || {};
        const tax = v?.taxInformation || {};

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
        });
      } catch (err) {
        toast.error("Failed to load vendor store profile", {
          description: err.response?.data?.message || err.message,
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      await vendorService.resubmitApplication();
      toast.success("Application resubmitted successfully! It is now pending operations review.");
      const res = await vendorService.getMyProfile();
      const v = res?.data?.data?.vendor || res?.data?.vendor || res?.data;
      setVendor(v);
    } catch (err) {
      toast.error("Failed to resubmit application", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
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
      toast.success("Store settings updated successfully");
    } catch (err) {
      toast.error("Failed to update store settings", {
        description: err.response?.data?.message || err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

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
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Store Settings & Profile
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your merchant storefront identity, contact emails, physical address, and tax information.
        </p>
      </div>

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
            <h4 className="text-sm font-bold text-blue-900">Application Under Review</h4>
            <p className="text-xs text-blue-700 mt-0.5">
              Your merchant application is currently being evaluated by marketplace operations. You will be notified via email once approved.
            </p>
          </div>
        </div>
      )}

      {vendor?.onboardingStatus === "rejected" && (
        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0 mt-0.5">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Application Not Approved</h4>
              <p className="text-xs text-rose-800 mt-1 font-medium">
                Decision rationale: &ldquo;{vendor.rejectionReason}&rdquo;
              </p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                You can update your business registration details below and submit a re-evaluation request.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResubmit}
            disabled={isResubmitting || isSaving}
            className="shrink-0 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            <span>{isResubmitting ? "Resubmitting..." : "Resubmit Application"}</span>
          </button>
        </div>
      )}

      {vendor?.onboardingStatus === "approved" && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200/80 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">Approved Marketplace Merchant</h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              Your merchant account is active. Storefront products, warehouse management, and fulfillment services are fully enabled.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Identity */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Marketplace Merchant Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store URL Identifier
              </label>
              <input
                type="text"
                value={form.businessSlug}
                disabled
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Support Email
              </label>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Business Address */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Registered Business Address
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                State / Province
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Postal / PIN Code
              </label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Country
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Tax & Legal Identification
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GSTIN (Goods and Services Tax Number)
              </label>
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                PAN (Permanent Account Number)
              </label>
              <input
                type="text"
                value={form.pan}
                onChange={(e) => setForm({ ...form, pan: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Masked Banking Details (Read Only security guarantee) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900">
              Payout Bank Account
            </h3>
            <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
              <Lock className="size-3" /> Secure Vault Storage
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600">
                <CreditCard className="size-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {vendor?.bankAccount?.bankName || "State Bank of India"}
                </p>
                <p className="font-mono text-slate-500">
                  Account: ••••••••{vendor?.bankAccount?.accountNumber?.slice(-4) || "8821"}
                </p>
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold text-slate-600">
              IFSC: {vendor?.bankAccount?.ifscCode || "SBIN0001234"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            For security reasons, bank account modifications require contacting marketplace admin support.
          </p>
        </div>

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="size-4" />
            <span>{isSaving ? "Saving..." : "Save Store Changes"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
