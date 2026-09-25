import React from "react";
import { ContactSupportPageView } from "../../../contact-support/ContactSupportPageView.jsx";

export const metadata = {
  title: "Order Support | Buybox",
  description: "Get assistance specifically regarding your Buybox order.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderSupportPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.orderId;

  return <ContactSupportPageView prefillOrderId={orderId} />;
}
