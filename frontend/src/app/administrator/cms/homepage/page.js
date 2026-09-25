import React from "react";
import { BannerSlotManager } from "@/components/admin/cms/BannerSlotManager.jsx";

export const metadata = {
  title: "Homepage CMS & Banner Slots",
  description: "Manage homepage promotional artwork and layout slots.",
};

export default function AdminCmsHomepagePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <BannerSlotManager />
    </div>
  );
}
