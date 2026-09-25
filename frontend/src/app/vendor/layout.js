import { VendorLayoutWrapper } from "@/components/vendor/VendorLayoutWrapper.jsx";

export const metadata = {
  title: {
    default: "Merchant Console | Buybox Marketplace",
    template: "%s | Buybox Merchant Console",
  },
  description: "Dedicated production vendor operations, catalog, inventory, and order management console for Buybox Marketplace merchants.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VendorLayout({ children }) {
  return <VendorLayoutWrapper>{children}</VendorLayoutWrapper>;
}
