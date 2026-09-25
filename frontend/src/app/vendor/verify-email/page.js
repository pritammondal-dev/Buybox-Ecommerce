"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Mail,
  RotateCw,
  AlertCircle,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { maskEmail } from "@/utils/dev-otp.util";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

function VendorVerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [isEditingEmail, setIsEditingEmail] = useState(!emailParam);
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [status, setStatus] = useState(tokenParam ? "verifying_token" : "idle"); // "idle" | "verifying_token" | "verifying_otp" | "success" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cooldown, setCooldown] = useState(emailParam ? RESEND_COOLDOWN_SECONDS : 0);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef([]);

  // Auto-verify token if token param is present in URL
  useEffect(() => {
    if (!tokenParam) return;

    authService
      .verifyEmail(tokenParam)
      .then(() => {
        setStatus("success");
        setSuccessMessage("Your merchant email address has been verified successfully.");
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Verification link has expired or is invalid. You can verify using your 6-digit code below."
        );
      });
  }, [tokenParam]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus the first slot on mount or when switching to idle/error
  useEffect(() => {
    if (status === "idle" || status === "error") {
      inputRefs.current[0]?.focus();
    }
  }, [status]);

  const handleDigitChange = (index, value) => {
    // Only accept numeric characters
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue) {
      const newDigits = [...otpDigits];
      newDigits[index] = "";
      setOtpDigits(newDigits);
      return;
    }

    const digit = cleanValue.slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setErrorMessage("");

    // Automatically advance to next slot
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...otpDigits];
        newDigits[index - 1] = "";
        setOtpDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pastedData[i] || "";
    }
    setOtpDigits(newDigits);
    setErrorMessage("");

    const lastFilledIndex = Math.min(pastedData.length, OTP_LENGTH) - 1;
    if (lastFilledIndex >= 0 && lastFilledIndex < OTP_LENGTH) {
      inputRefs.current[Math.min(lastFilledIndex + 1, OTP_LENGTH - 1)]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid merchant email address.");
      return;
    }

    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== OTP_LENGTH) {
      setErrorMessage(`Please enter all ${OTP_LENGTH} digits of your verification code.`);
      return;
    }

    setStatus("verifying_otp");
    setErrorMessage("");

    try {
      await authService.verifyOtp({
        email: email.trim(),
        otp: fullOtp,
        purpose: "email_verification",
      });
      setStatus("success");
      setSuccessMessage("Your merchant email has been verified successfully!");
    } catch (err) {
      setStatus("error");
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || err?.message || "Verification failed.";

      if (code === "OTP_MAX_ATTEMPTS_EXCEEDED" || code === "MAX_ATTEMPTS_EXCEEDED") {
        setErrorMessage("Too many incorrect attempts. This code has expired. Please request a new code.");
      } else if (code === "OTP_EXPIRED") {
        setErrorMessage("This verification code has expired. Please request a new code.");
      } else if (code === "INVALID_OTP") {
        const remaining = err?.response?.data?.data?.remainingAttempts;
        setErrorMessage(
          remaining !== undefined
            ? `Invalid verification code. ${remaining} attempt(s) remaining.`
            : "Invalid verification code. Please check and try again."
        );
      } else {
        setErrorMessage(msg);
      }
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter your registered email address first.");
      setIsEditingEmail(true);
      return;
    }

    setIsResending(true);
    setErrorMessage("");

    try {
      const res = await authService.resendOtp({
        email: email.trim(),
        purpose: "email_verification",
      });



      const serverCooldown =
        res?.data?.resendCooldownSeconds ||
        res?.resendCooldownSeconds ||
        res?.data?.data?.resendCooldownSeconds ||
        RESEND_COOLDOWN_SECONDS;
      setCooldown(serverCooldown);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setStatus("idle");
      toast.success("A new verification code has been dispatched to your email.");
      inputRefs.current[0]?.focus();
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === "RESEND_COOLDOWN_ACTIVE") {
        const retryAfter = err?.response?.data?.data?.retryAfter || 60;
        setCooldown(retryAfter);
        setErrorMessage(`Please wait ${retryAfter} seconds before requesting another code.`);
      } else if (code === "MAX_RESEND_EXCEEDED") {
        setErrorMessage("Maximum resend attempts reached. Please wait for the current code to expire.");
      } else {
        setErrorMessage(err?.response?.data?.message || "Failed to resend verification code.");
      }
    } finally {
      setIsResending(false);
    }
  };

  // SUCCESS STATE
  if (status === "success") {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card text-center">
        <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#007A55] flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="size-8 stroke-[2.2]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck className="size-3.5 text-[#007A55]" />
          Email Verified
        </div>

        <h1 className="text-2xl font-black text-slate-950 tracking-tight mb-2">
          Email Verified Successfully
        </h1>

        <p className="text-xs text-slate-600 leading-relaxed mb-5">
          {successMessage || "Your merchant email address has been verified. You can now sign in to your merchant console to track your application status and configure store settings."}
        </p>

        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-800 text-left mb-6 flex items-start gap-2.5">
          <Clock className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Onboarding Status: Pending Review.</strong> Platform administrators verify business and tax credentials before approving full storefront selling and checkout privileges.
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/vendor/login"
            className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
          >
            Sign In to Merchant Console
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/"
            className="w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center"
          >
            Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  // TOKEN AUTO-VERIFYING STATE
  if (status === "verifying_token") {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card text-center space-y-4">
        <div className="size-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#007A55] flex items-center justify-center mx-auto">
          <Loader2 className="size-8 animate-spin" />
        </div>
        <h1 className="text-xl font-black text-slate-950">
          Verifying Merchant Email...
        </h1>
        <p className="text-xs text-slate-500">
          Validating your single-use cryptographic verification token.
        </p>
      </div>
    );
  }

  // DEFAULT OTP INPUT FORM
  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-card">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-emerald-50 border border-emerald-100 mb-3 text-emerald-800 text-xs font-semibold tracking-wide">
          <Store className="size-4 mr-1.5 text-[#007A55]" />
          Buybox Merchant Verification
        </div>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">
          Verify Business Email
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {email ? (
            <>We&apos;ve sent a verification code to <span className="font-semibold text-slate-800">{maskEmail(email)}</span></>
          ) : (
            "We've sent a verification code to your business email."
          )}
        </p>
      </div>

      {/* Recipient Email Display / Edit */}
      <div className="mb-6 bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2.5 truncate">
          <Mail className="size-4 text-slate-400 shrink-0" />
          {isEditingEmail ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seller@business.com"
              className="bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#007A55] text-xs w-full max-w-[200px]"
            />
          ) : (
            <span className="font-semibold text-slate-900 truncate">{email ? maskEmail(email) : "No email specified"}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsEditingEmail(!isEditingEmail)}
          className="text-[#007A55] hover:underline font-semibold text-[11px] shrink-0 ml-2"
        >
          {isEditingEmail ? "Save" : "Change"}
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6-Digit OTP Input Grid */}
      <form onSubmit={handleVerifyOtp} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 text-center mb-3">
            6-Digit Verification Code
          </label>
          <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={status === "verifying_otp"}
                className="size-11 sm:size-12 text-center text-lg font-black font-mono rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007A55]/20 focus:border-[#007A55] transition-all disabled:opacity-50"
              />
            ))}
          </div>
        </div>

        {/* Submit Verification */}
        <button
          type="submit"
          disabled={status === "verifying_otp" || otpDigits.some((d) => !d)}
          className="w-full h-11 rounded-xl bg-[#007A55] hover:bg-[#006646] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2"
        >
          {status === "verifying_otp" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying Code...
            </>
          ) : (
            <>
              Confirm Verification
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        {/* Resend OTP with Cooldown */}
        <div className="text-center pt-2">
          {cooldown > 0 ? (
            <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-400" />
              Resend available in <strong className="font-mono text-slate-700">{cooldown}s</strong>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-xs font-semibold text-[#007A55] hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCw className={`size-3.5 ${isResending ? "animate-spin" : ""}`} />
              {isResending ? "Sending New Code..." : "Didn't receive code? Resend"}
            </button>
          )}
        </div>
      </form>

      {/* Back to Login */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <Link
          href="/vendor/login"
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Return to Seller Sign In
        </Link>
      </div>
    </div>
  );
}

export default function VendorVerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-card animate-pulse h-96" />
        }
      >
        <VendorVerifyEmailForm />
      </Suspense>
    </div>
  );
}
