"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Calendar, Tag } from "lucide-react";
import { SectionContainer } from "./SectionContainer.jsx";
import { formatCampaignEndDate } from "../../../utils/formatDate.js";

export function ActiveCampaignsSection({ campaigns = [] }) {
  const [failedBanners, setFailedBanners] = useState({});

  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return null;
  }

  const headerRight = (
    <Link
      href="/campaigns"
      id="home-campaigns-view-all-link"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004D38] hover:text-[#003B2B] hover:underline transition-colors"
    >
      <span>All Campaigns ({campaigns.length})</span>
      <ArrowRight className="size-3.5" />
    </Link>
  );

  return (
    <SectionContainer
      title="Featured Campaigns & Special Offers"
      subtitle="Exclusive limited-time seasonal events and brand partnership promotions."
      badge="LIVE OFFERS"
      badgeColor="bg-amber-400 text-slate-950 font-extrabold"
      icon={Sparkles}
      iconBg="bg-amber-100 text-amber-700"
      variant="deals"
      headerRight={headerRight}
      ariaLabel="Featured Campaigns"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {campaigns.slice(0, 3).map((camp) => {
          const cId = camp._id || camp.id;
          const slug = camp.slug || cId;
          const productCount =
            Array.isArray(camp.productIds) && camp.productIds.length > 0
              ? camp.productIds.length
              : camp.productCount || 0;
          const hasBanner = Boolean(camp.bannerUrl && !failedBanners[slug]);
          const formattedEndDate = formatCampaignEndDate(camp.endsAt);
          const hasEndDate = Boolean(
            camp.endsAt && (typeof camp.endsAt === "string" ? camp.endsAt.trim() : true)
          );

          return (
            <div
              key={`home-camp-${slug}`}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md hover:border-[#004D38]/40 transition-all duration-200"
            >
              <div>
                <Link
                  href={`/campaign/${slug}`}
                  className="block relative h-40 w-full overflow-hidden bg-slate-100"
                >
                  {hasBanner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={camp.bannerUrl}
                      alt={camp.name}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={() =>
                        setFailedBanners((prev) => ({ ...prev, [slug]: true }))
                      }
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-[#004D38] to-slate-900 p-6 text-center text-white">
                      <Sparkles className="size-8 text-amber-300 opacity-80 mb-2" />
                      <span className="font-black text-sm tracking-tight line-clamp-2">
                        {camp.name}
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                      {camp.type === "seasonal"
                        ? "Seasonal Event"
                        : camp.type === "flash_sale"
                        ? "Flash Sale"
                        : "Special Offer"}
                    </span>
                  </div>
                </Link>

                <div className="p-5 space-y-2.5">
                  <Link
                    href={`/campaign/${slug}`}
                    className="block group-hover:text-[#004D38] transition-colors"
                  >
                    <h3 className="text-base font-black text-slate-900 line-clamp-1">
                      {camp.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {camp.description || "Limited-time deals on selected brand collections."}
                  </p>

                  {productCount > 0 && (
                    <div className="pt-1">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {productCount} {productCount === 1 ? "Product" : "Products"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex items-center justify-between gap-3">
                {formattedEndDate ? (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
                    <Calendar className="size-3.5 text-slate-400 shrink-0" />
                    <span>Ends {formattedEndDate}</span>
                  </div>
                ) : !hasEndDate ? (
                  <span className="text-[11px] text-emerald-700 font-bold">Active Now</span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">Limited Time</span>
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
    </SectionContainer>
  );
}

export default ActiveCampaignsSection;
