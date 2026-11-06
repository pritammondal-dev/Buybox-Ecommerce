import React from "react";
import { StorefrontMerchandisingManager } from "@/components/admin/cms/StorefrontMerchandisingManager.jsx";

export const metadata = {
  title: "Storefront Merchandising Control Center | Buybox Superadmin",
  description:
    "Centralized management of homepage product sections, auto-ranking algorithms, scoped theme styles, and flash merchandising.",
};

export default function AdminMerchandisingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <StorefrontMerchandisingManager />
    </div>
  );
}
