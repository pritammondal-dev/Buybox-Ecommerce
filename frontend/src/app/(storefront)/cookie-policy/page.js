import React from "react";
import Link from "next/link";
import { Cookie, ArrowLeft, Shield } from "lucide-react";

export const metadata = {
  title: "Cookie Policy | Buybox",
  description: "Learn how Buybox uses cookies, local storage, and session tokens to secure your browsing experience.",
};

export default function CookiePolicyPage() {
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
              <Cookie className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Cookie & Storage Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: September 2026 • Buybox Privacy & Platform Security
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. What are Cookies & Local Storage?</h2>
              <p>
                Cookies and browser local storage are small text fragments and key-value records saved to your browser when navigating websites. Buybox utilizes these to retain your active shopping cart items, remember compared products, and securely preserve your authentication sessions.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Categories of Cookies We Use</h2>
              <ul className="list-disc list-inside text-xs space-y-1.5">
                <li><strong className="text-slate-800">Essential Security Cookies:</strong> HttpOnly, secure authentication tokens scoped exclusively to our auth endpoints to prevent cross-site scripting (XSS) attacks.</li>
                <li><strong className="text-slate-800">Functional Storage:</strong> Persistent local storage keys storing your offline cart state, recent product views, and side-by-side comparison lists.</li>
                <li><strong className="text-slate-800">Performance & Diagnostics:</strong> Anonymized load-time metrics and network telemetry to guarantee ultra-fast page transitions and reliable checkout experiences.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Managing Your Cookie Preferences</h2>
              <p>
                You can configure your browser settings to reject third-party cookies or delete stored records. Please note that disabling essential session cookies will prevent persistent customer logins and real-time checkout synchronization.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/privacy"
              className="text-xs font-bold text-[#004D38] hover:underline"
            >
              Read Full Privacy Policy &rarr;
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
