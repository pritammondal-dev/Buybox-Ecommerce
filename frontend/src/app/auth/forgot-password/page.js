"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Mail, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { authService } from "../../../services/auth.service.js";
import { Button } from "../../../components/ui/Button.jsx";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await authService.requestPasswordReset({ email: email.trim() });
      setIsSent(true);
      toast.success("Password reset instructions dispatched.");
    } catch (err) {
      setErrorMessage(err?.message || "Could not process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50/50">
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
            Reset Password
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter your email and we will send you instructions to reset your password.
          </p>
        </div>

        {isSent ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-[#007A55]">
              <CheckCircle2 className="size-8 stroke-[2]" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an account exists with <strong className="text-slate-900">{email}</strong>, you will receive password reset instructions.
            </p>
            <div className="pt-2">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007A55] hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                {errorMessage}
              </div>
            )}

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

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[#007A55] hover:bg-[#006346] text-white font-bold text-xs py-3.5 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
              <ArrowRight className="size-3.5" />
            </Button>

            <div className="pt-4 text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="size-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
