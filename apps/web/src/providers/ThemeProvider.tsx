'use client'

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
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
const preferencesChanged = 'football-theme-preferences-change'
const systemThemeQuery = '(prefers-color-scheme: dark)'

function subscribeToPreferences(onChange: () => void) {
  window.addEventListener(preferencesChanged, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(preferencesChanged, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function readPreference(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function parseTeamTheme(value: string | null): TeamTheme | null {
  try {
    const saved = JSON.parse(value ?? 'null') as Partial<TeamTheme> | null
    if (typeof saved?.name === 'string' &&
        typeof saved.accent === 'string' && Object.hasOwn(teamAccents, saved.accent)) {
      return { name: saved.name, accent: saved.accent }
    }
  } catch {
    // Invalid preferences fall back to the default accent.
  }
  return null
}

function subscribeToSystemTheme(onChange: () => void) {
  const media = window.matchMedia(systemThemeQuery)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const getSystemTheme = (): ResolvedTheme => window.matchMedia(systemThemeQuery).matches ? 'dark' : 'light'
const getServerPreference = () => null
const subscribeToNothing = () => () => {}

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'theme' }: {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const clubStorageKey = `${storageKey}-team`
  const storedTheme = useSyncExternalStore(subscribeToPreferences, () => readPreference(storageKey), getServerPreference)
  const storedTeam = useSyncExternalStore(subscribeToPreferences, () => readPreference(clubStorageKey), getServerPreference)
  const theme = storedTheme === 'system' || storedTheme === 'dark' || storedTheme === 'light'
    ? storedTheme
    : defaultTheme
  const resolvedTheme = useSyncExternalStore<ResolvedTheme>(
    theme === 'system' ? subscribeToSystemTheme : subscribeToNothing,
    () => theme === 'system' ? getSystemTheme() : theme,
    () => theme === 'system' ? 'light' : theme,
  )
  const teamTheme = useMemo(() => parseTeamTheme(storedTeam), [storedTeam])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#09090b' : '#ffffff')
  }, [resolvedTheme])

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
        window.dispatchEvent(new Event(preferencesChanged))
      },
      setTeamTheme: (next) => {
        if (next) localStorage.setItem(clubStorageKey, JSON.stringify(next))
        else localStorage.removeItem(clubStorageKey)
        window.dispatchEvent(new Event(preferencesChanged))
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
