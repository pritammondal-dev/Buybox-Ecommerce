import React, { Suspense } from "react";
import { PaymentMethodsPageView } from "./PaymentMethodsPageView.jsx";
import { Skeleton } from "../../../../components/ui/Skeleton.jsx";

export const metadata = {
  title: "Payment Methods | Account | Buybox",
  description: "Manage your saved payment methods and payment preferences securely on Buybox.",
};

export default function AccountPaymentMethodsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      }
    >
      <PaymentMethodsPageView />
    </Suspense>
  );
}
