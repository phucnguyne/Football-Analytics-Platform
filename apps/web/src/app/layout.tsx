import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
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

export const metadata: Metadata = {
  title: 'Football Analytics Pro',
  description:
    'Premium football analytics and data insights platform.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()

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
              </div>
            </Providers>
          </QueryProvider>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  )
}
