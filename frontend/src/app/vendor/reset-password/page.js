"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Store,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";

function VendorResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!token) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card text-center space-y-4">
        <div className="size-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle className="size-7 stroke-[2.2]" />
        </div>
        <h1 className="text-xl font-black text-slate-950">
          Missing Reset Token
        </h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your password reset link is invalid or incomplete. Please request a new recovery link from the merchant sign-in portal.
        </p>
        <Link
          href="/vendor/forgot-password"
          className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#007A55] text-white font-semibold text-sm hover:bg-[#006646] transition-colors"
        >
          Request New Reset Link
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  // Password strength calculation
  const hasMinLen = newPassword.length >= 8;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!hasMinLen) {
      setErrorMessage("Password must be at least 8 characters in length.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword({
        token: token.trim(),
        newPassword,
      });

      setIsSuccess(true);
      toast.success("Merchant password reset successfully!");
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "INVALID_OR_EXPIRED_RESET_TOKEN") {
        setErrorMessage("This password reset link has expired or has already been used. Please request a new link.");
      } else {
        setErrorMessage(
          err?.response?.data?.message || err?.message || "Failed to reset password. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card text-center space-y-6">
        <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#007A55] flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-8 stroke-[2.2]" />
        </div>

        <div>
          <h1 className="text-2xl font-black text-slate-950 mb-2">
            Password Updated!
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your merchant password has been changed securely and previous active sessions have been revoked. You can now sign in with your new credentials.
          </p>
        </div>

        <Link
          href="/vendor/login"
          className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
        >
          Sign In with New Password
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 text-emerald-800 text-xs font-semibold tracking-wide">
          <Store className="size-4 mr-1.5 text-[#007A55]" />
          Buybox Merchant Security
        </div>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          Create New Password
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Enter and confirm your new secure merchant console password.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="new-password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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

        <div>
          <label
            htmlFor="confirm-password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55] transition-all"
            />
          </div>
        </div>

        {/* Strength checklist */}
        <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${hasMinLen ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className={hasMinLen ? "text-slate-700 font-semibold" : ""}>At least 8 characters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${hasMixedCase ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className={hasMixedCase ? "text-slate-700 font-semibold" : ""}>Uppercase & lowercase letters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`size-1.5 rounded-full ${isMatch ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className={isMatch ? "text-slate-700 font-semibold" : ""}>Passwords match</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !hasMinLen || newPassword !== confirmPassword}
          className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            <>
              Save & Sign In
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <Link
            href="/vendor/login"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Cancel and Return to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function VendorResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card animate-pulse h-96" />
        }
      >
        <VendorResetPasswordForm />
      </Suspense>
    </div>
  );
}
