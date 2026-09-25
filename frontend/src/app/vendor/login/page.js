"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Store,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../../stores/auth.store.js";
import { Button } from "../../../components/ui/Button.jsx";

function VendorLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/vendor/dashboard";

  const loginStore = useAuthStore((state) => state.vendorLogin);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setUnverifiedEmail(null);

    if (!email || !password) {
      setErrorMessage("Please provide both email and password.");
      return;
    }

    try {
      await loginStore({ email: email.trim(), password });
      const currentUser = useAuthStore.getState().user;

      if (currentUser && currentUser.role === "customer") {
        setErrorMessage(
          "Your account is registered as a Customer. Please sign in with your Seller account credentials or apply as a new vendor."
        );
        return;
      }

      if (currentUser && currentUser.isEmailVerified === false) {
        setUnverifiedEmail(currentUser.email);
        setErrorMessage(
          "Your business email address has not been verified yet. Please enter your verification code to activate your seller account."
        );
        return;
      }

      toast.success("Welcome to Vendor Portal", {
        description: "Authenticated successfully.",
      });

      router.push(redirectPath);
    } catch (err) {
      setErrorMessage(
        err?.message || "Invalid credentials. Please check your email and password."
      );
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 text-emerald-800 text-xs font-semibold tracking-wide">
          <Store className="size-4 mr-1.5 text-emerald-600" />
          Buybox Merchant Center
        </div>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          Seller Sign In
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Access your catalog, warehouse allocations, shipments, and settlements.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex flex-col gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          {unverifiedEmail && (
            <Link
              href={`/vendor/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
              className="mt-1 py-1.5 px-3 rounded-lg bg-[#007A55] text-white font-semibold text-xs text-center hover:bg-[#006646] transition-colors"
            >
              Verify Email Address Now →
            </Link>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="vendor-email"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Registered Business Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              id="vendor-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seller@business.com"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55] transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="vendor-password"
              className="block text-xs font-semibold text-slate-700"
            >
              Password
            </label>
            <Link
              href="/vendor/forgot-password"
              className="text-xs font-semibold text-[#007A55] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              id="vendor-password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            "Authenticating..."
          ) : (
            <>
              Sign In to Merchant Console
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {/* Onboarding / Register link */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
        <p className="text-xs text-slate-500 text-center">
          Want to sell on Buybox?{" "}
          <Link
            href="/vendor/register"
            className="font-bold text-[#007A55] hover:underline inline-flex items-center gap-1"
          >
            Register as a Vendor <ArrowRight className="size-3" />
          </Link>
        </p>

        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Return to Storefront
        </Link>
      </div>
    </div>
  );
}

export default function VendorLoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-slate-50">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card animate-pulse h-96" />
        }
      >
        <VendorLoginForm />
      </Suspense>
    </div>
  );
}
