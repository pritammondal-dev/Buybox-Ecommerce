import React, { Suspense } from "react";
import { OrderDetailsPageView } from "../../../../components/storefront/orders/OrderDetailsPageView.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Order Details | Buybox",
  description: "View your Buybox order status, shipment tracking, and purchase receipt.",
  robots: {
    index: false,
    follow: false,
  },
};

function OrderDetailsFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default async function OrderDetailsPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense fallback={<OrderDetailsFallback />}>
      <OrderDetailsPageView orderId={orderId} />
    </Suspense>
  );
}
