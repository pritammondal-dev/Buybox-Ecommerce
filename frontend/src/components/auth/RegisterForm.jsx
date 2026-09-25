"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "../../services/auth.service.js";
import { useAuthStore } from "../../stores/auth.store.js";
import { useCartStore } from "../../stores/cart.store.js";
import { maskPhone } from "../../utils/dev-otp.util.js";
import { Button } from "../ui/Button.jsx";
import { GoogleSignInButton } from "./GoogleSignInButton.jsx";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/account";

  const registerWithPhone = useAuthStore((state) => state.registerWithPhone);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);

  // Tabs: "email" | "mobile"
  const [signupMode, setSignupMode] = useState("email");

  // Common fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Email registration fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Mobile registration fields
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState("request"); // "request" | "verify"
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);

  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConflict, setIsConflict] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRefs = useRef([]);

  // Resend cooldown timer for phone
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus the first slot on switching to phone OTP verification
  useEffect(() => {
    if (phoneStep === "verify") {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [phoneStep]);

  /**
   * Handle Email Registration
   */
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsConflict(false);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setErrorMessage("All fields are required.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });

      setIsSuccess(true);
      toast.success("Account created successfully!", {
        description: "Please enter the 6-digit verification code sent to your email.",
      });

      router.push(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`);
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
            "Registration failed. Please check your details and try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Mobile Registration (Request OTP)
   */
  const handlePhoneRequestSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsConflict(false);

    if (!firstName.trim() || !phone.trim()) {
      setErrorMessage("First name and mobile number are required.");
      return;
    }

    setIsRequestingOtp(true);
    try {
      const res = await authService.requestPhoneRegister({
        phone: phone.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      setCooldown(res?.data?.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS);
      setPhoneStep("verify");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      toast.success("Verification code sent!", {
        description: `Code sent to ${maskPhone(phone.trim())}`,
      });
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;

      if (status === 409 || code === "PHONE_ALREADY_EXISTS") {
        setIsConflict(true);
        setErrorMessage(
          "An account is already associated with this mobile number. Please sign in."
        );
      } else if (status === 503 || code === "SMS_PROVIDER_NOT_CONFIGURED") {
        setErrorMessage(
          "SMS delivery is not configured on this server. Please use Email Registration or contact support."
        );
      } else {
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to send mobile verification code. Please check the number and try again."
        );
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * Handle Mobile Registration (Verify OTP)
   */
  const handlePhoneVerifySubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const otp = otpDigits.join("").trim();
    if (otp.length !== OTP_LENGTH) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    try {
      await registerWithPhone({
        phone: phone.trim(),
        otp,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      // Migrate guest cart if needed
      const guestItems = useCartStore.getState().guestCart?.items || [];
      if (guestItems.length > 0) {
        useCartStore.getState().migrateGuestCartToServer().catch(() => {});
      }

      toast.success("Account registered successfully!", {
        description: "Welcome to Buybox.",
      });

      router.push(redirectPath);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Verification code is invalid or has expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDigitChange = (index, value) => {
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

    const nextIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-[#007A55] mb-2">
          <CheckCircle2 className="size-10 stroke-[2]" />
        </div>
        <h2 className="text-xl font-black text-slate-950">Registration Complete!</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          We have created your account. We sent a 6-digit verification code to{" "}
          <strong className="text-slate-900">{email}</strong>.
        </p>
        <div className="pt-4 flex flex-col gap-2">
          <Link
            href={`/auth/verify-email?email=${encodeURIComponent(email.trim())}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Enter Verification Code
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href={`/auth/login${redirectPath !== "/account" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs py-3 transition-all cursor-pointer"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2 group mb-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
            <ShoppingBag className="size-5 stroke-[2.2]" />
          </div>
          <span className="text-2xl font-black text-[#007A55] tracking-tight">Buybox</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
          Create an Account
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Join Buybox for faster checkouts, order tracking, and exclusive discounts
        </p>
      </div>

      {/* Registration Mode Selector */}
      <div className="grid grid-cols-2 p-1 mb-6 rounded-2xl bg-slate-100 border border-slate-200/60 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setSignupMode("email");
            setErrorMessage("");
          }}
          className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            signupMode === "email"
              ? "bg-white text-slate-950 shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Mail className="size-3.5" />
          Email Signup
        </button>
        <button
          type="button"
          onClick={() => {
            setSignupMode("mobile");
            setErrorMessage("");
          }}
          className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            signupMode === "mobile"
              ? "bg-white text-slate-950 shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <Smartphone className="size-3.5" />
          Mobile Signup
        </button>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          {isConflict && (
            <div className="flex items-center gap-3 pl-6 pt-1 text-[11px] font-semibold">
              <Link
                href={`/auth/login${email ? `?email=${encodeURIComponent(email.trim())}` : ""}`}
                className="text-[#007A55] hover:underline"
              >
                Sign In →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          MODE 1: EMAIL REGISTRATION
          ==================================================================== */}
      {signupMode === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                First Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 outline-none focus:border-[#007A55] focus:bg-white"
                  required
                />
                <User className="size-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 outline-none focus:border-[#007A55] focus:bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 outline-none focus:border-[#007A55] focus:bg-white"
                required
              />
              <Mail className="size-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Password (min 8 chars) *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 pr-9 outline-none focus:border-[#007A55] focus:bg-white"
                required
              />
              <Lock className="size-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Confirm Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 outline-none focus:border-[#007A55] focus:bg-white"
                required
              />
              <Lock className="size-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Creating Account...
              </>
            ) : (
              <>
                Create Account <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* ====================================================================
          MODE 2: MOBILE REGISTRATION
          ==================================================================== */}
      {signupMode === "mobile" && phoneStep === "request" && (
        <form onSubmit={handlePhoneRequestSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                First Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 outline-none focus:border-[#007A55] focus:bg-white"
                  required
                />
                <User className="size-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 outline-none focus:border-[#007A55] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Mobile Number *
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full rounded-xl border bg-slate-50/40 px-3 py-2.5 pl-9 outline-none focus:border-[#007A55] focus:bg-white"
                required
              />
              <Smartphone className="size-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Include country code (e.g. +91 for India)
            </p>
          </div>

          <Button
            type="submit"
            disabled={isRequestingOtp}
            className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isRequestingOtp ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Sending Code...
              </>
            ) : (
              <>
                Continue with Mobile <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* ====================================================================
          MODE 2: MOBILE REGISTRATION OTP VERIFICATION
          ==================================================================== */}
      {signupMode === "mobile" && phoneStep === "verify" && (
        <form onSubmit={handlePhoneVerifySubmit} className="space-y-5 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[240px]">
              {phone}
            </span>
            <button
              type="button"
              onClick={() => {
                setPhoneStep("request");
                setErrorMessage("");
              }}
              className="text-[#007A55] font-bold hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-2 uppercase tracking-wider text-center">
              Enter 6-Digit Code
            </label>
            <div className="flex justify-center gap-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  className="size-11 sm:size-12 rounded-xl border border-slate-200 bg-slate-50/50 text-center text-lg font-black text-slate-900 outline-none focus:border-[#007A55] focus:bg-white focus:ring-2 focus:ring-[#007A55]/20 transition-all"
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || otpDigits.join("").length !== OTP_LENGTH}
            className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Completing Registration...
              </>
            ) : (
              <>
                Verify & Create Account <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setPhoneStep("request");
                setErrorMessage("");
              }}
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="size-3" /> Back
            </button>

            <button
              type="button"
              onClick={handlePhoneRequestSubmit}
              disabled={cooldown > 0 || isRequestingOtp}
              className="font-bold text-[#007A55] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
            >
              {cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : isRequestingOtp ? (
                <>
                  <RotateCw className="size-3 animate-spin" /> Sending...
                </>
              ) : (
                "Resend code"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Google Sign-Up Alternative */}
      <div className="relative my-6 text-center text-xs">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <span className="relative bg-white px-3 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          Or
        </span>
      </div>

      <GoogleSignInButton
        textType="signup_with"
        onSuccess={() => {
          const guestItems = useCartStore.getState().guestCart?.items || [];
          if (guestItems.length > 0) {
            useCartStore.getState().migrateGuestCartToServer().catch(() => {});
          }
          toast.success("Welcome to Buybox!");
          router.push(redirectPath);
        }}
        onError={(msg) => setErrorMessage(msg)}
        isParentSubmitting={isLoading}
      />

      {/* Footer Link */}
      <div className="mt-8 text-center text-xs text-slate-600 border-t pt-6">
        Already have an account?{" "}
        <Link
          href={`/auth/login${redirectPath !== "/account" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
          className="font-bold text-[#007A55] hover:underline"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default RegisterForm;
