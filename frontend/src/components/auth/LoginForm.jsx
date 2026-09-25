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
  Smartphone,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  KeyRound,
  RotateCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/auth.store.js";
import { useCartStore } from "../../stores/cart.store.js";
import { authService } from "../../services/auth.service.js";
import { maskEmail, maskPhone } from "../../utils/dev-otp.util.js";
import { Button } from "../ui/Button.jsx";
import { GoogleSignInButton } from "./GoogleSignInButton.jsx";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/account";

  const loginWithPassword = useAuthStore((state) => state.login);
  const loginWithEmailOtp = useAuthStore((state) => state.loginWithEmailOtp);
  const loginWithPhoneOtp = useAuthStore((state) => state.loginWithPhoneOtp);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const isLoading = useAuthStore((state) => state.isLoading);

  // Flow steps: "identifier" | "email_choice" | "email_password" | "email_otp" | "phone_otp"
  const [step, setStep] = useState("identifier");

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState("email"); // "email" | "phone"
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState("");

  // Superadmin-managed Customer Login Methods
  const [loginMethods, setLoginMethods] = useState({
    emailPassword: true,
    emailOtp: true,
    mobileOtp: true,
    google: true,
  });

  const inputRefs = useRef([]);

  // Fetch available effective login methods from backend
  useEffect(() => {
    let isMounted = true;
    authService
      .getLoginMethods()
      .then((data) => {
        if (isMounted && data) {
          setLoginMethods({
            emailPassword: Boolean(data.emailPassword),
            emailOtp: Boolean(data.emailOtp),
            mobileOtp: Boolean(data.mobileOtp),
            google: Boolean(data.google),
          });
        }
      })
      .catch(() => {
        // Fallback to defaults gracefully
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus the first OTP slot when entering OTP step
  useEffect(() => {
    if (step === "email_otp" || step === "phone_otp") {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Migrate cart and complete navigation
  const onSuccessfulAuth = () => {
    const guestItems = useCartStore.getState().guestCart?.items || [];
    if (guestItems.length > 0) {
      useCartStore.getState().migrateGuestCartToServer().catch(() => {});
    }

    toast.success("Welcome back!", {
      description: "Signed in successfully to your Buybox account.",
    });

    router.push(redirectPath);
  };

  /**
   * Handle primary Step 1: Identifier Submission
   */
  const handleIdentifierSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessInfo("");

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage(
        loginMethods.mobileOtp
          ? "Please enter your email address or mobile number."
          : "Please enter your email address."
      );
      return;
    }

    if (cleanInput.includes("@")) {
      // Email flow
      if (!loginMethods.emailPassword && !loginMethods.emailOtp) {
        setErrorMessage("Email sign-in is currently unavailable.");
        return;
      }

      setIdentifierType("email");

      if (loginMethods.emailPassword && loginMethods.emailOtp) {
        setStep("email_choice");
      } else if (loginMethods.emailPassword) {
        setStep("email_password");
      } else {
        // Only Email OTP is enabled
        setStep("email_otp");
        handleRequestEmailOtp();
      }
    } else {
      // Phone flow
      if (!loginMethods.mobileOtp) {
        setErrorMessage(
          "Mobile OTP login is currently disabled by administrator policy. Please sign in with your email address."
        );
        return;
      }
      setIdentifierType("phone");
      setStep("phone_otp");
      // Prompt user to send phone OTP
    }
  };

  /**
   * Method 1: Email + Password Login
   */
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!password) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPassword({
        email: identifier.trim().toLowerCase(),
        password,
      });
      onSuccessfulAuth();
    } catch (err) {
      setErrorMessage(err?.message || "Invalid email or password. Please verify and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Method 2: Request Email OTP
   */
  const handleRequestEmailOtp = async () => {
    setErrorMessage("");
    setIsRequestingOtp(true);

    try {
      const res = await authService.requestEmailLoginOtp({
        email: identifier.trim().toLowerCase(),
      });

      setCooldown(res?.data?.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS);
      setSuccessInfo("A 6-digit verification code has been dispatched to your email.");
      setStep("email_otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Could not deliver verification code. Please check your email or try password sign-in."
      );
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * Method 2: Verify Email OTP
   */
  const handleVerifyEmailOtp = async (e) => {
    e?.preventDefault();
    setErrorMessage("");

    const otp = otpDigits.join("").trim();
    if (otp.length !== OTP_LENGTH) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithEmailOtp({
        email: identifier.trim().toLowerCase(),
        otp,
      });
      onSuccessfulAuth();
    } catch (err) {
      setErrorMessage(err?.message || "Verification code is invalid or has expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Method 3: Request Phone OTP
   */
  const handleRequestPhoneOtp = async () => {
    setErrorMessage("");
    setIsRequestingOtp(true);

    try {
      const res = await authService.requestPhoneLoginOtp({
        phone: identifier.trim(),
      });

      setCooldown(res?.data?.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS);
      setSuccessInfo("A 6-digit verification code has been sent via SMS.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;

      if (status === 503 || code === "SMS_PROVIDER_NOT_CONFIGURED") {
        setErrorMessage(
          "SMS delivery is not configured on this server. Please use Email Sign-In or contact administrator."
        );
      } else {
        setErrorMessage(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to send mobile verification code. Please verify your phone number."
        );
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * Method 3: Verify Phone OTP
   */
  const handleVerifyPhoneOtp = async (e) => {
    e?.preventDefault();
    setErrorMessage("");

    const otp = otpDigits.join("").trim();
    if (otp.length !== OTP_LENGTH) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginWithPhoneOtp({
        phone: identifier.trim(),
        otp,
      });
      onSuccessfulAuth();
    } catch (err) {
      setErrorMessage(err?.message || "Verification code is invalid or has expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Slot Input Handler
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

    // Auto-advance
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

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card transition-all">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2 group mb-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
            <ShoppingBag className="size-5 stroke-[2.2]" />
          </div>
          <span className="text-2xl font-black text-[#007A55] tracking-tight">Buybox</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
          Welcome to Buybox
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {step === "identifier" && "Sign in with your email or mobile number to continue"}
          {step === "email_choice" && `Choose your preferred login method for ${maskEmail(identifier)}`}
          {step === "email_password" && `Enter your password for ${maskEmail(identifier)}`}
          {step === "email_otp" && `Enter the 6-digit code sent to ${maskEmail(identifier)}`}
          {step === "phone_otp" && `Enter the 6-digit code sent to ${maskPhone(identifier)}`}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success / Status Message */}
      {successInfo && !errorMessage && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successInfo}</span>
        </div>
      )}

      {/* ====================================================================
          STEP 1: PRIMARY IDENTIFIER INPUT (Email or Mobile Number)
          ==================================================================== */}
      {step === "identifier" && (
        <div className="space-y-4">
          <form onSubmit={handleIdentifierSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {loginMethods.mobileOtp ? "Email or Mobile Number" : "Email Address"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    loginMethods.mobileOtp
                      ? "name@example.com or +919876543210"
                      : "name@example.com"
                  }
                  className="w-full rounded-xl border bg-slate-50/40 px-3.5 py-3 pl-10 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
                  required
                  autoFocus
                />
                <Mail className="size-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              Continue
              <ArrowRight className="size-3.5" />
            </Button>
          </form>

          {/* Google Sign-In Option (shown only when effectiveEnabled is true) */}
          {loginMethods.google && (
            <>
              {/* Social Divider */}
              <div className="relative my-6 text-center text-xs">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  Or
                </span>
              </div>

              {/* Google Sign-In Button */}
              <GoogleSignInButton
                textType="continue_with"
                onSuccess={onSuccessfulAuth}
                onError={setErrorMessage}
                isParentSubmitting={isLoading || isSubmitting}
              />
            </>
          )}
        </div>
      )}

      {/* ====================================================================
          STEP 2: EMAIL METHOD CHOICE (Password vs Email OTP)
          ==================================================================== */}
      {step === "email_choice" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[240px]">
              {identifier}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("identifier");
                setErrorMessage("");
              }}
              className="text-[#007A55] font-bold hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {/* Option A: Password (if effectiveEnabled) */}
            {loginMethods.emailPassword && (
              <button
                type="button"
                onClick={() => {
                  setStep("email_password");
                  setErrorMessage("");
                }}
                className="w-full text-left rounded-2xl border border-slate-200 p-4 hover:border-[#007A55] hover:bg-emerald-50/30 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-[#007A55]/10 text-slate-700 group-hover:text-[#007A55]">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">Sign in with Password</div>
                    <div className="text-[11px] text-slate-500">Enter your existing account password</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-400 group-hover:text-[#007A55]" />
              </button>
            )}

            {/* Option B: Email OTP (if effectiveEnabled) */}
            {loginMethods.emailOtp && (
              <button
                type="button"
                onClick={handleRequestEmailOtp}
                disabled={isRequestingOtp}
                className="w-full text-left rounded-2xl border border-slate-200 p-4 hover:border-[#007A55] hover:bg-emerald-50/30 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 group-hover:bg-[#007A55]/10 text-slate-700 group-hover:text-[#007A55]">
                    {isRequestingOtp ? (
                      <Loader2 className="size-4 animate-spin text-[#007A55]" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">Sign in with Email OTP</div>
                    <div className="text-[11px] text-slate-500">Passwordless 6-digit code via email</div>
                  </div>
                </div>
                <ArrowRight className="size-4 text-slate-400 group-hover:text-[#007A55]" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep("identifier");
              setErrorMessage("");
            }}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-900 flex items-center justify-center gap-1.5 pt-2 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
        </div>
      )}

      {/* ====================================================================
          STEP 3: EMAIL + PASSWORD FORM
          ==================================================================== */}
      {step === "email_password" && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[240px]">
              {identifier}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("email_choice");
                setErrorMessage("");
              }}
              className="text-[#007A55] font-bold hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-[11px] font-bold text-[#007A55] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border bg-slate-50/40 px-3.5 py-2.5 pl-10 pr-10 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
                required
                autoFocus
              />
              <Lock className="size-4 text-slate-400 absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isSubmitting}
            className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Signing In...
              </>
            ) : (
              <>
                Sign In <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setStep("email_choice");
                setErrorMessage("");
              }}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="size-3" /> All Sign-In Options
            </button>
            <button
              type="button"
              onClick={handleRequestEmailOtp}
              disabled={isRequestingOtp}
              className="text-xs font-bold text-[#007A55] hover:underline cursor-pointer"
            >
              Sign in with OTP instead
            </button>
          </div>
        </form>
      )}

      {/* ====================================================================
          STEP 4: EMAIL OTP INPUT
          ==================================================================== */}
      {step === "email_otp" && (
        <form onSubmit={handleVerifyEmailOtp} className="space-y-5 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[240px]">
              {identifier}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("email_choice");
                setErrorMessage("");
              }}
              className="text-[#007A55] font-bold hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* 6-Slot OTP Display */}
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
            disabled={isSubmitting || isLoading || otpDigits.join("").length !== OTP_LENGTH}
            className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Verifying...
              </>
            ) : (
              <>
                Verify & Sign In <ArrowRight className="size-3.5" />
              </>
            )}
          </Button>

          {/* Resend Countdown */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("email_choice");
                setErrorMessage("");
              }}
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="size-3" /> Back
            </button>

            <button
              type="button"
              onClick={handleRequestEmailOtp}
              disabled={cooldown > 0 || isRequestingOtp}
              className="font-bold text-[#007A55] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
            >
              {cooldown > 0 ? (
                `Resend code in ${cooldown}s`
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

      {/* ====================================================================
          STEP 5: MOBILE NUMBER + OTP
          ==================================================================== */}
      {step === "phone_otp" && (
        <form onSubmit={handleVerifyPhoneOtp} className="space-y-5 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[240px] flex items-center gap-2">
              <Smartphone className="size-3.5 text-slate-400" />
              {identifier}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("identifier");
                setErrorMessage("");
                setSuccessInfo("");
              }}
              className="text-[#007A55] font-bold hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Send Code button if no code requested yet */}
          {cooldown === 0 && !successInfo ? (
            <div className="py-2 text-center space-y-3">
              <p className="text-xs text-slate-500">
                Click below to receive a secure 6-digit verification code via SMS.
              </p>
              <Button
                type="button"
                onClick={handleRequestPhoneOtp}
                disabled={isRequestingOtp}
                className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isRequestingOtp ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Sending Code...
                  </>
                ) : (
                  <>
                    Send Verification Code <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* 6-Slot OTP Display */}
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
                disabled={isSubmitting || isLoading || otpDigits.join("").length !== OTP_LENGTH}
                className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    Verify & Sign In <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>

              {/* Resend Countdown */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("identifier");
                    setErrorMessage("");
                  }}
                  className="text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="size-3" /> Back
                </button>

                <button
                  type="button"
                  onClick={handleRequestPhoneOtp}
                  disabled={cooldown > 0 || isRequestingOtp}
                  className="font-bold text-[#007A55] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer flex items-center gap-1"
                >
                  {cooldown > 0 ? (
                    `Resend code in ${cooldown}s`
                  ) : isRequestingOtp ? (
                    <>
                      <RotateCw className="size-3 animate-spin" /> Sending...
                    </>
                  ) : (
                    "Resend code"
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Footer Link */}
      <div className="mt-8 text-center text-xs text-slate-600 border-t pt-6">
        New to Buybox?{" "}
        <Link
          href={`/auth/register${redirectPath !== "/account" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
          className="font-bold text-[#007A55] hover:underline"
        >
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default LoginForm;
