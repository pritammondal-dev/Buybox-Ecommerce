"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Loader2,
  ArrowRight,
  Mail,
  RotateCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "../../services/auth.service.js";
import { maskEmail } from "../../utils/dev-otp.util.js";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailView() {
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

  // Focus the first slot on mount or when switching to idle
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
      setErrorMessage("Please enter a valid email address.");
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
    } catch (err) {
      setStatus("error");
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || err?.message || "Verification failed.";

      if (code === "OTP_MAX_ATTEMPTS_EXCEEDED" || code === "MAX_ATTEMPTS_EXCEEDED") {
        setErrorMessage("Too many incorrect attempts. This code has expired. Please request a new code.");
      } else if (code === "OTP_EXPIRED") {
        setErrorMessage("This code has expired. Please request a fresh verification code.");
      } else if (code === "INVALID_OTP") {
        const remaining = err?.response?.data?.data?.remainingAttempts;
        setErrorMessage(
          remaining !== undefined
            ? `The verification code entered is incorrect. ${remaining} attempt(s) remaining.`
            : "The verification code entered is incorrect. Please check your email and try again."
        );
      } else {
        setErrorMessage(msg);
      }
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address to receive a code.");
      return;
    }

    setIsResending(true);
    setErrorMessage("");
    setSuccessMessage("");

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
      setSuccessMessage("A fresh 6-digit verification code has been dispatched to your inbox.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      const remainingSeconds = err?.response?.data?.data?.remainingSeconds;
      if (remainingSeconds) {
        setCooldown(remainingSeconds);
        setErrorMessage(`Please wait ${remainingSeconds} seconds before requesting another code.`);
      } else {
        setErrorMessage(err?.response?.data?.message || err?.message || "Could not resend verification code.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card space-y-5">
      {/* Brand Header */}
      <Link href="/" className="inline-flex items-center gap-2 group mb-1">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
          <ShoppingBag className="size-5 stroke-[2.2]" />
        </div>
        <span className="text-2xl font-black text-[#007A55] tracking-tight">
          Buybox
        </span>
      </Link>

      {/* Token Link Verifying Spinner */}
      {status === "verifying_token" && (
        <div className="py-8 space-y-3">
          <Loader2 className="size-10 text-[#007A55] animate-spin mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Validating Link...</h2>
          <p className="text-xs text-muted-foreground">Please wait a moment while we verify your account.</p>
        </div>
      )}

      {/* Success State */}
      {status === "success" && (
        <div className="py-6 space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
            <CheckCircle2 className="size-8 stroke-[2]" />
          </div>
          <h2 className="text-xl font-black text-slate-950">Email Verified!</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your email address has been successfully verified. You now have full access to your Buybox account, cart, and orders.
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

      {/* OTP Input Form (Default / Idle / Error / Verifying OTP) */}
      {status !== "success" && status !== "verifying_token" && (
        <div className="space-y-4 text-left">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-black text-slate-950">Verify Your Email</h1>
            <p className="text-xs text-slate-500">
              {email ? (
                <>We&apos;ve sent a verification code to <span className="font-semibold text-slate-800">{maskEmail(email)}</span></>
              ) : (
                "We've sent a verification code to your email."
              )}
            </p>
          </div>

          {/* Email Display / Edit */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden text-slate-700">
              <Mail className="size-4 shrink-0 text-slate-400" />
              {isEditingEmail ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-white px-2 py-1 rounded border border-slate-300 text-xs w-full focus:outline-none focus:border-[#007A55]"
                />
              ) : (
                <span className="truncate font-medium">{email ? maskEmail(email) : "No email specified"}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsEditingEmail(!isEditingEmail)}
              className="text-[#007A55] hover:underline font-semibold shrink-0 ml-2 text-[11px]"
            >
              {isEditingEmail ? "Done" : "Change"}
            </button>
          </div>

          {/* Success Banner (e.g. code resent) */}
          {successMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6-Digit OTP Input Grid */}
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex justify-center gap-2 sm:gap-2.5 py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  aria-label={`Digit ${idx + 1}`}
                  className={`size-11 sm:size-12 rounded-xl border text-center text-lg font-black transition-all focus:outline-none focus:ring-2 ${
                    errorMessage
                      ? "border-red-400 bg-red-50/20 text-red-900 focus:ring-red-300"
                      : digit
                      ? "border-[#007A55] bg-emerald-50/20 text-[#007A55] focus:ring-[#007A55]/30"
                      : "border-slate-200 bg-white text-slate-900 focus:border-[#007A55] focus:ring-[#007A55]/20"
                  }`}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={status === "verifying_otp" || otpDigits.join("").length !== OTP_LENGTH}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "verifying_otp" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Verifying Code...
                </>
              ) : (
                <>
                  Verify & Proceed
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend Cooldown & Action */}
          <div className="text-center pt-2">
            {cooldown > 0 ? (
              <p className="text-xs text-slate-500">
                Didn&apos;t receive the code? Resend available in{" "}
                <span className="font-bold text-slate-800">{cooldown}s</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:text-[#006346] transition-colors disabled:opacity-50"
              >
                <RotateCw className={`size-3.5 ${isResending ? "animate-spin" : ""}`} />
                {isResending ? "Sending New Code..." : "Resend Verification Code"}
              </button>
            )}
          </div>

          {/* Back to Login */}
          <div className="pt-2 text-center">
            <Link
              href="/auth/login"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyEmailView;
