'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { teamAccents, type TeamTheme } from '@/lib/team-theme'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: ResolvedTheme
  teamTheme: TeamTheme | null
  setTeamTheme: (theme: TeamTheme | null) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'theme' }: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')
  const [teamTheme, setTeamTheme] = useState<TeamTheme | null>(null)
  const clubStorageKey = `${storageKey}-team`

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'system' || stored === 'dark' || stored === 'light') setTheme(stored)
    try {
      const saved = JSON.parse(localStorage.getItem(clubStorageKey) ?? 'null')
      if (typeof saved?.name === 'string' && Object.hasOwn(teamAccents, saved.accent)) setTeamTheme(saved)
    } catch {
      // Invalid preferences fall back to the default theme.
    }
  }, [storageKey, clubStorageKey])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? media.matches ? 'dark' : 'light' : theme
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
      setResolvedTheme(resolved)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#09090b' : '#ffffff')
    }
    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const style = document.documentElement.style
    if (teamTheme) {
      const accent = teamAccents[teamTheme.accent][resolvedTheme]
      style.setProperty('--color-primary', accent)
      style.setProperty('--color-ring', accent)
      style.setProperty('--color-primary-foreground', resolvedTheme === 'dark' ? '#101625' : '#ffffff')
    } else {
      style.removeProperty('--color-primary')
      style.removeProperty('--color-ring')
      style.removeProperty('--color-primary-foreground')
    }
  }, [resolvedTheme, teamTheme])

  return (
    <ThemeContext.Provider value={{
      theme, resolvedTheme, teamTheme,
      setTheme: (next) => {
        localStorage.setItem(storageKey, next)
        setTheme(next)
      },
      setTeamTheme: (next) => {
        if (next) localStorage.setItem(clubStorageKey, JSON.stringify(next))
        else localStorage.removeItem(clubStorageKey)
        setTeamTheme(next)
      },
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
