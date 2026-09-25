"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  ShieldCheck,
  Lock,
  Store,
  Bell,
  Mail,
  Phone,
  KeyRound,
  LogOut,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { authService } from "@/services/auth.service";
import { vendorService } from "@/services/vendor.service";

export default function VendorSettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [vendorProfile, setVendorProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;
    vendorService
      .getMyProfile()
      .then((res) => {
        if (!isMounted) return;
        const profile = res?.data?.data?.vendor || res?.data?.vendor || res?.data;
        setVendorProfile(profile);
      })
      .catch(() => {
        if (isMounted) setVendorProfile(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess("Password updated successfully. Other active sessions have been revoked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Merchant password updated successfully");
    } catch (err) {
      setPasswordError(
        err?.response?.data?.message || err?.message || "Failed to update password. Verify current password."
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm("Are you sure you want to log out from all active sessions and devices?")) return;

    try {
      await authService.logoutAll();
      toast.success("Logged out from all sessions");
      await logout();
      router.push("/vendor/login");
    } catch (err) {
      toast.error("Failed to revoke all sessions", {
        description: err.response?.data?.message || err.message,
      });
    }
  };

  const onboardingStatus = vendorProfile?.onboardingStatus || "pending";
  const isApproved = onboardingStatus === "approved" && vendorProfile?.isActive;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Account & Security Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your seller credentials, security parameters, and merchant profile overview.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Profile Overview */}
        <div className="lg:col-span-1 space-y-6">
          {/* Identity Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-2xl bg-emerald-100 text-[#004D38] flex items-center justify-center font-bold text-base">
                {user?.firstName?.[0]?.toUpperCase() || "M"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 truncate">
                  {user?.firstName} {user?.lastName}
                </h3>
                <span className="text-xs text-slate-500 truncate block">
                  {user?.email}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="font-semibold capitalize text-slate-800">
                  {user?.role || "Vendor"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email Verification:</span>
                {user?.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    <CheckCircle2 className="size-3" /> Verified
                  </span>
                ) : (
                  <Link
                    href={`/vendor/verify-email?email=${encodeURIComponent(user?.email || "")}`}
                    className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full text-[10px] transition-colors"
                  >
                    <Clock className="size-3" /> Verify Now
                  </Link>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Onboarding Status:</span>
                {isApproved ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    <ShieldCheck className="size-3" /> Approved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] capitalize">
                    <Clock className="size-3" /> {onboardingStatus}
                  </span>
                )}
              </div>

              {vendorProfile?.businessName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Business Store:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                    {vendorProfile.businessName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Hub Links */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Related Settings
            </div>

            <Link
              href="/vendor/store"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Store className="size-4 text-slate-400" />
                <span>Store Identity & Tax</span>
              </div>
              <ArrowRight className="size-3.5 text-slate-400" />
            </Link>

            <Link
              href="/vendor/notifications"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Bell className="size-4 text-slate-400" />
                <span>Notification Stream</span>
              </div>
              <ArrowRight className="size-3.5 text-slate-400" />
            </Link>

            <button
              onClick={handleLogoutAll}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-rose-50 text-xs font-semibold text-rose-600 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="size-4 text-rose-500" />
                <span>Revoke All Devices</span>
              </div>
              <LogOut className="size-3.5 text-rose-400" />
            </button>
          </div>
        </div>

        {/* Right Column: Security & Password Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-emerald-50 text-[#007A55] flex items-center justify-center">
                <KeyRound className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Change Console Password
                </h3>
                <p className="text-xs text-slate-500">
                  Verify your current password and choose a secure new password.
                </p>
              </div>
            </div>

            {passwordError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2"
              >
                <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 flex items-start gap-2"
              >
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#007A55] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="settings-new-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      id="settings-new-password"
                      type={showNew ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#007A55] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="settings-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                      id="settings-confirm-password"
                      type={showNew ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#007A55] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !currentPassword || newPassword.length < 8}
                  className="px-5 py-2.5 rounded-xl bg-[#004D38] hover:bg-[#003828] disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="size-3.5" />
                      Save New Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Session Security Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-xs text-slate-900">
                Active Session Invalidation
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Revoke all active refresh sessions across all browsers and devices immediately.
              </p>
            </div>
            <button
              onClick={handleLogoutAll}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs transition-colors shrink-0"
            >
              Sign Out All Devices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
