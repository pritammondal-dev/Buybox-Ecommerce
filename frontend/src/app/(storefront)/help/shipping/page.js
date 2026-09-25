import React from "react";
import Link from "next/link";
import { Truck, ArrowLeft, ShieldCheck, MapPin, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Shipping & Delivery Help | Buybox Help Center",
  description: "Learn about Buybox dispatch timelines, free shipping thresholds, and domestic courier partners.",
};

export default function HelpShippingPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-8">
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#004D38]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Help Center
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-8">
          <div className="space-y-2 border-b border-slate-100 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <Truck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Shipping & Delivery Information
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Details on fulfillment centers, courier networks, and transit estimates.
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. How long does shipping take?</h2>
              <p className="text-xs text-slate-600">
                Orders are packed and dispatched within 24 hours of placement. Standard transit times:
              </p>
              <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                <li>Metro Cities (Delhi, Mumbai, Bengaluru, Chennai, Kolkata): 2 to 3 business days.</li>
                <li>Tier 2 & Tier 3 Regional Hubs: 3 to 5 business days.</li>
                <li>Special Remote Destinations (J&K, North-East): 5 to 7 business days.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. What are the shipping charges?</h2>
              <p className="text-xs text-slate-600">
                Standard delivery is completely <strong>FREE</strong> for all orders above ₹999 across all serviceable PIN codes in India. A nominal fee of ₹99 applies for orders below the threshold.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. How are sensitive audio items packaged?</h2>
              <p className="text-xs text-slate-600">
                Audiophile electronics, vacuum tube amplifiers, and open-back headphones receive triple-layer protective packaging: anti-static shielding, custom high-density foam inserts, and reinforced tamper-evident outer cartons.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/shipping-policy"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Read Full Shipping Policy <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact-support"
              className="text-xs font-bold text-slate-600 hover:text-[#004D38]"
            >
              Contact Support &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
