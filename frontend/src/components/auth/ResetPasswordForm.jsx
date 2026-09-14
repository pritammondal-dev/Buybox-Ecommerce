"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "../../services/auth.service.js";
import { Button } from "../ui/Button.jsx";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!token) {
      setErrorMessage("Missing or invalid password reset token.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword({ token, password });
      setIsSuccess(true);
      toast.success("Password reset successfully!");
    } catch (err) {
      setErrorMessage(err?.message || "Password reset failed. The token may be expired.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
          <CheckCircle2 className="size-10 stroke-[2]" />
        </div>
        <h2 className="text-xl font-black text-slate-950">Password Updated!</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your account password has been updated. You can now log in with your new credentials.
        </p>
        <div className="pt-4">
          <Link
            href="/auth/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#007A55] text-white font-bold text-xs py-3.5 hover:bg-[#006346]"
          >
            Sign In Now
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 group mb-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs group-hover:scale-105 transition-transform">
            <ShoppingBag className="size-5 stroke-[2.2]" />
          </div>
          <span className="text-2xl font-black text-[#007A55] tracking-tight">
            Buybox
          </span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
          Create New Password
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose a secure new password for your Buybox account
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            New Password (min 8 chars)
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border bg-slate-50/40 px-3.5 py-2.5 pl-10 pr-10 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white"
              required
            />
            <Lock className="size-4 text-slate-400 absolute left-3.5 top-3" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border bg-slate-50/40 px-3.5 py-2.5 pl-10 outline-none focus:border-[#007A55] focus:bg-white"
              required
            />
            <Lock className="size-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
        >
          {isLoading ? "Updating Password..." : "Update Password"}
          <ArrowRight className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default ResetPasswordForm;
