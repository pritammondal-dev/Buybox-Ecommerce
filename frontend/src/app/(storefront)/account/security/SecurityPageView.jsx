"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Smartphone,
  Mail,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  RotateCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../../hooks/useAuth.js";
import { authService } from "../../../../services/auth.service.js";
import { AccountNav } from "../../../../components/storefront/account/AccountNav.jsx";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export function SecurityPageView() {
  const { user, setUser, logout } = useAuth();

  // --- Change Password State ---
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Forgot password fallback
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // --- Change Email State ---
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailStep, setEmailStep] = useState("input"); // 'input' | 'otp'
  const [newEmail, setNewEmail] = useState("");
  const [emailOtpDigits, setEmailOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [isRequestingEmailOtp, setIsRequestingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const emailInputRefs = useRef([]);

  // --- Change Phone State ---
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState("input"); // 'input' | 'otp'
  const [newPhone, setNewPhone] = useState("");
  const [phoneOtpDigits, setPhoneOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [isRequestingPhoneOtp, setIsRequestingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const phoneInputRefs = useRef([]);

  // --- Active Sessions State ---
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  // Email Cooldown Timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Phone Cooldown Timer
  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  // Focus OTP first slot on step change
  useEffect(() => {
    if (emailStep === "otp" && emailInputRefs.current[0]) {
      emailInputRefs.current[0].focus();
    }
  }, [emailStep]);

  useEffect(() => {
    if (phoneStep === "otp" && phoneInputRefs.current[0]) {
      phoneInputRefs.current[0].focus();
    }
  }, [phoneStep]);

  // =========================================================================
  // 1. Password Management Handlers
  // =========================================================================
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      toast.success("Password updated successfully!", {
        description: "All other device sessions have been securely invalidated.",
      });

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      toast.error(err?.message || "Failed to change password. Please check your credentials.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.email) {
      toast.error("User email address not found.");
      return;
    }

    setIsSendingReset(true);
    try {
      await authService.requestPasswordReset({ email: user.email });
      setResetSent(true);
      toast.success("Password reset link sent to your registered email!");
    } catch (err) {
      toast.error(err?.message || "Failed to send reset link.");
    } finally {
      setIsSendingReset(false);
    }
  };

  // =========================================================================
  // 2. Email Management Handlers
  // =========================================================================
  const handleRequestEmailChange = async (e) => {
    e?.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (cleanEmail === user?.email?.toLowerCase()) {
      toast.error("New email must be different from your current email.");
      return;
    }

    setIsRequestingEmailOtp(true);
    try {
      await authService.requestChangeEmail({ newEmail: cleanEmail });
      setEmailStep("otp");
      setEmailCooldown(RESEND_COOLDOWN_SECONDS);
      setEmailOtpDigits(Array(OTP_LENGTH).fill(""));
      toast.success("Verification code sent!", {
        description: `We've sent a 6-digit code to ${cleanEmail}.`,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to send verification code to new email.");
    } finally {
      setIsRequestingEmailOtp(false);
    }
  };

  const handleVerifyEmailChange = async (e) => {
    e.preventDefault();
    const otp = emailOtpDigits.join("");
    if (otp.length !== OTP_LENGTH) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingEmailOtp(true);
    try {
      const res = await authService.verifyChangeEmail({
        newEmail: newEmail.trim().toLowerCase(),
        otp,
      });

      const updatedEmail = res?.data?.email || newEmail.trim().toLowerCase();
      if (user) {
        setUser({ ...user, email: updatedEmail, isEmailVerified: true });
      }

      toast.success("Email updated successfully!", {
        description: "Your primary account email has been updated and verified.",
      });

      setShowEmailForm(false);
      setEmailStep("input");
      setNewEmail("");
      setEmailOtpDigits(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      toast.error(err?.message || "Invalid or expired verification code.");
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  const handleEmailDigitChange = (idx, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...emailOtpDigits];
    newDigits[idx] = value.slice(-1);
    setEmailOtpDigits(newDigits);
    if (value && idx < OTP_LENGTH - 1) {
      emailInputRefs.current[idx + 1]?.focus();
    }
  };

  const handleEmailKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !emailOtpDigits[idx] && idx > 0) {
      emailInputRefs.current[idx - 1]?.focus();
    }
  };

  const handleEmailPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...emailOtpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setEmailOtpDigits(newDigits);
    const targetIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    emailInputRefs.current[targetIdx]?.focus();
  };

  // =========================================================================
  // 3. Mobile Phone Management Handlers
  // =========================================================================
  const handleRequestPhoneChange = async (e) => {
    e?.preventDefault();
    const cleanPhone = newPhone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      toast.error("Please enter a valid mobile number (e.g. +919876543210).");
      return;
    }

    setIsRequestingPhoneOtp(true);
    try {
      await authService.requestChangePhone({ newPhone: cleanPhone });
      setPhoneStep("otp");
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
      setPhoneOtpDigits(Array(OTP_LENGTH).fill(""));
      toast.success("Verification code dispatched!", {
        description: `We've sent a 6-digit code to ${cleanPhone}.`,
      });
    } catch (err) {
      if (err?.code === "SMS_PROVIDER_NOT_CONFIGURED" || err?.message?.includes("SMS")) {
        toast.error("SMS service unavailable", {
          description: "SMS delivery integration is not configured on this server. Contact administrator.",
        });
      } else {
        toast.error(err?.message || "Failed to send mobile verification code.");
      }
    } finally {
      setIsRequestingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneChange = async (e) => {
    e.preventDefault();
    const otp = phoneOtpDigits.join("");
    if (otp.length !== OTP_LENGTH) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingPhoneOtp(true);
    try {
      const res = await authService.verifyChangePhone({
        newPhone: newPhone.trim(),
        otp,
      });

      const updatedPhone = res?.data?.phone || newPhone.trim();
      if (user) {
        setUser({ ...user, phone: updatedPhone, isPhoneVerified: true });
      }

      toast.success("Mobile number updated successfully!", {
        description: "Your verified phone number has been updated.",
      });

      setShowPhoneForm(false);
      setPhoneStep("input");
      setNewPhone("");
      setPhoneOtpDigits(Array(OTP_LENGTH).fill(""));
    } catch (err) {
      toast.error(err?.message || "Invalid or expired verification code.");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handlePhoneDigitChange = (idx, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...phoneOtpDigits];
    newDigits[idx] = value.slice(-1);
    setPhoneOtpDigits(newDigits);
    if (value && idx < OTP_LENGTH - 1) {
      phoneInputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePhoneKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !phoneOtpDigits[idx] && idx > 0) {
      phoneInputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePhonePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...phoneOtpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setPhoneOtpDigits(newDigits);
    const targetIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    phoneInputRefs.current[targetIdx]?.focus();
  };

  // =========================================================================
  // 4. Session Governance Handlers
  // =========================================================================
  const handleLogoutAllSessions = async () => {
    setIsLoggingOutAll(true);
    try {
      const res = await authService.logoutAll();
      const count = res?.data?.revokedCount ?? "all other";
      toast.success(`Signed out of ${count} other active device sessions.`);
    } catch (err) {
      toast.error(err?.message || "Could not revoke other device sessions.");
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-4">
            <AccountNav />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900">Security & Credentials</h1>
              <p className="text-xs text-slate-500">
                Manage your login methods, primary email, mobile phone, and active sessions.
              </p>
            </div>

            {/* =================================================================
                1. Password Management
                ================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#007A55]" /> Password Security
                  </h2>
                  <p className="text-xs text-slate-500">
                    Your password protects your orders, delivery addresses, and payment profiles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="text-xs font-bold text-[#007A55] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPasswordForm ? (
                    <>
                      Cancel <ChevronUp className="size-3.5" />
                    </>
                  ) : (
                    <>
                      Change Password <ChevronDown className="size-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Collapsible Authenticated Change Password Form */}
              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="space-y-4 pt-1 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPass ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showCurrentPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Forgot password fallback link */}
              {resetSent ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#007A55] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Password Reset Email Dispatched</p>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      We sent a secure password reset link to <span className="font-mono font-bold">{user?.email}</span>. Click the link in your email to set a new password.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="text-xs text-slate-600">
                    <span>Forgotten your current password? </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestPasswordReset}
                    disabled={isSendingReset}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#007A55] hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingReset ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Sending email...
                      </>
                    ) : (
                      "Send password reset link"
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* =================================================================
                2. Email Address Management (Change Email)
                ================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#007A55]" /> Email Address
                  </h2>
                  <p className="text-xs text-slate-500">
                    Your primary email is used for receipts, order alerts, and passwordless OTP login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(!showEmailForm);
                    setEmailStep("input");
                    setNewEmail("");
                  }}
                  className="text-xs font-bold text-[#007A55] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showEmailForm ? (
                    <>
                      Cancel <ChevronUp className="size-3.5" />
                    </>
                  ) : (
                    <>
                      Change Email <ChevronDown className="size-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Current Email Display */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">{user?.email || "No email registered"}</span>
                  {user?.isEmailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Unverified
                    </span>
                  )}
                </div>
              </div>

              {/* Collapsible Change Email Form */}
              {showEmailForm && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
                  {emailStep === "input" ? (
                    <form onSubmit={handleRequestEmailChange} className="space-y-3 max-w-md">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          New Email Address
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="new.email@example.com"
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#007A55] transition-colors"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isRequestingEmailOtp}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isRequestingEmailOtp ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Sending verification code...
                          </>
                        ) : (
                          "Send Verification Code"
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyEmailChange} className="space-y-4 max-w-md">
                      <p className="text-xs text-slate-600">
                        Enter the 6-digit verification code sent to <span className="font-bold">{newEmail}</span>:
                      </p>
                      <div className="flex gap-2">
                        {emailOtpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => (emailInputRefs.current[idx] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleEmailDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handleEmailKeyDown(idx, e)}
                            onPaste={idx === 0 ? handleEmailPaste : undefined}
                            className="size-10 rounded-xl border border-slate-200 bg-white text-center text-base font-bold text-slate-900 outline-none focus:border-[#007A55] focus:ring-2 focus:ring-[#007A55]/20"
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={isVerifyingEmailOtp || emailOtpDigits.join("").length !== OTP_LENGTH}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isVerifyingEmailOtp ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" /> Verifying...
                            </>
                          ) : (
                            "Confirm Email Change"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestEmailChange}
                          disabled={emailCooldown > 0 || isRequestingEmailOtp}
                          className="text-xs font-bold text-[#007A55] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {emailCooldown > 0 ? `Resend code in ${emailCooldown}s` : "Resend code"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* =================================================================
                3. Mobile Phone Management (Change Mobile)
                ================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#007A55]" /> Mobile Phone Number
                  </h2>
                  <p className="text-xs text-slate-500">
                    Linked mobile phone for SMS OTP verification, login, and delivery delivery tracking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPhoneForm(!showPhoneForm);
                    setPhoneStep("input");
                    setNewPhone("");
                  }}
                  className="text-xs font-bold text-[#007A55] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {showPhoneForm ? (
                    <>
                      Cancel <ChevronUp className="size-3.5" />
                    </>
                  ) : (
                    <>
                      Change Mobile <ChevronDown className="size-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Current Phone Display */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900">
                    {user?.phone || "No mobile number linked"}
                  </span>
                  {user?.phone && user?.isPhoneVerified ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3" /> Verified
                    </span>
                  ) : user?.phone ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Unverified
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Collapsible Change Phone Form */}
              {showPhoneForm && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-4">
                  {phoneStep === "input" ? (
                    <form onSubmit={handleRequestPhoneChange} className="space-y-3 max-w-md">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          New Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="+919876543210"
                          required
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#007A55] transition-colors"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Enter country code followed by your mobile number (E.164 standard).
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={isRequestingPhoneOtp}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isRequestingPhoneOtp ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Sending verification code...
                          </>
                        ) : (
                          "Send Verification Code"
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyPhoneChange} className="space-y-4 max-w-md">
                      <p className="text-xs text-slate-600">
                        Enter the 6-digit verification code sent to <span className="font-bold">{newPhone}</span>:
                      </p>
                      <div className="flex gap-2">
                        {phoneOtpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => (phoneInputRefs.current[idx] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handlePhoneDigitChange(idx, e.target.value)}
                            onKeyDown={(e) => handlePhoneKeyDown(idx, e)}
                            onPaste={idx === 0 ? handlePhonePaste : undefined}
                            className="size-10 rounded-xl border border-slate-200 bg-white text-center text-base font-bold text-slate-900 outline-none focus:border-[#007A55] focus:ring-2 focus:ring-[#007A55]/20"
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={isVerifyingPhoneOtp || phoneOtpDigits.join("").length !== OTP_LENGTH}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007A55] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isVerifyingPhoneOtp ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" /> Verifying...
                            </>
                          ) : (
                            "Confirm Phone Change"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleRequestPhoneChange}
                          disabled={phoneCooldown > 0 || isRequestingPhoneOtp}
                          className="text-xs font-bold text-[#007A55] hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {phoneCooldown > 0 ? `Resend code in ${phoneCooldown}s` : "Resend code"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* =================================================================
                4. Active Sessions & Device Security
                ================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="space-y-1 border-b border-slate-100 pb-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[#007A55]" /> Active Sessions & Device Control
                </h2>
                <p className="text-xs text-slate-500">
                  You are currently signed in on this device. You can revoke all other active refresh sessions at any time.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#007A55]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Current Browser Session</p>
                    <p className="text-[11px] text-emerald-700 font-semibold">Active & Authenticated (Customer Context)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogoutAllSessions}
                  disabled={isLoggingOutAll}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingOutAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Revoking...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-3.5 w-3.5" /> Sign Out of All Other Devices
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* =================================================================
                5. Security Best Practices Notice
                ================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 text-xs text-slate-600 space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#007A55]" /> Buybox Account Protection & Governance
              </h3>
              <ul className="space-y-1.5 text-[11px] text-slate-500 list-disc list-inside">
                <li>Never share your Buybox account password or 6-digit OTP code with anyone.</li>
                <li>Buybox support will never contact you asking for your credentials or security codes.</li>
                <li>Sensitive operations (password, email, or mobile change) automatically revoke other device sessions.</li>
                <li>Ensure both your email and mobile phone are verified to keep your account safe.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
