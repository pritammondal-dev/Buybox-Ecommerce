import React from "react";
import Link from "next/link";
import { Truck, ArrowLeft, ShieldCheck, MapPin } from "lucide-react";

export const metadata = {
  title: "Shipping & Delivery Policy | Buybox",
  description: "Official domestic shipping and delivery guidelines, dispatch schedules, and packaging protocols for Buybox.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004D38] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Homepage
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-8">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Shipping & Delivery Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: September 2026 • Buybox Marketplace Operations
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. Order Processing & Dispatch Timelines</h2>
              <p>
                All confirmed orders placed Monday through Saturday before 2:00 PM IST are processed and handed over to courier networks on the same business day. Orders placed after the cutoff or on national holidays are dispatched on the immediate following working day.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Free Shipping Eligibility</h2>
              <p>
                Buybox provides complimentary insured standard shipping for all orders exceeding ₹999 across all serviceable PIN codes throughout India. For orders below this threshold, a flat delivery fee of ₹99 is computed at checkout.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Estimated Transit Windows</h2>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Metro Centers (Delhi NCR, Mumbai, Bengaluru, Chennai, Hyderabad, Kolkata): 2 to 3 working days.</li>
                <li>Tier 1 & Tier 2 Cities: 3 to 5 working days.</li>
                <li>Special Regional Destinatons (Northeast states, Andaman, Lakshadweep, J&K): 5 to 8 working days.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. High-Value Packaging Protection</h2>
              <p>
                Because premium headphones, planar magnetic transducers, tube preamplifiers, and digital converters are susceptible to physical shock and magnetic interference, all packages are shipped in tamper-evident sealed boxes with shock-absorbing foam lining.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">5. Contact Logistics Support</h2>
              <p>
                For delivery escalations, tracking updates, or address re-routing, contact our logistics coordinators at <span className="font-semibold text-slate-800">support@buybox.in</span> or call <span className="font-semibold text-slate-800">1800-BUYBOX-HELP</span>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
