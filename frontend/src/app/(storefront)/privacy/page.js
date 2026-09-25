import React from "react";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Buybox",
  description:
    "Learn how Buybox collects, uses, protects, and handles your personal information across our marketplace platform.",
};

export default function PrivacyPolicyPage() {
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
            <Shield className="size-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Last updated: September 2026 • Buybox E-Commerce Platform
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              1. Information We Collect
            </h2>
            <p>
              When you browse or make purchases on Buybox, we collect information you provide directly to us, such as your name, email address, phone number, shipping address, and payment confirmation details.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              2. How We Use Your Information
            </h2>
            <p>
              We use your information to process transactions, fulfill orders, send shipment notifications, handle customer inquiries, and deliver personalized product recommendations. We do not sell your personal data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              3. Data Security & Payment Protection
            </h2>
            <p>
              All payment transactions are encrypted using industry-standard protocols. Buybox does not store raw credit/debit card numbers on its servers; payments are processed securely through certified gateway partners.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              4. Cookies & Tracking
            </h2>
            <p>
              We use necessary session cookies and analytics to ensure your shopping cart persists, manage authentication states, and optimize site performance and browsing speed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">
              5. Contact Us
            </h2>
            <p>
              If you have any questions or concerns regarding this privacy policy or your personal data, reach out to our dedicated support team via your account dashboard or at{" "}
              <span className="font-semibold text-slate-800">support@buybox.in</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
