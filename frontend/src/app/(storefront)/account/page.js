import React from "react";
import { AccountDashboardView } from "../../../components/storefront/account/AccountDashboardView.jsx";

export const metadata = {
  title: "My Account | Buybox",
  description: "Manage your Buybox orders, delivery addresses, and customer profile.",
};

export default function AccountPage() {
  return <AccountDashboardView />;
}
