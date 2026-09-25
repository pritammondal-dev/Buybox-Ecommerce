import React, { Suspense } from "react";
import Link from "next/link";
import { Tag, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { campaignService } from "../../../services/campaign.service.js";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Offers & Bank Promotions | Buybox",
  description: "Browse verified coupons, bank offers, and seasonal markdowns on authentic audio gear at Buybox.",
};

function OffersFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function OffersPage() {
  let campaigns = [];
  let coupons = [];

  try {
    const [campRes, coupRes] = await Promise.allSettled([
      campaignService.getActiveCampaigns(),
      campaignService.getActiveCoupons(),
    ]);

    if (campRes.status === "fulfilled") {
      campaigns = campRes.value?.data || [];
    }
    if (coupRes.status === "fulfilled") {
      coupons = coupRes.value?.data || [];
    }
  } catch {
    // Non-blocking fallback
  }

  return (
    <Suspense fallback={<OffersFallback />}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Banner */}
        <div className="rounded-3xl bg-gradient-to-br from-[#004D38] via-[#006346] to-slate-900 p-8 sm:p-12 text-white shadow-lg space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-300/30">
            <Tag className="size-3.5" />
            <span>Storewide Promotions</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Exclusive Offers &amp; Discounts
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100 max-w-xl leading-relaxed">
            Take advantage of active promotional campaigns and verified coupons across all certified tech categories.
          </p>
        </div>

        {/* Available Coupons */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Tag className="size-5 text-[#004D38]" />
              <span>Available Checkout Coupons ({coupons.length})</span>
            </h2>
            <Link href="/coupons" className="text-xs font-bold text-[#004D38] hover:underline">
              Coupon Directory
            </Link>
          </div>

          {coupons.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
              No general coupons active at this moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coupons.map((c) => (
                <div
                  key={c._id || c.code}
                  className="rounded-2xl border border-amber-200 bg-[#FFF8D6]/60 p-5 shadow-xs space-y-2"
                >
                  <span className="font-mono font-black text-sm text-[#004D38] block">
                    {c.code}
                  </span>
                  <p className="text-xs font-bold text-slate-900">{c.title || `Save ₹${c.discountAmount}`}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {c.description || `Valid on orders above ₹${c.minOrderAmount || 0}`}
                  </p>
                  {c.expiresAt && (
                    <p className="text-[10px] text-slate-400 pt-1">
                      Expires: {new Date(c.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Promotional Campaigns */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              <span>Ongoing Seasonal Events ({campaigns.length})</span>
            </h2>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
              No active seasonal campaigns running right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {campaigns.map((camp) => (
                <div
                  key={camp._id || camp.slug}
                  className="flex flex-col justify-between rounded-2xl border bg-white p-6 shadow-xs hover:border-[#004D38] transition-colors"
                >
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-slate-900">{camp.name}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {camp.description || "Limited-time deals on selected brand collections."}
                    </p>
                  </div>
                  <div className="pt-4 mt-4 border-t flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      {camp.productIds?.length || 0} Products
                    </span>
                    <Link
                      href={`/campaign/${camp.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#004D38] hover:underline"
                    >
                      <span>Explore</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Suspense>
  );
}
