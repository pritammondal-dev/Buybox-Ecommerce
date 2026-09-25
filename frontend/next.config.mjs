/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
