import React from "react";
import { NotificationsPageView } from "../account/notifications/NotificationsPageView.jsx";

export const metadata = {
  title: "Notifications & Alerts | Buybox",
  description: "View real-time updates regarding your purchases, shipments, and account notifications.",
};

export default function StandaloneNotificationsPage() {
  return <NotificationsPageView showSidebar={false} />;
}
