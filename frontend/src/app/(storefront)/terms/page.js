import React from "react";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms & Conditions | Buybox",
  description:
    "Review the terms, conditions, warranty policies, and acceptable use guidelines governing your use of Buybox.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb / Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#007A55] hover:underline mb-6"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to Homepage</span>
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-6 mb-8">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#007A55]">
            <FileText className="size-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Terms &amp; Conditions
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Effective Date: September 2026 • Buybox E-Commerce Platform
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing, browsing, or shopping on Buybox, you agree to comply with and be bound by these Terms and Conditions and our Privacy Policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              2. Products, Pricing &amp; Stock Availability
            </h2>
            <p>
              All products listed on Buybox are authentic with genuine manufacturer warranties. Prices and availability are subject to change without prior notice. In the event of a pricing or inventory discrepancy, Buybox reserves the right to cancel or refund the affected order.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              3. Orders &amp; Payments
            </h2>
            <p>
              When placing an order, you agree to provide true, accurate, and current delivery and contact information. All payments must be settled through our approved payment methods before shipment dispatch.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              4. Shipping, Returns &amp; Warranty
            </h2>
            <p>
              Orders are packaged and dispatched by certified sellers. We provide a 30-day hassle-free return window for eligible products in their original packaging. Manufacturer warranties apply as specified on product listings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              5. Governing Law
            </h2>
            <p>
              These terms are governed by the applicable laws of India. Any disputes arising from transactions on this platform shall be subject to the exclusive jurisdiction of the competent courts.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
