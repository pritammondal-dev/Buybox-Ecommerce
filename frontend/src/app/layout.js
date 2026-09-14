import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Buybox | Modern E-Commerce Platform",
  description: "Next-generation multi-vendor e-commerce platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/10 selection:text-primary">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
