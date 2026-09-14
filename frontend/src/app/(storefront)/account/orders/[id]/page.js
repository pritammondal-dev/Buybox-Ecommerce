import React from "react";
import { OrderDetailView } from "../../../../../components/storefront/account/OrderDetailView.jsx";

export const metadata = {
  title: "Order Details | Buybox",
  description: "View order receipt and status on Buybox.",
};

export default async function OrderDetailPage({ params }) {
  const resolvedParams = await params;
  const orderId = resolvedParams?.id || "";

  return <OrderDetailView orderId={orderId} />;
}
