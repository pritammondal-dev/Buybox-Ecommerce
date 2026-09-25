import React from "react";
import Link from "next/link";
import { CreditCard, ArrowLeft, ShieldCheck, FileText, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Payments & Invoicing Help | Buybox Help Center",
  description: "Learn about payment options, Razorpay checkout, UPI, tax invoices, and refunds on Buybox.",
};

export default function HelpPaymentsPage() {
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
              <CreditCard className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Payments, Invoicing & Tax
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Information on supported payment methods, security encryption, and GST invoices.
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. What payment methods are accepted?</h2>
              <p className="text-xs text-slate-600">
                We accept all major credit and debit cards (Visa, MasterCard, RuPay, American Express), UPI apps (Google Pay, PhonePe, Paytm, BHIM), Net Banking across 50+ banks, Buybox Gift Cards, and Reward Points redemption.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Is my transaction secure?</h2>
              <p className="text-xs text-slate-600">
                All transactions are processed through RBI-authorized, PCI-DSS Level 1 certified gateways with 256-bit end-to-end SSL encryption. Buybox never stores your raw card CVV or banking credentials.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. How do I download a GST Tax Invoice?</h2>
              <p className="text-xs text-slate-600">
                Every purchase includes a computer-generated tax invoice with full GST breakdown (CGST, SGST, IGST) and HSN codes. Navigate to your Order Details and click <strong>Tax Invoice</strong> to view or print an official PDF receipt.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Money was debited but order shows failed?</h2>
              <p className="text-xs text-slate-600">
                In rare instances of network drops during banking handshakes, your issuing bank may temporarily reserve funds. If Buybox did not receive authorization, the debited sum will be automatically released back to your account by your bank within 24 to 48 hours.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              View Invoices & Orders <ArrowRight className="h-4 w-4" />
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
