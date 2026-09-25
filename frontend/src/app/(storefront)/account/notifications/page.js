import React from "react";
import { NotificationsPageView } from "./NotificationsPageView.jsx";

export const metadata = {
  title: "Notifications | Buybox",
  description: "View your order updates, delivery tracking alerts, and promotional announcements.",
};

export default function NotificationsPage() {
  return <NotificationsPageView showSidebar={true} />;
}
