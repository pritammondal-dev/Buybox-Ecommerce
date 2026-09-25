import { AdminShell } from "@/components/admin/layout/AdminShell.jsx";

export const metadata = {
  title: {
    default: "Admin Console | Buybox",
    template: "%s | Buybox Admin",
  },
  description: "Operational management console for the Buybox platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
