import React, { Suspense } from "react";
import { campaignService } from "../../../services/campaign.service.js";
import { CouponsPageView } from "./CouponsPageView.jsx";
import { Skeleton } from "../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Coupons & Promotional Vouchers | Buybox",
  description: "Browse valid discount coupons for your Buybox orders. Copy coupon codes and save on verified audio equipment.",
};

function CouponsFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default async function CouponsPage() {
  let coupons = [];

  try {
    const res = await campaignService.getActiveCoupons();
    coupons = res?.data || [];
  } catch {
    // Non-blocking fallback
  }

  return (
    <Suspense fallback={<CouponsFallback />}>
      <CouponsPageView coupons={coupons} />
    </Suspense>
  );
}
