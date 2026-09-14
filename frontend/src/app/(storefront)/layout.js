import { StorefrontShell } from "@/components/storefront/layout/StorefrontShell.jsx";

export const metadata = {
  title: {
    default: "Buybox | Modern E-Commerce Platform",
    template: "%s | Buybox",
  },
  description:
    "Discover high-quality electronics, gadgets, audio equipment, and home accessories at Buybox.",
};

export default function StorefrontLayout({ children }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
