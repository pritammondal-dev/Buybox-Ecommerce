"use client";

import React, { useState, useEffect } from "react";
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
import { useAuthStore } from "../../../stores/auth.store.js";
import {
  validateGSTIN,
  validatePAN,
  normalizeGSTIN,
  normalizePAN,
} from "../../../utils/compliance-validation.util.js";

export default function VendorRegisterPage() {
  const router = useRouter();
  const { user: currentCustomer, isAuthenticated } = useAuthStore();

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

  // Pre-fill user profile if customer is already authenticated
  useEffect(() => {
    if (isAuthenticated && currentCustomer) {
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || currentCustomer.name?.split(" ")[0] || "",
        lastName: prev.lastName || currentCustomer.name?.split(" ").slice(1).join(" ") || "",
        email: prev.email || currentCustomer.email || "",
        phone: prev.phone || currentCustomer.phone || "",
      }));
    }
  }, [isAuthenticated, currentCustomer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      let formattedVal = value;
      if (name === "taxId") {
        if (prev.taxType === "GSTIN") {
          formattedVal = normalizeGSTIN(value);
        } else if (prev.taxType === "PAN") {
          formattedVal = normalizePAN(value);
        } else {
          formattedVal = value.trim().toUpperCase();
        }
      }
      const updated = { ...prev, [name]: formattedVal };
      // Auto-generate businessSlug if businessName changed and slug not manually edited
      if (name === "businessName" && !prev.slugManuallyEdited) {
        updated.businessSlug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      }
      if (name === "taxType") {
        if (value === "GSTIN") {
          updated.taxId = normalizeGSTIN(prev.taxId);
        } else if (value === "PAN") {
          updated.taxId = normalizePAN(prev.taxId);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsConflict(false);

    if (formData.taxType === "GSTIN") {
      const gstinCheck = validateGSTIN(formData.taxId);
      if (!gstinCheck.isValid) {
        setErrorMessage(gstinCheck.error);
        toast.error("Invalid Tax Identification", { description: gstinCheck.error });
        return;
      }
    } else if (formData.taxType === "PAN") {
      const panCheck = validatePAN(formData.taxId);
      if (!panCheck.isValid) {
        setErrorMessage(panCheck.error);
        toast.error("Invalid Tax Identification", { description: panCheck.error });
        return;
      }
    }

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
          country: (() => {
            const raw = (formData.country || "IN").trim();
            const map = {
              india: "IN",
              "united states": "US",
              usa: "US",
              "united kingdom": "GB",
              uk: "GB",
              canada: "CA",
              australia: "AU",
              germany: "DE",
              singapore: "SG",
              "united arab emirates": "AE",
              uae: "AE",
            };
            return map[raw.toLowerCase()] || raw.toUpperCase();
          })(),
        },
        taxInformation: {
          taxId: formData.taxId.trim(),
          taxType: formData.taxType.trim() || "GSTIN",
        },
      };

      const res = await vendorService.registerVendor(payload);
      const resData = res?.data?.data || res?.data || payload;

      setIsSuccess(true);
      setRegisteredData(resData);
      const isAlreadyVerified = resData?.user?.isEmailVerified === true;
      toast.success(
        resData?.isExistingUser ? "Vendor Application Linked" : "Vendor Registration Submitted",
        {
          description: isAlreadyVerified
            ? "Your vendor application has been linked to your verified account and is under review."
            : resData?.emailDelivery?.sent === false
            ? "Account registered. Verification email could not be delivered yet."
            : "Please verify your email with the 6-digit code sent to your inbox.",
        }
      );
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;

      if (code === "SLUG_ALREADY_EXISTS") {
        setIsConflict(false);
        setErrorMessage("This Storefront Slug (URL handle) is already taken. Please choose another slug.");
      } else if (code === "STAFF_CANNOT_BE_VENDOR") {
        setIsConflict(false);
        setErrorMessage("Internal staff accounts cannot apply to become vendors.");
      } else if (status === 409 || code === "EMAIL_ALREADY_EXISTS") {
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
    const isEmailVerified = registeredData?.user?.isEmailVerified === true;
    const isLinkedAccount = registeredData?.isExistingUser === true;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-card text-center">
          <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-6">
            <Clock className="size-8 stroke-[2.2]" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 text-xs font-bold uppercase tracking-wider">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              Status: Pending Admin Approval
            </div>
            {isEmailVerified && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="size-3 text-emerald-600" />
                Email: Verified
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-3">
            {isLinkedAccount ? "Vendor Application Linked!" : "Application Received!"}
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Thank you for registering <strong>{formData.businessName}</strong> with Buybox.
            {isLinkedAccount
              ? " Your vendor application has been linked to your existing Buybox account and placed into our review pipeline."
              : " Your merchant account has been placed into our review pipeline."}
            {" "}Platform administrators verify your business credentials and tax registration before activating your storefront.
          </p>

          {!isEmailVerified && registeredData?.emailDelivery?.sent === false && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-800 flex items-start gap-2.5">
              <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Notice: Verification Email Delivery Delayed</strong>
                <span>
                  Our email transport service is currently pending operator review. Your seller application has been securely created, but the verification code could not be delivered to your inbox yet. Please proceed to verify and use &quot;Resend Code&quot; or contact support.
                </span>
              </div>
            </div>
          )}

          {isEmailVerified && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left text-xs text-emerald-800 flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5">Email Verified via Existing Account</strong>
                <span>
                  Your email is already verified. You do not need to enter an OTP code. Once an administrator approves your vendor application, you will be able to log in to the Seller Portal with your account.
                </span>
              </div>
            </div>
          )}

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
            {isEmailVerified ? (
              <Link
                href="/vendor/login"
                className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
              >
                Go to Vendor Login
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <Link
                href={`/vendor/verify-email?email=${encodeURIComponent(formData.email)}`}
                className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
              >
                Verify Email Address Now
                <ArrowRight className="size-4" />
              </Link>
            )}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {!isEmailVerified && (
                <Link
                  href="/vendor/login"
                  className="w-full sm:flex-1 h-10 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  Go to Vendor Login
                </Link>
              )}
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

        {isAuthenticated && currentCustomer && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-semibold block">Signed in as {currentCustomer.email}</span>
              <span className="text-emerald-700">
                Your vendor application will be seamlessly linked to this Buybox account.
              </span>
            </div>
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
                  Create or Set Merchant Password (min 8 chars) *
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
                <p className="mt-1 text-[11px] text-slate-500">
                  If you already have a customer account, this password will allow direct login to your Seller Console.
                </p>
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
                  Country Code (ISO 2-letter) *
                </label>
                <input
                  type="text"
                  name="country"
                  required
                  maxLength={2}
                  value={formData.country}
                  onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value.toUpperCase() }))}
                  placeholder="IN"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
                <p className="mt-1 text-[11px] text-slate-400">e.g., IN for India, US for United States</p>
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
                  placeholder={
                    formData.taxType === "GSTIN"
                      ? "29ABCDE1234F1Z5"
                      : formData.taxType === "PAN"
                      ? "ABCDE1234F"
                      : "Tax Registration ID"
                  }
                  className="w-full px-3.5 py-2 text-sm uppercase font-mono rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55]"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {formData.taxType === "GSTIN"
                    ? "Format: 2 digits + 10-char PAN + 1 entity code + 'Z' + 1 check digit (15 chars)"
                    : formData.taxType === "PAN"
                    ? "Format: 5 letters + 4 digits + 1 letter (10 chars, e.g. ABCDE1234F)"
                    : "Enter your official legal tax registration number"}
                </p>
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
