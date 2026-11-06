/** @type {import('next').NextConfig} */

// Resolve backend origin for Next.js internal rewrites and proxying
const rawBackendOrigin =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(\/v1)?\/?$/, "") : null);

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !rawBackendOrigin && !process.env.NEXT_PHASE) {
  console.warn(
    "[Buybox Warning] Production environment detected without explicit INTERNAL_API_URL or NEXT_PUBLIC_BACKEND_URL. " +
    "Proxy rewrites will fall back to local development origin. Ensure proper ingress is configured."
  );
}

const backendOrigin = (rawBackendOrigin || "http://localhost:5000").replace(/\/+$/, "");
const hasCustomBackend = Boolean(rawBackendOrigin);

// Parse dynamic image remote patterns from environment
function buildImageRemotePatterns() {
  const patterns = [
    // Local development hosts
    { protocol: "http", hostname: "localhost", port: "5000", pathname: "/**" },
    { protocol: "http", hostname: "127.0.0.1", port: "5000", pathname: "/**" },
    { protocol: "http", hostname: "localhost", port: "3000", pathname: "/**" },
    { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/**" },
    // Standard AWS S3 & Cloudflare R2
    { protocol: "https", hostname: "*.amazonaws.com", pathname: "/**" },
    { protocol: "https", hostname: "s3.amazonaws.com", pathname: "/**" },
    { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
    { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
  ];

  // Helper to safely parse and add hostname
  const addHost = (urlStr) => {
    if (!urlStr) return;
    try {
      const parsed = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`);
      const host = parsed.hostname.toLowerCase();
      // Block sensitive cloud metadata and local link-local ranges
      if (host === "169.254.169.254" || host.includes("metadata.google.internal")) return;
      const protocol = parsed.protocol ? parsed.protocol.replace(":", "") : "https";
      patterns.push({
        protocol,
        hostname: host,
        port: parsed.port || "",
        pathname: "/**",
      });
    } catch {}
  };

  // Add configured CDN URL if present
  addHost(process.env.NEXT_PUBLIC_CDN_URL || process.env.CDN_URL);

  // Add configured S3 public base URL if present
  addHost(process.env.S3_PUBLIC_BASE_URL);

  // Add any extra comma-separated allowed image hosts
  const extraHosts = (process.env.ALLOWED_IMAGE_HOSTS || process.env.NEXT_PUBLIC_ALLOWED_IMAGE_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  for (const h of extraHosts) {
    addHost(h);
  }

  return patterns;
}

const nextConfig = {
  images: {
    remotePatterns: buildImageRemotePatterns(),
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/administrator/dashboard",
        permanent: false,
      },
      {
        source: "/admin/login",
        destination: "/administrator/login",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/administrator/:path*",
        permanent: false,
      },
      {
        source: "/superadmin",
        destination: "/administrator/dashboard",
        permanent: false,
      },
      {
        source: "/superadmin/:path*",
        destination: "/administrator/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        // Fallback for local development: destination: "http://localhost:5000/uploads/:path*"
        destination: hasCustomBackend
          ? `${backendOrigin}/uploads/:path*`
          : "http://localhost:5000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
