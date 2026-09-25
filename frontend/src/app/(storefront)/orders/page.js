import React from "react";
import { OrdersPageView } from "../../../components/storefront/account/OrdersPageView.jsx";

export const metadata = {
  title: "My Orders | Buybox",
  description: "View and track your previous Buybox orders, download invoices, and initiate returns.",
};

export default function OrdersPage() {
  return <OrdersPageView />;
}
