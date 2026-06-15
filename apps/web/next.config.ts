import type { NextConfig } from 'next';
   const nextConfig: NextConfig = {
      typescript: {
      // Ignore type errors during build (as requested)
      ignoreBuildErrors: true,
      },
      images: {
         remotePatterns: [
            { protocol: 'https', hostname: '**.thesportsdb.com' },
            { protocol: 'https', hostname: '**.football-data.org' },
            { protocol: 'https', hostname: 'crests.football-data.org' },
         ],
      },
   };
   export default nextConfig;