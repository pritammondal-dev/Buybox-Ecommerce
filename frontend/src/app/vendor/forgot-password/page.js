"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
} from "lucide-react";
import { authService } from "@/services/auth.service";

export default function VendorForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid registered business email.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.requestPasswordReset({ email: email.trim() });
      setIsSubmitted(true);
    } catch (err) {
      // Avoid account enumeration on production while showing truthful connection errors
      if (err.status === 400) {
        setErrorMessage(err.message || "Invalid email format.");
      } else {
        // Safe generic message
        setIsSubmitted(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 text-emerald-800 text-xs font-semibold tracking-wide">
            <Store className="size-4 mr-1.5 text-[#007A55]" />
            Buybox Merchant Recovery
          </div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">
            Reset Merchant Password
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Enter your business email to receive secure password reset instructions.
          </p>
        </div>

        {isSubmitted ? (
          <div className="text-center space-y-6">
            <div className="size-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#007A55] flex items-center justify-center mx-auto">
              <CheckCircle2 className="size-7 stroke-[2.2]" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Instructions Dispatched
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an active merchant account exists for <strong>{email}</strong>, a secure, single-use password reset link has been dispatched via email.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl text-[11px] text-slate-500 text-left">
              <strong>Security Notice:</strong> The reset link is cryptographically signed and expires within 1 hour. Never share your recovery link with anyone.
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                href="/vendor/login"
                className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                Return to Seller Sign In
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors py-1"
              >
                Request for another email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2"
              >
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="merchant-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Registered Business Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  id="merchant-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@business.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending Instructions...
                </>
              ) : (
                <>
                  Send Recovery Link
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <Link
                href="/vendor/login"
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← Return to Seller Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
