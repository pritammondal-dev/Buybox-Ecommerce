"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, ShoppingBag, Loader2, ArrowRight } from "lucide-react";
import { authService } from "../../services/auth.service.js";

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState(token ? "verifying" : "error"); // "verifying" | "success" | "error"
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "No verification token found in URL."
  );

  useEffect(() => {
    if (!token) return;

    authService
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err?.message || "Email verification failed or token has expired.");
      });
  }, [token]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card space-y-4">
      <Link href="/" className="inline-flex items-center gap-2 group mb-2">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
          <ShoppingBag className="size-5 stroke-[2.2]" />
        </div>
        <span className="text-2xl font-black text-[#007A55] tracking-tight">
          Buybox
        </span>
      </Link>

      {status === "verifying" && (
        <div className="py-8 space-y-3">
          <Loader2 className="size-10 text-[#007A55] animate-spin mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Verifying Your Email...</h2>
          <p className="text-xs text-muted-foreground">Please wait a moment while we validate your token.</p>
        </div>
      )}

      {status === "success" && (
        <div className="py-6 space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
            <CheckCircle2 className="size-8 stroke-[2]" />
          </div>
          <h2 className="text-xl font-black text-slate-950">Email Verified!</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your email address has been verified. You now have full access to your account and orders.
          </p>
          <div className="pt-4">
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all"
            >
              Sign In to Your Account
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="py-6 space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="size-8 stroke-[2]" />
          </div>
          <h2 className="text-xl font-black text-slate-950">Verification Failed</h2>
          <p className="text-xs text-red-600 leading-relaxed">{errorMessage}</p>
          <div className="pt-4">
            <Link
              href="/auth/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 text-white font-bold text-xs py-3 hover:bg-slate-800"
            >
              Back to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyEmailView;
