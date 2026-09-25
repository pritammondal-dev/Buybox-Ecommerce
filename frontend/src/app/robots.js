export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://buybox.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/administrator",
          "/administrator/*",
          "/superadmin",
          "/superadmin/*",
          "/vendor",
          "/vendor/*",
          "/account",
          "/account/*",
          "/checkout",
          "/checkout/*",
          "/auth",
          "/auth/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
