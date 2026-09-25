import React, { Suspense } from "react";
import Link from "next/link";
import { Sparkles, Flame, Tag, ArrowRight } from "lucide-react";
import { campaignService } from "../../../services/campaign.service.js";
import { productService } from "../../../services/product.service.js";
import { DealsPageView } from "./DealsPageView.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Today's Deals & Promotions | Buybox",
  description: "Explore limited-time deals, flash markdowns, and verified coupon offers on genuine audio tech at Buybox.",
};

function DealsFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function DealsPage() {
  let campaigns = [];
  let dealProducts = [];

  try {
    const [campaignRes, productRes] = await Promise.allSettled([
      campaignService.getActiveCampaigns(),
      productService.getProducts({ sort: "discount", limit: 16, status: "active" }),
    ]);

    if (campaignRes.status === "fulfilled") {
      campaigns = campaignRes.value?.data || [];
    }
    if (productRes.status === "fulfilled") {
      dealProducts = productRes.value?.data?.products || (Array.isArray(productRes.value?.data) ? productRes.value.data : []);
    }
  } catch {
    // Non-blocking fallback
  }

  return (
    <Suspense fallback={<DealsFallback />}>
      <DealsPageView campaigns={campaigns} dealProducts={dealProducts} />
    </Suspense>
  );
}
