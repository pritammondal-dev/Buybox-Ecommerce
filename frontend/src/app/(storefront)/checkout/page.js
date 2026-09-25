import React from "react";
import { CheckoutAddressPageView } from "../../../components/storefront/checkout/CheckoutAddressPageView.jsx";

export const metadata = {
  title: "Secure Checkout | Buybox",
  description: "Complete your purchase securely on Buybox.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return <CheckoutAddressPageView />;
}
