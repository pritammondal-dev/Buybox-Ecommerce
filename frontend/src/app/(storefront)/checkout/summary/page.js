import React from "react";
import { CheckoutSummaryPageView } from "../../../../components/storefront/checkout/CheckoutSummaryPageView.jsx";

export const metadata = {
  title: "Order Summary | Secure Checkout | Buybox",
  description: "Review your order items, delivery speed, and applied coupons on Buybox.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutSummaryPage() {
  return <CheckoutSummaryPageView />;
}
