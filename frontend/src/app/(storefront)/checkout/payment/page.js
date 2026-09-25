import React from "react";
import { CheckoutPaymentPageView } from "../../../../components/storefront/checkout/CheckoutPaymentPageView.jsx";

export const metadata = {
  title: "Payment | Secure Checkout | Buybox",
  description: "Choose your preferred payment method to complete your purchase on Buybox.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPaymentPage() {
  return <CheckoutPaymentPageView />;
}
