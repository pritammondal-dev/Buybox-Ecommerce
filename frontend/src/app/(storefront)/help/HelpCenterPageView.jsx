"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  Package,
  CreditCard,
  Truck,
  RotateCcw,
  ShieldCheck,
  Headphones,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquare,
  Mail,
  PhoneCall,
} from "lucide-react";

const TOPICS = [
  {
    title: "Orders & Tracking",
    desc: "Order status, milestone tracking, modifications and cancellation policy.",
    icon: Package,
    href: "/help/orders",
  },
  {
    title: "Payments & Invoicing",
    desc: "Payment methods, UPI, Razorpay security, GST tax invoices and failed debits.",
    icon: CreditCard,
    href: "/help/payments",
  },
  {
    title: "Shipping & Logistics",
    desc: "Delivery timelines, dispatch facilities, express delivery and courier partners.",
    icon: Truck,
    href: "/help/shipping",
  },
  {
    title: "Returns & Refunds",
    desc: "7-day return guarantee, doorstep pickup, refund timelines and replacements.",
    icon: RotateCcw,
    href: "/help/returns",
  },
  {
    title: "Brand Warranty",
    desc: "Manufacturer warranties, authorized service centers, and repair support.",
    icon: ShieldCheck,
    href: "/shipping-policy",
  },
  {
    title: "Audiophile Advisory",
    desc: "DAC synergy, impedance matching, sound signatures, and equipment guidance.",
    icon: Headphones,
    href: "/contact-support",
  },
];

const FAQS = [
  {
    q: "How do I track my order once it has been shipped?",
    a: "You can track your order at any time by heading to My Orders > Track Shipment or entering your order number on the tracking page. We provide real-time scan updates from dispatch to doorstep delivery.",
  },
  {
    q: "What is the Buybox 7-Day Return & Replacement Policy?",
    a: "All equipment delivered through Buybox is backed by our 7-day hassle-free replacement or refund guarantee. If an item arrives damaged, defective, or missing components, initiate a return request from your order details page for complimentary doorstep pickup.",
  },
  {
    q: "How are refunds calculated and when will funds be credited?",
    a: "Refunds for prepaid orders are credited back to the original source (UPI, Debit/Credit Card, Net Banking) within 2 to 5 business days following product inspection at our fulfillment hub.",
  },
  {
    q: "Can I cancel an order after placing it?",
    a: "Yes! Orders can be self-cancelled free of charge as long as they have not progressed past the dispatch preparation stage. Navigate to your Order Details and click 'Cancel Order' to release reserved stock and initiate an automated refund.",
  },
  {
    q: "Are all products genuine with official manufacturer warranty?",
    a: "100% yes. Buybox is an authorized retailer and marketplace for all represented brands. All products arrive with original serial numbers and full domestic manufacturer warranties honored at verified service centers.",
  },
];

export function HelpCenterPageView() {
  const [search, setSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState(null);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Search Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] to-[#002B1F] p-8 sm:p-14 text-white shadow-xl text-center">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <HelpCircle className="h-4 w-4" /> Customer Assistance & FAQ
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              How can we help you today?
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              Find instant answers to common questions about orders, shipping, audio gear specifications, and warranty.
            </p>

            {/* Search Input */}
            <div className="relative pt-2 max-w-lg mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 mt-1" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search keywords (e.g. tracking, return, GST invoice, warranty)..."
                className="w-full rounded-2xl border-none bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-md outline-none"
              />
            </div>
          </div>
        </div>

        {/* Topics Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Explore by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOPICS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.title}
                  href={t.href}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38] group-hover:bg-[#004D38] group-hover:text-white transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#004D38] transition-colors">
                        {t.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t.desc}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-[#004D38] pt-2">
                    <span>Learn more</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-500">
              Clear answers to the most common customer questions.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 text-left font-bold text-sm text-slate-900 hover:text-[#004D38] transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-[#004D38] shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed pr-6">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Support Banner */}
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/40 p-8 sm:p-10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900">Still need help with your order?</h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
              Our dedicated customer support and audiophile technical consultants are here to help resolve any inquiry.
            </p>
            <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="h-4 w-4 text-[#004D38]" /> support@buybox.in
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <PhoneCall className="h-4 w-4 text-[#004D38]" /> 1800-BUYBOX-HELP
              </span>
            </div>
          </div>

          <Link
            href="/contact-support"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#004D38] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#003B2B] transition-colors shrink-0"
          >
            <MessageSquare className="h-4 w-4" /> Open a Support Ticket
          </Link>
        </div>
      </div>
    </div>
  );
}
