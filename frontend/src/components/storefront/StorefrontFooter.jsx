"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { categoryService } from "../../services/category.service.js";

export function StorefrontFooter({ categories: propCategories }) {
  const [internalCategories, setInternalCategories] = useState([]);

  const categories = propCategories && propCategories.length > 0 ? propCategories : internalCategories;

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

  return (
    <footer className="border-t border-emerald-950/80 bg-[#081A14] text-slate-300 select-none">
      {/* Main Footer Links */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-14 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1: Brand Info & Socials */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#007A55] text-white shadow-xs">
                <ShoppingBag className="size-5 stroke-[2.2]" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                Buybox
              </span>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Your one-stop destination for electronics, accessories and more. Shop smart. Shop Buybox.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#007A55] transition-colors"
              >
                <span className="font-black text-xs">f</span>
              </a>
              {/* Instagram */}
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#007A55] transition-colors"
              >
                <span className="font-black text-xs">ig</span>
              </a>
              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#007A55] transition-colors"
              >
                <span className="font-black text-xs">▶</span>
              </a>
              {/* X / Twitter */}
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#007A55] transition-colors"
              >
                <span className="font-black text-xs">𝕏</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-500 pt-4">
              &copy; {new Date().getFullYear()} Buybox. All rights reserved.
            </p>
          </div>

          {/* Column 2: Shop by Category */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Shop by Category
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              {categories && categories.length > 0 ? (
                categories.slice(0, 5).map((cat) => (
                  <li key={cat._id || cat.id || cat.slug}>
                    <Link
                      href={`/category/${cat.slug || cat.id}`}
                      className="hover:text-emerald-300 transition-colors capitalize"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Link href="/category/mobiles" className="hover:text-emerald-300 transition-colors">
                      Mobiles
                    </Link>
                  </li>
                  <li>
                    <Link href="/category/laptops" className="hover:text-emerald-300 transition-colors">
                      Laptops
                    </Link>
                  </li>
                  <li>
                    <Link href="/category/audio" className="hover:text-emerald-300 transition-colors">
                      Audio
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link href="/shop" className="hover:text-emerald-300 transition-colors">
                  More
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Customer Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Customer Support
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/help" className="hover:text-emerald-300 transition-colors">
                  Help Center &amp; FAQs
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-emerald-300 transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/return-policy" className="hover:text-emerald-300 transition-colors">
                  Returns &amp; Replacements
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="hover:text-emerald-300 transition-colors">
                  Shipping &amp; Delivery Info
                </Link>
              </li>
              <li>
                <Link href="/contact-support" className="hover:text-emerald-300 transition-colors">
                  Contact Audio Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Company & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Company &amp; Legal
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <Link href="/about" className="hover:text-emerald-300 transition-colors">
                  About Buybox
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-emerald-300 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-emerald-300 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-emerald-300 transition-colors">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link href="/sitemap" className="hover:text-emerald-300 transition-colors">
                  Site Directory
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Payment Badges Bar */}
      <div className="border-t border-emerald-950/90 py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-end gap-4">
          {/* Payment Method Badges */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-11 items-center justify-center rounded bg-white text-blue-700 font-black text-[10px] shadow-2xs">
              VISA
            </div>
            <div className="flex h-6 w-11 items-center justify-center rounded bg-white text-red-600 font-black text-[9px] shadow-2xs">
              MC
            </div>
            <div className="flex h-6 w-11 items-center justify-center rounded bg-white text-blue-500 font-bold text-[9px] shadow-2xs">
              Maestro
            </div>
            <div className="flex h-6 w-11 items-center justify-center rounded bg-white text-emerald-700 font-black text-[9px] shadow-2xs">
              RuPay
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default StorefrontFooter;
