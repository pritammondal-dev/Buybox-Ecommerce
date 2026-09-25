import React, { Suspense } from "react";
import { OrderInvoicePageView } from "./OrderInvoicePageView.jsx";
import { Skeleton } from "../../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Tax Invoice | Buybox",
  description: "Official tax invoice and purchase receipt for your Buybox order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderInvoicePage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      }
    >
      <OrderInvoicePageView orderId={orderId} />
    </Suspense>
  );
}
