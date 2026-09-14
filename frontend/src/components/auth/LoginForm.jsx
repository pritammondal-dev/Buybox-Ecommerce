"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../stores/auth.store.js";
import { useCartStore } from "../../stores/cart.store.js";
import { Button } from "../ui/Button.jsx";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/account";

  const loginStore = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    try {
      await loginStore({ email: email.trim(), password });

      // Migrate any guest cart items sequentially
      const guestItems = useCartStore.getState().guestCart?.items || [];
      if (guestItems.length > 0) {
        useCartStore.getState().migrateGuestCartToServer().catch(() => {});
      }

      toast.success("Welcome back!", {
        description: "Logged in successfully.",
      });

      router.push(redirectPath);
    } catch (err) {
      setErrorMessage(err?.message || "Invalid credentials. Please verify and try again.");
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
      {/* Brand Header */}
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
          Welcome Back
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your registered email and password to access your account
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full rounded-xl border bg-slate-50/40 px-3.5 py-2.5 pl-10 text-xs text-slate-900 outline-none focus:border-[#007A55] focus:bg-white transition-colors"
              required
            />
            <Mail className="size-4 text-slate-400 absolute left-3.5 top-3" />
          </div>
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
          disabled={isLoading}
          className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
        >
          {isLoading ? "Signing In..." : "Sign In"}
          <ArrowRight className="size-3.5" />
        </Button>
      </form>

      <div className="mt-8 text-center text-xs text-slate-600 border-t pt-6">
        Don&apos;t have an account yet?{" "}
        <Link
          href={`/auth/register${redirectPath !== "/account" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
          className="font-bold text-[#007A55] hover:underline"
        >
          Create one now
        </Link>
      </div>
    </div>
  );
}

export default LoginForm;
