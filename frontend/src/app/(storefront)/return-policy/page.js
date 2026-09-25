import React from "react";
import Link from "next/link";
import { RotateCcw, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Return & Replacement Policy | Buybox",
  description: "Official 7-day return and replacement policy criteria, inspection conditions, and doorstep pickup guidelines for Buybox.",
};

export default function ReturnPolicyPage() {
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
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Return & Replacement Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: September 2026 • Buybox Quality & Returns Standard
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. 7-Day Hassle-Free Window</h2>
              <p>
                Every product delivered by Buybox is backed by our customer-first 7-day return or replacement window from the timestamp of courier handover. If your equipment exhibits manufacturer defects, physical transit damage, or specification mismatch, submit a request via your order history.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Eligibility Conditions</h2>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li>Item must be returned with original retail packaging, cables, adapters, warranty cards, and manuals.</li>
                <li>Serial numbers on the unit and retail carton must match the recorded invoice data.</li>
                <li>Products damaged through unauthorized disassembly, third-party cable modding, or accidental liquid spills are ineligible for returns and must be serviced under warranty.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Doorstep Inspection & Reverse Pickup</h2>
              <p>
                Upon return authorization, Buybox dispatches a verified courier agent to your registered delivery address to complete an initial condition scan and pickup. Reverse logistics shipping is 100% free of charge to the customer.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Replacement or Refund Options</h2>
              <p>
                Customers can elect between an immediate replacement unit shipped with priority dispatch, or a full refund credited to the original payment source after diagnostic verification.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/refund-policy"
              className="text-xs font-bold text-[#004D38] hover:underline"
            >
              Read Refund Processing Guidelines &rarr;
            </Link>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Initiate Return from Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
