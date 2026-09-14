"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "../../services/auth.service.js";
import { Button } from "../ui/Button.jsx";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/account";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

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
        description: "Please check your email for the verification link.",
      });
    } catch (err) {
      setErrorMessage(
        err?.message || "Registration failed. An account with this email may already exist."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-card space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-[#007A55] mb-2">
          <CheckCircle2 className="size-10 stroke-[2]" />
        </div>
        <h2 className="text-xl font-black text-slate-950">Registration Complete!</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          We have created your account. We sent a verification link to{" "}
          <strong className="text-slate-900">{email}</strong>.
        </p>
        <div className="pt-4">
          <Link
            href={`/auth/login${redirectPath !== "/account" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all"
          >
            Sign In to Your Account
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
      {/* Header */}
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
          Create an Account
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Join Buybox for faster checkouts, order tracking, and exclusive discounts
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
          {isLoading ? "Creating Account..." : "Create Account"}
          <ArrowRight className="size-3.5" />
        </Button>
      </form>

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
