import React from "react";
import { CheckoutAddressPageView } from "../../../../components/storefront/checkout/CheckoutAddressPageView.jsx";

export const metadata = {
  title: "Delivery Address | Secure Checkout | Buybox",
  description: "Select or add your delivery address to complete your order on Buybox.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutAddressPage() {
  return <CheckoutAddressPageView />;
}
