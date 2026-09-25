import React from "react";
import Link from "next/link";
import { RotateCcw, ArrowLeft, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Returns & Replacements Help | Buybox Help Center",
  description: "Learn about Buybox 7-day return policy, replacement criteria, and refund steps.",
};

export default function HelpReturnsPage() {
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
              <RotateCcw className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Returns, Refunds & Replacements
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Guidelines on initiating returns, doorstep pickups, and refund timelines.
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. What is eligible for return or replacement?</h2>
              <p className="text-xs text-slate-600">
                Any item delivered within the past 7 days can be submitted for return or replacement if it exhibits physical transit damage, electronic failure, driver mismatch, or discrepancies from catalog specifications.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. How do I initiate a return?</h2>
              <ol className="space-y-1 text-xs text-slate-600 list-decimal list-inside">
                <li>Navigate to <Link href="/account/orders" className="text-[#004D38] font-bold underline">My Orders</Link> and select your delivered order.</li>
                <li>Click <strong>Request Return / Replacement</strong>.</li>
                <li>Choose the items, state your reason, and select whether you want a replacement or refund.</li>
                <li>Our logistics courier will schedule a complimentary doorstep pickup.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. When will my refund be processed?</h2>
              <p className="text-xs text-slate-600">
                Once the returned product arrives at our hub and passes standard diagnostic inspection (typically within 24 hours of receipt), our automated refund engine releases your credit directly to the original payment source.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/return-policy"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Read Detailed Return Policy <ArrowRight className="h-4 w-4" />
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
