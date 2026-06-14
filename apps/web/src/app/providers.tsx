'use client'

import { ThemeProvider } from '@/providers/ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="football-analytics-theme">
      {children}
    </ThemeProvider>
  )
}
