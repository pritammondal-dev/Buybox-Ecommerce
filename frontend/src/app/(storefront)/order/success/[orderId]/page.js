import React, { Suspense } from "react";
import { OrderSuccessPageView } from "../../../../../components/storefront/orders/OrderSuccessPageView.jsx";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Order Confirmed | Buybox",
  description: "Your Buybox order has been successfully placed.",
  robots: {
    index: false,
    follow: false,
  },
};

function SuccessPageFallback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-4">
      <Skeleton className="size-16 rounded-full mx-auto" />
      <Skeleton className="h-6 w-56 mx-auto" />
      <Skeleton className="h-4 w-80 mx-auto" />
      <Skeleton className="h-64 w-full rounded-2xl mt-8" />
    </div>
  );
}

export default async function OrderSuccessPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense fallback={<SuccessPageFallback />}>
      <OrderSuccessPageView orderId={orderId} />
    </Suspense>
  );
}
