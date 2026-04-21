import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.tablecrm.com",
      },
      {
        protocol: "https",
        hostname: "app.tablecrm.com",
      },
    ],
  },
};

export default nextConfig;
