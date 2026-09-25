import React from "react";
import Link from "next/link";
import { CreditCard, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

export const metadata = {
  title: "Refund Policy | Buybox",
  description: "Official refund processing guidelines, payment source reversals, and resolution timelines for Buybox orders.",
};

export default function RefundPolicyPage() {
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
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Refund Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: September 2026 • Financial Accounting & Ledger Settlement
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. Original Payment Source Reversal</h2>
              <p>
                All refunds are routed back to the exact payment mechanism utilized during the initial transaction. For security reasons and compliance with anti-money laundering regulations, Buybox does not issue cash payouts or manual transfers to third-party accounts.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Processing Timelines by Payment Method</h2>
              <ul className="list-disc list-inside text-xs space-y-1">
                <li><strong className="text-slate-800">UPI (GPay / PhonePe / Paytm):</strong> 24 to 48 hours following inspection clearance.</li>
                <li><strong className="text-slate-800">Debit / Credit Cards:</strong> 3 to 5 business days, subject to your card issuer&apos;s settlement schedule.</li>
                <li><strong className="text-slate-800">Net Banking:</strong> 2 to 4 business days.</li>
                <li><strong className="text-slate-800">Buybox Gift Card / Store Points:</strong> Instant reversal back to your account wallet.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Deductions & Shipping Reimbursements</h2>
              <p>
                When a return is approved due to defective merchandise, wrong delivery, or damaged transit, the entire invoice total—including any initial shipping charge—is refunded in full without any restocking deductions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Tracking Your Refund Status</h2>
              <p>
                Each refund generates a unique bank reference ARN (Application Reference Number) visible directly within your Order Details page. You can provide this ARN to your issuing bank if funds are delayed past 7 working days.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/cancellation-policy"
              className="text-xs font-bold text-[#004D38] hover:underline"
            >
              Review Cancellation Policy &rarr;
            </Link>
            <Link
              href="/contact-support"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Contact Support for Billing Assistance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
