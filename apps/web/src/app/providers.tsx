'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/providers/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="football-analytics-theme">
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  )
}
