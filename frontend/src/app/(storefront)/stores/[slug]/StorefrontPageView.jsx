"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  MapPin,
  Clock,
  Mail,
  Phone,
  Truck,
  RotateCcw,
  CreditCard,
  Globe,
  Share2,
  Package,
  FileText,
  Search,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/storefront/ProductCard";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";

export function StorefrontPageView({ store, initialProducts = [] }) {
  const [activeTab, setActiveTab] = useState("products");
  const [searchQuery, setSearchQuery] = useState("");
  const { addItem: addToCart } = useCart();
  const { isInWishlist, addItem: addToWishlist, removeItem: removeFromWishlist } = useWishlist();

  const branding = store?.branding || {};
  const policies = branding?.policies || {};
  const location = store?.location || {};
  const isKycApproved = store?.kycApproved;

  const filteredProducts = initialProducts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.name?.toLowerCase().includes(q)
    );
  });

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Store link copied to clipboard!");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Hero Storefront Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-200/80 shadow-sm min-h-[200px] sm:min-h-[260px] flex flex-col justify-end">
        {branding.banner ? (
          <img
            src={branding.banner}
            alt={`${store.businessName} banner`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#003829] via-[#004D38] to-slate-900 opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Floating Quick Action */}
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={handleShare}
            className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-colors shadow-xs"
            title="Share Store"
          >
            <Share2 className="size-4" />
          </button>
        </div>

        {/* Storefront Hero Identity Header */}
        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="flex items-start sm:items-end gap-5">
            {/* Logo Card */}
            <div className="size-20 sm:size-24 rounded-2xl bg-white border-2 border-white shadow-lg overflow-hidden flex items-center justify-center shrink-0">
              {branding.logo ? (
                <img
                  src={branding.logo}
                  alt={branding.displayName || store.businessName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="size-10 text-[#004D38]" />
              )}
            </div>

            <div className="space-y-1.5 text-white">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
                  {branding.displayName || store.businessName}
                </h1>
                {isKycApproved && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/90 text-white text-[11px] font-bold tracking-wide shadow-xs backdrop-blur-xs">
                    <ShieldCheck className="size-3.5" />
                    <span>Verified Merchant</span>
                  </span>
                )}
              </div>

              {branding.description && (
                <p className="text-xs sm:text-sm text-slate-200 max-w-2xl line-clamp-2">
                  {branding.description}
                </p>
              )}

              {/* Quick Info Chips */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                {(location.city || location.state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-emerald-400" />
                    <span>
                      {[location.city, location.state, location.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </span>
                )}
                {branding.operatingHours && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5 text-emerald-400" />
                    <span>{branding.operatingHours}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details */}
          {(branding.publicContactEmail || branding.publicContactPhone) && (
            <div className="text-xs text-slate-200 space-y-1 sm:text-right shrink-0">
              {branding.publicContactEmail && (
                <div className="flex sm:justify-end items-center gap-1.5">
                  <Mail className="size-3.5 text-emerald-400" />
                  <span>{branding.publicContactEmail}</span>
                </div>
              )}
              {branding.publicContactPhone && (
                <div className="flex sm:justify-end items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-400" />
                  <span>{branding.publicContactPhone}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "products"
                  ? "border-[#004D38] text-[#004D38]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Package className="size-4" />
              <span>All Products ({initialProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("policies")}
              className={`pb-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "policies"
                  ? "border-[#004D38] text-[#004D38]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="size-4" />
              <span>Store Policies &amp; About</span>
            </button>
          </div>

          {/* Catalog search when on products tab */}
          {activeTab === "products" && (
            <div className="relative pb-3 w-48 sm:w-64">
              <Search className="size-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search store..."
                className="w-full pl-8 pr-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-[#004D38]"
              />
            </div>
          )}
        </div>
      </div>

      {/* TAB CONTENT: PRODUCTS */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id || product.id}
                  product={product}
                  isWishlisted={isInWishlist(product._id || product.id)}
                  onWishlistToggle={() => {
                    const id = product._id || product.id;
                    if (isInWishlist(id)) {
                      removeFromWishlist(id);
                    } else {
                      addToWishlist(product);
                    }
                  }}
                  onAddToCart={() => addToCart(product, 1)}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 text-slate-400 inline-block">
                <Package className="size-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {searchQuery ? "No matching products found" : "No products listed yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? "Try searching for a different keyword or browse other catalog categories."
                  : "This merchant is currently stocking products. Please check back soon!"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: POLICIES & ABOUT */}
      {activeTab === "policies" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Shipping Policy */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#004D38] inline-block">
              <Truck className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Shipping &amp; Delivery</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {policies.shippingPolicy ||
                "Standard marketplace dispatch applies. Orders are verified and handed to logistics partners within 24–48 hours."}
            </p>
          </div>

          {/* Return Policy */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#004D38] inline-block">
              <RotateCcw className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Return Policy</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {policies.returnPolicy ||
                "Returns accepted in original condition with intact packaging within 7 days of delivery for eligible items."}
            </p>
          </div>

          {/* Refund Policy */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-[#004D38] inline-block">
              <CreditCard className="size-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Refund Policy</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {policies.refundPolicy ||
                "Refunds are credited to the original payment source within 5–7 business days following warehouse inspection."}
            </p>
          </div>

          {/* Social Links & Trust Statement */}
          <div className="md:col-span-3 p-6 rounded-3xl bg-slate-50 border border-slate-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white text-[#004D38] border border-slate-200">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Buybox Buyer Protection Guarantee</h4>
                <p className="text-[11px] text-slate-500">
                  Every order placed through verified merchant storefronts is backed by 100% authentic manufacturer warranty and escrow payment protection.
                </p>
              </div>
            </div>

            {branding.socialLinks?.website && (
              <a
                href={branding.socialLinks.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004D38] hover:underline shrink-0"
              >
                <Globe className="size-3.5" />
                <span>Visit Merchant Website &rarr;</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

