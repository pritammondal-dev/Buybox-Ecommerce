import React from "react";
import Link from "next/link";
import { Compass, ArrowLeft, ArrowRight } from "lucide-react";

export const metadata = {
  title: "HTML Sitemap & Directory | Buybox",
  description: "Browse the complete directory of categories, brand hubs, customer account utilities, and policy pages on Buybox.",
};

const SITEMAP_SECTIONS = [
  {
    title: "Discovery & Shopping",
    links: [
      { label: "Storefront Home", href: "/" },
      { label: "All Products Catalog", href: "/products" },
      { label: "Special Deals & Promotions", href: "/deals" },
      { label: "Limited Flash Sales", href: "/flash-sale" },
      { label: "Discount Coupons & Vouchers", href: "/coupons" },
      { label: "Active Campaigns & Offers", href: "/offers" },
      { label: "Side-by-Side Product Comparison", href: "/compare" },
    ],
  },
  {
    title: "Customer Account",
    links: [
      { label: "Account Dashboard", href: "/account" },
      { label: "My Orders & Receipts", href: "/account/orders" },
      { label: "Saved Delivery Addresses", href: "/account/addresses" },
      { label: "Personal Wishlist", href: "/account/wishlist" },
      { label: "Profile Information", href: "/account/profile" },
      { label: "Security & Login Sessions", href: "/account/security" },
      { label: "Notifications & Updates", href: "/account/notifications" },
      { label: "Loyalty Points & Rewards", href: "/account/rewards" },
      { label: "Gift Cards & Wallet", href: "/account/gift-cards" },
      { label: "Recently Viewed Equipment", href: "/account/recently-viewed" },
    ],
  },
  {
    title: "Customer Support & Guidance",
    links: [
      { label: "Help Center & FAQs", href: "/help" },
      { label: "Order Tracking Guide", href: "/help/orders" },
      { label: "Payments & Invoicing Help", href: "/help/payments" },
      { label: "Shipping & Transit Guidelines", href: "/help/shipping" },
      { label: "Returns & Replacement Instructions", href: "/help/returns" },
      { label: "Contact Audio Support Desk", href: "/contact-support" },
    ],
  },
  {
    title: "Legal & Transparency Policies",
    links: [
      { label: "About Buybox", href: "/about" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Shipping & Delivery Policy", href: "/shipping-policy" },
      { label: "Return & Replacement Policy", href: "/return-policy" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Cancellation Policy", href: "/cancellation-policy" },
      { label: "Cookie & Storage Policy", href: "/cookie-policy" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004D38] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Homepage
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm space-y-8">
          <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                Site Directory & Sitemap
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Explore all verified pages, tools, account resources, and legal policies on Buybox.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SITEMAP_SECTIONS.map((sec) => (
              <div key={sec.title} className="space-y-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#004D38]">
                  {sec.title}
                </h2>
                <ul className="space-y-2 text-xs">
                  {sec.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-slate-700 hover:text-[#004D38] hover:underline flex items-center gap-1.5 font-medium transition-colors"
                      >
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span>{link.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
