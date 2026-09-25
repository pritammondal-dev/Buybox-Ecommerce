import React, { Suspense } from "react";
import { OrderCancelPageView } from "./OrderCancelPageView.jsx";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Cancel Order | Buybox",
  description: "Request cancellation for your Buybox order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderCancelPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderCancelPageView orderId={orderId} />
    </Suspense>
  );
}
