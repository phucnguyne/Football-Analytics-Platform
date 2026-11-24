import path from "path";
import type { NextConfig } from "next";
import { isSupabasePublicKey } from "./src/lib/supabase-public-key";
import createNextIntlPlugin from "next-intl/plugin";

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (supabaseKey && !isSupabasePublicKey(supabaseKey.trim())) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be a Supabase publishable or legacy anon key");
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/libquery_engine-*",
    ],
    "/api/docs/*": [
      "./node_modules/swagger-ui-dist/package.json",
      "./node_modules/swagger-ui-dist/swagger-ui.css",
      "./node_modules/swagger-ui-dist/swagger-ui-bundle.js",
    ],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  // Trỏ về root monorepo để trace đủ file trong pnpm workspace
  outputFileTracingRoot: path.join(process.cwd(), "../../"),

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.thesportsdb.com" },
      { protocol: "https", hostname: "**.football-data.org" },
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
};

export default createNextIntlPlugin()(nextConfig);
