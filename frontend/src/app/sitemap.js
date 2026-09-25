export default function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://buybox.com";
  const now = new Date().toISOString();

  const publicRoutes = [
    { path: "", changeFrequency: "daily", priority: 1.0 },
    { path: "/deals", changeFrequency: "daily", priority: 0.9 },
    { path: "/flash-sale", changeFrequency: "daily", priority: 0.9 },
    { path: "/offers", changeFrequency: "daily", priority: 0.8 },
    { path: "/about", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/contact-support", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/cancellation-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/shipping-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/return-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.3 },
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
