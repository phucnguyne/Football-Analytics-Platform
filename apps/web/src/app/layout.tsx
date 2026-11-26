import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Inter } from 'next/font/google'
import '@/styles/app.css'
import { Providers } from './providers'
import { Header } from '@/components/navigation/Header'
import { cn } from '@/lib/utils'
import QueryProvider from '@/providers/query-provider'
import { Toaster } from 'react-hot-toast'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
})

const title = 'Football Analytics Pro'
const description = 'Follow live football scores, explore match insights, and compare player statistics.'
const socialPreview = {
  url: '/social-preview.jpg',
  width: 1200,
  height: 630,
  alt: 'Football Analytics Pro — live scores, match insights, and player stats',
}
const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000')),
  title,
  description,
  openGraph: { type: 'website', siteName: title, title, description, images: [socialPreview] },
  twitter: { card: 'summary_large_image', title, description, images: [socialPreview] },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('Navigation')])

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased selection:bg-primary/20 selection:text-primary',
          inter.variable
        )}
      >
        <NextIntlClientProvider>
          <QueryProvider>
            <Providers>
              <div className="relative flex min-h-screen flex-col">
                <Header />
                <main className="flex-1">{children}</main>
                <footer className="border-t px-4 py-4 text-center text-sm text-muted-foreground">
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- The route serves a standalone HTML document. */}
                  <a className="hover:text-primary hover:underline" href="/api/docs">{t('apiDocs')}</a>
                </footer>
              </div>
            </Providers>
          </QueryProvider>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  )
}
