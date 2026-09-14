import React, { Suspense } from "react";
import { CheckoutSuccessView } from "../../../../components/storefront/checkout/CheckoutSuccessView.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Order Confirmed | Buybox",
  description: "Your Buybox order has been confirmed.",
};

function SuccessFallback() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <Skeleton className="size-16 rounded-full mx-auto mb-4" />
      <Skeleton className="h-6 w-48 mx-auto mb-2" />
      <Skeleton className="h-4 w-72 mx-auto" />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <CheckoutSuccessView />
    </Suspense>
  );
}
