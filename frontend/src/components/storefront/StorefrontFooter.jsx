"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, ShieldCheck, Truck, RotateCcw, Headphones, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { categoryService } from "../../services/category.service.js";

export function StorefrontFooter({ categories: propCategories }) {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [internalCategories, setInternalCategories] = useState([]);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

  // Fetch categories if not provided as prop
  useEffect(() => {
    if (propCategories && propCategories.length > 0) return;

    let isMounted = true;
    categoryService
      .getCategories({ limit: 6 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.data?.categories || (Array.isArray(res?.data) ? res.data : []);
        setInternalCategories(Array.isArray(list) ? list.slice(0, 6) : []);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [propCategories]);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setIsSubscribed(true);
    toast.success("Thank you for subscribing to Buybox newsletter!");
    setEmail("");
  };

  return (
    <footer className="border-t border-slate-800 bg-[#0F172A] text-slate-200">
      {/* Trust Badges Bar (Top of Footer) */}
      <div className="border-b border-slate-800 bg-slate-900/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#007A55]/15 text-[#007A55]">
              <Truck className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Fast Free Shipping</h4>
              <p className="text-[11px] text-slate-400">On all orders above ₹999</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#007A55]/15 text-[#007A55]">
              <ShieldCheck className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">100% Secure Checkout</h4>
              <p className="text-[11px] text-slate-400">Razorpay & SSL Protected</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#007A55]/15 text-[#007A55]">
              <RotateCcw className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Easy 30-Day Returns</h4>
              <p className="text-[11px] text-slate-400">Hassle-free guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#007A55]/15 text-[#007A55]">
              <Headphones className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Dedicated Support</h4>
              <p className="text-[11px] text-slate-400">24/7 client hotline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Body */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1 & 2: Brand Information & Newsletter */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs">
                <ShoppingBag className="size-5 stroke-[2.2]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">Buybox</span>
            </Link>

            <p className="max-w-sm text-xs sm:text-sm text-slate-400 leading-relaxed">
              Buybox is a modern e-commerce marketplace engineered for high-performance audio,
              electronics, and premium lifestyle essentials with authentic manufacturer warranties.
            </p>

            {/* Newsletter Subscription */}
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Stay updated with special offers & deals
              </p>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 py-2">
                  <CheckCircle2 className="size-4" />
                  <span>You are subscribed to Buybox updates!</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex max-w-md gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="h-10 flex-1 rounded-full border border-slate-700 bg-slate-900/90 px-4 text-xs text-white placeholder:text-slate-500 focus:border-[#007A55] focus:outline-none focus:ring-1 focus:ring-[#007A55]"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-full bg-[#007A55] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Column 3: Shop Categories (Dynamic from Backend) */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Shop Categories
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              {categories.length > 0 ? (
                categories.map((cat) => {
                  const id = cat.id || cat._id;
                  const slug = cat.slug || id;
                  return (
                    <li key={id}>
                      <Link
                        href={`/category/${slug}`}
                        className="hover:text-emerald-400 transition-colors"
                      >
                        {cat.name}
                      </Link>
                    </li>
                  );
                })
              ) : (
                <li>
                  <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                    All Products
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/shop?sort=discount"
                  className="text-rose-400 hover:text-rose-300 font-bold transition-colors"
                >
                  Today&apos;s Hot Deals
                </Link>
              </li>
              <li>
                <Link
                  href="/shop?sort=newest"
                  className="hover:text-emerald-400 transition-colors"
                >
                  New Arrivals
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Customer Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Customer Support
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link href="/account/orders" className="hover:text-emerald-400 transition-colors">
                  Track My Order
                </Link>
              </li>
              <li>
                <Link href="/account/addresses" className="hover:text-emerald-400 transition-colors">
                  Shipping Addresses
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-emerald-400 transition-colors">
                  My Account
                </Link>
              </li>
              <li>
                <Link href="/account/wishlist" className="hover:text-emerald-400 transition-colors">
                  My Wishlist
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  Return & Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  Help & FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Company & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Company & Legal
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  About Buybox
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-emerald-400 transition-colors">
                  Vendor Registration
                </Link>
              </li>
              <li>
                <Link href="/admin" className="text-emerald-400 hover:underline font-bold transition-colors">
                  Vendor & Admin Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Payment Badges */}
        <div className="mt-12 border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>&copy; {new Date().getFullYear()} Buybox E-Commerce. All rights reserved.</p>

          {/* Accepted Payment Gateway Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">100% Safe Payments:</span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              Razorpay
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              UPI
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              RuPay
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              Visa
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
              Mastercard
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default StorefrontFooter;
