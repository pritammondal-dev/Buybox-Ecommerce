import React from "react";
import { BannerSlotManager } from "@/components/admin/cms/BannerSlotManager.jsx";

export const metadata = {
  title: "Banner Slot Manager",
  description: "Manage homepage promotional banner placements and artwork without code redeployment.",
};

export default function AdminBannersPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <BannerSlotManager />
    </div>
  );
}
