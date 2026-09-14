import React from "react";
import { OrdersPageView } from "../../../../components/storefront/account/OrdersPageView.jsx";

export const metadata = {
  title: "My Orders | Buybox",
  description: "View and track your previous Buybox orders.",
};

export default function OrdersPage() {
  return <OrdersPageView />;
}
