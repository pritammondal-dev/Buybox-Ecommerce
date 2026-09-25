import React, { Suspense } from "react";
import { OrderTrackingPageView } from "./OrderTrackingPageView.jsx";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Track Shipment | Buybox",
  description: "Live package milestone tracking and carrier details for your Buybox order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderTrackingPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderTrackingPageView orderId={orderId} />
    </Suspense>
  );
}
