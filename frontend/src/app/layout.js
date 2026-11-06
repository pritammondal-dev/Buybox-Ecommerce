import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import { getApiBaseUrl, resolveMediaUrl } from "@/lib/config/api-config.js";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata() {
  const defaultTitle = "Buybox | Modern E-Commerce Platform";
  const defaultDescription = "Next-generation multi-vendor e-commerce platform.";
  const defaultFavicon = "/favicon.ico";

  try {
    const apiUrl = getApiBaseUrl();

    const res = await fetch(`${apiUrl}/storefront/settings`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    }).catch(() => null);

    if (res && res.ok) {
      const json = await res.json();
      const settings = json?.data;
      const favicon = resolveMediaUrl(settings?.faviconUrl) || defaultFavicon;
      const title = settings?.storeName
        ? `${settings.storeName} | Modern E-Commerce Platform`
        : defaultTitle;
      const description = settings?.tagline || defaultDescription;

      return {
        title,
        description,
        icons: {
          icon: favicon,
          shortcut: favicon,
          apple: favicon,
        },
      };
    }
  } catch {
    // Graceful fallback to default metadata
  }

  return {
    title: defaultTitle,
    description: defaultDescription,
    icons: {
      icon: defaultFavicon,
      shortcut: defaultFavicon,
      apple: defaultFavicon,
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary"
      >
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
