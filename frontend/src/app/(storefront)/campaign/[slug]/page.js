import React, { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Tag, ArrowRight } from "lucide-react";
import { campaignService } from "../../../../services/campaign.service.js";
import { CampaignDetailView } from "./CampaignDetailView.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  try {
    const res = await campaignService.getCampaignBySlug(slug);
    const campaign = res?.data;
    if (campaign) {
      return {
        title: `${campaign.name} | Exclusive Deals | Buybox`,
        description:
          campaign.description ||
          `Limited time event: Discover verified discounts during ${campaign.name} on Buybox.`,
      };
    }
  } catch {
    // Return standard fallback
  }

  return {
    title: "Special Campaign | Buybox",
    description: "Limited time deals and promotions on high-fidelity audio equipment at Buybox.",
  };
}

function CampaignFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function CampaignPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";

  let campaign = null;
  try {
    const res = await campaignService.getCampaignBySlug(slug);
    campaign = res?.data;
  } catch {
    notFound();
  }

  if (!campaign) {
    notFound();
  }

  return (
    <Suspense fallback={<CampaignFallback />}>
      <CampaignDetailView campaign={campaign} />
    </Suspense>
  );
}
