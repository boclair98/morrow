import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Production is a static export served by nginx. Development keeps the
  // Next.js server so /api requests can proxy to the local Spring Boot container.
  ...(isDevelopment
    ? {
        async rewrites() {
          const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
          return [
            {
              source: "/api/:path*",
              destination: `${backend}/api/:path*`,
            },
          ];
        },
      }
    : { output: "export" as const }),
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
