"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Building2,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  FileCheck2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "../../../services/vendor.service.js";
import { Button } from "../../../components/ui/Button.jsx";

export default function VendorRegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    businessName: "",
    businessSlug: "",
    supportEmail: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
    taxId: "",
    taxType: "GSTIN",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConflict, setIsConflict] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredData, setRegisteredData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate businessSlug if businessName changed and slug not manually edited
      if (name === "businessName" && !prev.slugManuallyEdited) {
        updated.businessSlug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsConflict(false);
    setIsSubmitting(true);

    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        businessName: formData.businessName.trim(),
        businessSlug: formData.businessSlug.trim(),
        supportEmail: formData.supportEmail.trim() || formData.email.trim(),
        businessAddress: {
          addressLine1: formData.addressLine1.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim() || "IN",
        },
        taxInformation: {
          taxId: formData.taxId.trim(),
          taxType: formData.taxType.trim() || "GSTIN",
        },
      };

      const res = await vendorService.registerVendor(payload);

      setIsSuccess(true);
      setRegisteredData(res?.data?.data || res?.data || payload);
      toast.success("Vendor Registration Submitted", {
        description: "Please verify your email with the 6-digit code sent to your inbox.",
      });

      // Automatically navigate to vendor OTP verification view with email param
      router.push(`/vendor/verify-email?email=${encodeURIComponent(formData.email.trim())}`);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;

      if (status === 409 || code === "EMAIL_ALREADY_EXISTS") {
        setIsConflict(true);
        setErrorMessage(
          "An account may already be associated with this email. Please sign in or use Forgot Password."
        );
      } else {
        setIsConflict(false);
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to submit vendor registration. Please verify details."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-card text-center">
          <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-6">
            <Clock className="size-8 stroke-[2.2]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-bold uppercase tracking-wider mb-3">
            <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
            Status: Pending Admin Approval
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-3">
            Application Received!
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Thank you for registering <strong>{formData.businessName}</strong> with Buybox.
            Your merchant account has been placed into our review pipeline. Platform administrators
            verify your business credentials and tax registration before activating your storefront.
          </p>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left text-xs space-y-2 mb-8 text-slate-600">
            <div className="flex justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-400">Merchant Business:</span>
              <span className="font-semibold text-slate-800">{formData.businessName}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-400">Primary Contact:</span>
              <span className="font-semibold text-slate-800">{formData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tax Identification:</span>
              <span className="font-semibold text-slate-800">{formData.taxId} ({formData.taxType})</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={`/vendor/verify-email?email=${encodeURIComponent(formData.email)}`}
              className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
            >
              Verify Email Address Now
              <ArrowRight className="size-4" />
            </Link>
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <Link
                href="/vendor/login"
                className="w-full sm:flex-1 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                Go to Vendor Login
              </Link>
              <Link
                href="/"
                className="w-full sm:flex-1 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center"
              >
                Return to Storefront
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group mb-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
              <Store className="size-5 stroke-[2.2]" />
            </div>
            <span className="text-2xl font-black text-[#007A55] tracking-tight">
              Buybox Seller Network
            </span>
          </Link>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Register as a Vendor
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Reach millions of shoppers, optimize fulfillment, and scale your brand.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex flex-col gap-2.5 shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
            {isConflict && (
              <div className="flex items-center gap-4 pl-6 pt-1 text-xs font-semibold">
                <Link
                  href="/vendor/login"
                  className="text-[#007A55] hover:underline"
                >
                  Vendor Login →
                </Link>
                <Link
                  href="/auth/forgot-password"
                  className="text-slate-600 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-8"
        >
          {/* Section 1: Business Identity */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <Building2 className="size-5 text-[#007A55]" />
              <h2 className="text-base font-bold text-slate-900">
                1. Business Identity
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Business Name *
                </label>
                <input
                  type="text"
                  name="businessName"
                  required
                  value={formData.businessName}
                  onChange={handleChange}
                  placeholder="Acme Retail Solutions Pvt Ltd"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Storefront Slug (URL handle) *
                </label>
                <input
                  type="text"
                  name="businessSlug"
                  required
                  value={formData.businessSlug}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      businessSlug: e.target.value,
                      slugManuallyEdited: true,
                    }));
                  }}
                  placeholder="acme-retail"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Support Email
                </label>
                <input
                  type="email"
                  name="supportEmail"
                  value={formData.supportEmail}
                  onChange={handleChange}
                  placeholder="support@acmeretail.com (defaults to account email)"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Account Owner & Login */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <User className="size-5 text-[#007A55]" />
              <h2 className="text-base font-bold text-slate-900">
                2. Owner / Authorized Representative
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business / Login Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="jane@acmeretail.com"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Create Password (min 8 chars) *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Registered Address */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <MapPin className="size-5 text-[#007A55]" />
              <h2 className="text-base font-bold text-slate-900">
                3. Business Physical Address
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Street Address / Industrial Area *
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  required
                  value={formData.addressLine1}
                  onChange={handleChange}
                  placeholder="Plot 42, Sector 18, Commercial Zone"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  required
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Mumbai"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State / Province *
                </label>
                <input
                  type="text"
                  name="state"
                  required
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="Maharashtra"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Postal / PIN Code *
                </label>
                <input
                  type="text"
                  name="postalCode"
                  required
                  value={formData.postalCode}
                  onChange={handleChange}
                  placeholder="400001"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Country *
                </label>
                <input
                  type="text"
                  name="country"
                  required
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Tax & Regulatory */}
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <FileCheck2 className="size-5 text-[#007A55]" />
              <h2 className="text-base font-bold text-slate-900">
                4. Tax & Governance
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Type *
                </label>
                <select
                  name="taxType"
                  value={formData.taxType}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                >
                  <option value="GSTIN">GSTIN (India Goods & Services Tax)</option>
                  <option value="PAN">PAN (Permanent Account Number)</option>
                  <option value="VAT">VAT / Tax Identification</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Registration Number *
                </label>
                <input
                  type="text"
                  name="taxId"
                  required
                  value={formData.taxId}
                  onChange={handleChange}
                  placeholder="27AAAAA0000A1Z5"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                "Submitting Application..."
              ) : (
                <>
                  Submit Vendor Application
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <p className="mt-4 text-xs text-center text-slate-500">
              Already a seller on Buybox?{" "}
              <Link href="/vendor/login" className="font-bold text-[#007A55] hover:underline">
                Sign In to Console
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
