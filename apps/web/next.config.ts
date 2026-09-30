import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Trỏ về root monorepo để trace đủ file trong pnpm workspace
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
  typescript: {
    // Ignore type errors during build (as requested)
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.thesportsdb.com" },
      { protocol: "https", hostname: "**.football-data.org" },
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
};

export default nextConfig;