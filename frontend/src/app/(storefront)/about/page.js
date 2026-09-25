import React from "react";
import Link from "next/link";
import { Headphones, ShieldCheck, Truck, Award, ArrowLeft, ShoppingBag, ArrowRight } from "lucide-react";

export const metadata = {
  title: "About Us | Buybox",
  description: "Discover Buybox — India's premier certified marketplace for audiophiles, high-fidelity sound, and professional studio gear.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004D38] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Homepage
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] to-[#002B1F] p-8 sm:p-14 text-white shadow-xl">
          <div className="relative z-10 space-y-4 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Headphones className="h-4 w-4" /> The Buybox Story
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Curated High-Fidelity Sound for Discerning Listeners
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              Founded by passionate sound engineers and audio enthusiasts, Buybox was built to bridge the gap between premium global audio manufacturers and music creators across India.
            </p>
          </div>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">100% Genuine Brands</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Direct authorized partnerships with official warranty coverage and verified serial authentication.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <Truck className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Protected Transit</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anti-static, shock-absorbent reinforced packaging to ensure delicate drivers and tubes arrive in pristine condition.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Expert Synergy Support</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Guidance from certified audio specialists to match amplifiers, DACs, and headphones tailored to your sonic preference.
            </p>
          </div>
        </div>

        {/* Story details */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-6 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-xl font-black text-slate-900">Why Buybox Exists</h2>
          <p>
            The audiophile journey can be daunting: fragmented specs, conflicting sound signature impressions, and unauthorized grey-market imports that lack warranty protection. We founded Buybox with a single transparent objective: to create a trustworthy marketplace where every product is authentic, every specification is accurate, and every customer receives personalized technical support.
          </p>
          <p>
            Whether you are picking up your first set of planar magnetic open-back headphones, upgrading your desktop digital-to-analog converter, or setting up a reference studio listening station, Buybox is your trusted partner in acoustic excellence.
          </p>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors"
            >
              <ShoppingBag className="h-4 w-4" /> Explore the Catalog
            </Link>
            <Link
              href="/contact-support"
              className="text-xs font-bold text-[#004D38] hover:underline"
            >
              Get in Touch with Audio Consultants &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
