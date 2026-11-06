import React, { Suspense } from "react";
import Link from "next/link";
import { Sparkles, Tag, ArrowRight, Flame, Zap, Calendar, ShoppingBag } from "lucide-react";
import { campaignService } from "../../../services/campaign.service.js";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Campaigns & Special Offers | Buybox",
  description:
    "Discover active promotional campaigns, seasonal sales, exclusive bank deals, and verified coupons on high-fidelity audio equipment at Buybox.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function CampaignsFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function formatCampaignType(type) {
  switch (type) {
    case "seasonal":
      return "Seasonal Sale";
    case "flash_sale":
      return "Flash Sale";
    case "holiday":
      return "Holiday Special";
    case "clearance":
      return "Clearance Event";
    case "brand_special":
      return "Brand Spotlight";
    default:
      return "Promotional Event";
  }
}

export default async function CampaignsPage() {
  let campaigns = [];
  let coupons = [];
  let isError = false;

  try {
    const [campRes, coupRes] = await Promise.allSettled([
      campaignService.getActiveCampaigns(),
      campaignService.getActiveCoupons(),
    ]);

    if (campRes.status === "fulfilled") {
      campaigns = Array.isArray(campRes.value?.data)
        ? campRes.value.data
        : campRes.value?.data?.campaigns || [];
    } else {
      isError = true;
    }

    if (coupRes.status === "fulfilled") {
      coupons = Array.isArray(coupRes.value?.data)
        ? coupRes.value.data
        : coupRes.value?.data?.coupons || [];
    }
  } catch {
    isError = true;
  }

  return (
    <Suspense fallback={<CampaignsFallback />}>
      <div className="min-h-screen bg-slate-50/40 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-[#004D38] transition-colors">Home</Link>
            <span>/</span>
            <span className="font-bold text-slate-900">Campaigns &amp; Offers</span>
          </nav>

          {/* Hero Promotional Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#004D38] via-[#006346] to-slate-900 p-8 sm:p-12 text-white shadow-lg space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-300/30">
              <Sparkles className="size-3.5" />
              <span>Exclusive Discoveries</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Campaigns &amp; Special Offers
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Explore ongoing brand activations, seasonal promotional events, and exclusive partner markdowns across our curated audio, headphones, and enthusiast gear catalog.
            </p>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link
                href="/deals"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-white border border-white/20 transition-colors"
              >
                <Flame className="size-3.5 text-amber-300 fill-amber-300" />
                <span>Today&apos;s Hot Deals</span>
              </Link>
              <Link
                href="/flash-sale"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-white border border-white/20 transition-colors"
              >
                <Zap className="size-3.5 text-amber-300" />
                <span>Flash Sales</span>
              </Link>
              <Link
                href="/coupons"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-white border border-white/20 transition-colors"
              >
                <Tag className="size-3.5 text-emerald-300" />
                <span>Checkout Coupons</span>
              </Link>
            </div>
          </div>

          {/* Active Campaigns Section */}
          <section aria-labelledby="active-campaigns-heading" className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <h2 id="active-campaigns-heading" className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="size-5 text-[#004D38]" />
                  <span>Active Promotional Campaigns</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-[#004D38]">
                    {campaigns.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Time-limited marketing events with verified catalog selections.
                </p>
              </div>
            </div>

            {isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-8 text-center space-y-3">
                <p className="text-sm font-bold text-rose-800">
                  Unable to load campaigns at the moment.
                </p>
                <p className="text-xs text-rose-600">
                  Please refresh the page or explore our complete catalog.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-4 py-2 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
                >
                  Explore Catalog <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs space-y-4">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#004D38]">
                  <Sparkles className="size-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900">
                    No active campaigns right now
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    We&apos;re preparing our next round of seasonal specials and manufacturer promotions. In the meantime, you can browse all verified audio gear or check today&apos;s deals.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#004D38] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors"
                  >
                    <ShoppingBag className="size-4" />
                    <span>Browse All Products</span>
                  </Link>
                  <Link
                    href="/deals"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <Flame className="size-4 text-rose-500" />
                    <span>Today&apos;s Hot Deals</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((camp) => {
                  const cId = camp._id || camp.id;
                  const slug = camp.slug || cId;
                  const productCount =
                    Array.isArray(camp.productIds) && camp.productIds.length > 0
                      ? camp.productIds.length
                      : camp.productCount || 0;
                  const couponCount = Array.isArray(camp.couponIds) ? camp.couponIds.length : 0;

                  return (
                    <div
                      key={`camp-${slug}`}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-[#004D38]/40 transition-all duration-200"
                    >
                      <div>
                        {/* Banner image or stylized gradient header */}
                        <Link href={`/campaign/${slug}`} className="block relative h-40 sm:h-44 w-full overflow-hidden bg-slate-100">
                          {camp.bannerUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={camp.bannerUrl}
                              alt={camp.name}
                              className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-emerald-800 to-slate-900 p-6 text-center text-white">
                              <Sparkles className="size-8 text-amber-300 opacity-80 mb-2" />
                              <span className="font-black text-sm tracking-tight line-clamp-2">
                                {camp.name}
                              </span>
                            </div>
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                              {formatCampaignType(camp.type)}
                            </span>
                          </div>
                        </Link>

                        {/* Campaign Body */}
                        <div className="p-5 space-y-3">
                          <Link href={`/campaign/${slug}`} className="block group-hover:text-[#004D38] transition-colors">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 line-clamp-1">
                              {camp.name}
                            </h3>
                          </Link>
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {camp.description || "Limited-time deals and promotional markdowns on verified brand collections."}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {productCount > 0 && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {productCount} {productCount === 1 ? "Product" : "Products"}
                              </span>
                            )}
                            {couponCount > 0 && (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                {couponCount} {couponCount === 1 ? "Coupon" : "Coupons"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between gap-3">
                        {camp.endsAt ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
                            <Calendar className="size-3.5 text-slate-400 shrink-0" />
                            <span>Ends {new Date(camp.endsAt).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold">Active Now</span>
                        )}

                        <Link
                          href={`/campaign/${slug}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#004D38] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#003B2B] transition-colors shrink-0 shadow-2xs"
                        >
                          <span>Explore</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Checkout Coupons Section (if available) */}
          {coupons.length > 0 && (
            <section aria-labelledby="checkout-coupons-heading" className="space-y-4 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="checkout-coupons-heading" className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Tag className="size-5 text-[#004D38]" />
                    <span>Checkout Coupons &amp; Instant Savings</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Apply these codes at checkout for verified cart-level discounts.
                  </p>
                </div>
                <Link href="/coupons" className="text-xs font-bold text-[#004D38] hover:underline flex items-center gap-1">
                  <span>View All Coupons</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coupons.slice(0, 3).map((c) => (
                  <div
                    key={c._id || c.code}
                    className="rounded-2xl border border-amber-200 bg-[#FFF8D6]/60 p-5 shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm text-[#004D38] bg-white px-2.5 py-1 rounded-md border border-amber-300">
                        {c.code}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        {c.discountType === "percentage" ? `${c.discountAmount}% OFF` : `₹${c.discountAmount} OFF`}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{c.title || `Save ₹${c.discountAmount}`}</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {c.description || `Valid on qualifying orders above ₹${c.minOrderAmount || 0}`}
                    </p>
                    {c.expiresAt && (
                      <p className="text-[10px] text-slate-400 pt-1">
                        Expires: {new Date(c.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Suspense>
  );
}
