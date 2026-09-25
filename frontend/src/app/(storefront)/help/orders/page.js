import React from "react";
import Link from "next/link";
import { Package, ArrowLeft, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Orders & Tracking Help | Buybox Help Center",
  description: "Learn how to track orders, manage deliveries, and cancel orders on Buybox.",
};

export default function HelpOrdersPage() {
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
              <Package className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Orders & Tracking Assistance
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Everything you need to know about placing, modifying, and tracking your Buybox orders.
            </p>
          </div>

          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">1. How do I track my order?</h2>
              <p className="text-xs text-slate-600">
                Once your order has been dispatched from our certified fulfillment center, you will receive an automated SMS and email notification with an AWB tracking number. You can also view live status updates directly in your account under <Link href="/account/orders" className="text-[#004D38] font-bold underline">My Orders</Link>.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">2. What order stages will I see?</h2>
              <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                <li><strong className="text-slate-800">Pending:</strong> Order created and awaiting payment confirmation or fraud verification.</li>
                <li><strong className="text-slate-800">Processing:</strong> Payment verified; item retrieved from secure audio warehouse and packaged.</li>
                <li><strong className="text-slate-800">Shipped:</strong> Handed over to logistics carrier with unique tracking code.</li>
                <li><strong className="text-slate-800">Delivered:</strong> Successfully handed over at destination address with OTP verification.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">3. Can I change my delivery address?</h2>
              <p className="text-xs text-slate-600">
                You can modify delivery details if the order is still in the <em>Pending</em> state by contacting customer support immediately. Once an order is processed or handed to the courier, destination changes are restricted for safety.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-slate-900">4. How do I cancel an order?</h2>
              <p className="text-xs text-slate-600">
                To cancel an unfulfilled order, open the order in your dashboard and click <strong>Cancel Order</strong>. Select a reason and submit. Pre-paid orders are refunded back to your bank account or card within 2 to 5 business days.
              </p>
            </section>
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
            >
              Go to My Orders <ArrowRight className="h-4 w-4" />
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
