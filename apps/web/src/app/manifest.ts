import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Football Analytics Pro',
    short_name: 'FA Pro',
    description: 'Football scores, statistics, and match analysis.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#101625',
    theme_color: '#101625',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
