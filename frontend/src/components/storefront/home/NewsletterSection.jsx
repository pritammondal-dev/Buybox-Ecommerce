"use client";

import React, { useState } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubscribed(true);
    toast.success("Subscribed successfully!", {
      description: "You will receive exclusive deals and offers from Buybox.",
    });
    setEmail("");
  };

  return (
    <section aria-label="Newsletter Subscription" className="py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-[#004D38] p-6 sm:p-8 text-white shadow-sm border border-emerald-800/40">
          {/* Subtle Ambient Background */}
          <div className="absolute -right-16 -top-16 size-60 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Left Content */}
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 border border-white/10">
                <Mail className="size-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Get the Latest Deals &amp; Offers
                </h3>
                <p className="text-xs text-emerald-100/80 mt-0.5">
                  Subscribe to our newsletter and never miss a deal.
                </p>
              </div>
            </div>

            {/* Right Form */}
            <div className="w-full lg:w-auto flex-1 max-w-md">
              {isSubscribed ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2.5 text-xs font-bold text-emerald-200 border border-emerald-400/30">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>Thank you for subscribing! Deals will arrive in your inbox.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="flex items-center rounded-full bg-white p-1 shadow-md"
                >
                  <input
                    type="email"
                    suppressHydrationWarning
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address..."
                    required
                    className="flex-1 rounded-full bg-transparent px-4 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                  <button
                    type="submit"
                    suppressHydrationWarning
                    className="flex items-center gap-1.5 rounded-full bg-[#007A55] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    <span>Subscribe</span>
                    <Send className="size-3" />
                  </button>
                </form>
              )}
            </div>

            {/* Paper Airplane Decorative Icon */}
            <div className="hidden xl:flex items-center text-emerald-400/30 pr-2 pointer-events-none">
              <Send className="size-8 rotate-12" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default NewsletterSection;
