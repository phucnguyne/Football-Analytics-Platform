import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/app.css'
import { Providers } from './providers'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import QueryProvider from '@/providers/query-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Football Analytics Pro',
  description:
    'Premium football analytics and data insights platform.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased selection:bg-primary/20 selection:text-primary',
          inter.variable
        )}
      >
        <QueryProvider>
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
                  <div className="mr-4 flex">
                    <a
                      className="mr-6 flex items-center space-x-2"
                      href="/"
                    >
                      <span className="font-bold text-xl tracking-tighter">
                        FA Pro
                      </span>
                    </a>

                    <nav className="flex items-center space-x-6 text-sm font-medium">
                      <a
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                        href="/matches"
                      >
                        Matches
                      </a>

                      <a
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                        href="/teams"
                      >
                        Teams
                      </a>

                      <a
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                        href="/players"
                      >
                        Players
                      </a>
                    </nav>
                  </div>

                  <div className="flex flex-1 items-center justify-end space-x-4">
                    <nav className="flex items-center space-x-2">
                      <ThemeToggle />
                    </nav>
                  </div>
                </div>
              </header>

              <main className="flex-1">{children}</main>
            </div>
          </Providers>
        </QueryProvider>
      </body>
    </html>
  )
}