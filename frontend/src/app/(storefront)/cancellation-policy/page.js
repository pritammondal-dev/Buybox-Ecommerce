import React from "react";
import Link from "next/link";
import { XCircle, ArrowLeft, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Order Cancellation Policy | Buybox",
  description: "Guidelines and procedures for self-cancelling orders and automated inventory release on Buybox.",
};

export default function CancellationPolicyPage() {
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
              <XCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Order Cancellation Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: September 2026 • Buybox Storefront Operations
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. Pre-Dispatch Self-Cancellation</h2>
              <p>
                Customers can cancel any placed order directly through their account without contacting support, provided the order is still in the <em>Pending</em> or early <em>Processing</em> stage and has not yet been assigned to a courier manifested route.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. Automated Refund & Inventory Release</h2>
              <p>
                The instant an order cancellation is submitted, our inventory allocation engine immediately unlocks the reserved units back to available warehouse stock. An automated refund order is concurrently logged into our financial ledger and submitted to the payment gateway.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Shipped & In-Transit Orders</h2>
              <p>
                Once an order has been packaged and scanned by a third-party logistics courier, real-time electronic cancellation is restricted. In this circumstance, you may refuse delivery at your doorstep when the carrier arrives, or accept the parcel and initiate a standard 7-day return request.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. Cancellation by Buybox</h2>
              <p>
                Buybox reserves the right to cancel an order under rare conditions: (a) payment verification fraud alert, (b) unintended system pricing error, (c) failure to meet delivery eligibility in unserviceable containment zones. In any such circumstance, customers are alerted immediately and refunded in full.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/return-policy"
              className="text-xs font-bold text-[#004D38] hover:underline"
            >
              Learn about Returns & Replacements &rarr;
            </Link>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Manage Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
