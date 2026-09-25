import React, { Suspense } from "react";
import { OrderReturnPageView } from "./OrderReturnPageView.jsx";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Return or Replacement | Buybox",
  description: "Submit a return or exchange request for your Buybox order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderReturnPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderReturnPageView orderId={orderId} />
    </Suspense>
  );
}
