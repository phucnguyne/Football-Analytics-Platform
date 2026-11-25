/** @jest-environment jsdom */

require('@testing-library/jest-dom')
const React = require('react')
const { act, fireEvent, render, screen, within } = require('@testing-library/react')
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query')

jest.mock('next-intl', () => ({
  useTranslations: (namespace) => (key) => require('../messages/en.json')[namespace][key],
  useFormatter: () => ({ dateTime: () => '' }),
  useLocale: () => 'en',
}))

const { DataSourceLabel } = require('@/components/ui/DataSourceLabel')
const { PageSkeleton } = require('@/components/ui/Skeleton')
const { GlobalSearch } = require('@/components/navigation/GlobalSearch')
const { PlayerPhoto } = require('@/components/players/PlayerPhoto')
const { PushSettings } = require('@/components/dashboard/PushSettings')
const { ThemeProvider, useTheme } = require('@/providers/ThemeProvider')

test('data labels distinguish simulated data from recorded data and expose their provider', () => {
  const view = render(React.createElement(DataSourceLabel, { kind: 'real', detail: 'StatsBomb' }))
  expect(screen.getByText('Real Data · StatsBomb')).toBeVisible()
  view.rerender(React.createElement(DataSourceLabel, { kind: 'generated' }))
  expect(screen.getByText('Generated / Mock')).toBeVisible()
})

test('the standings skeleton announces loading and hides decorative placeholders', () => {
  render(React.createElement(PageSkeleton, { variant: 'table' }))
  expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('header search opens a named, focus-managed dialog and renders linked results', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ teams: [{ id: 42, name: 'Arsenal' }], players: [], matches: [] }),
  })
  const previousFetch = global.fetch
  global.fetch = fetchMock
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  try {
    render(React.createElement(QueryClientProvider, { client }, React.createElement(GlobalSearch)))
    fireEvent.click(screen.getByRole('button', { name: 'Search football data' }))
    const dialog = screen.getByRole('dialog', { name: 'Search football data' })
    const field = within(dialog).getByRole('searchbox')
    expect(field).toHaveFocus()
    fireEvent.change(field, { target: { value: 'Arsenal' } })
    expect(await within(dialog).findByRole('link', { name: 'Arsenal' })).toHaveAttribute('href', '/teams/42')
    expect(fetchMock).toHaveBeenCalledWith('/api/search?query=Arsenal', expect.objectContaining({ signal: expect.anything() }))
  } finally {
    client.clear()
    global.fetch = previousFetch
  }
})

test('player photos fall back to the API, then initials, and retry when the source changes', () => {
  const player = { playerId: 42, name: 'Example Player', photo: 'https://media.example.test/player.jpg', className: 'h-8 w-8' }
  const fallbackUrl = new URL('/api/persons/42/photo?name=Example%20Player', window.location.origin).href
  const view = render(React.createElement(PlayerPhoto, player))
  expect(screen.getByRole('img', { name: player.name })).toHaveAttribute('src', player.photo)

  fireEvent.error(screen.getByRole('img', { name: player.name }))
  expect(screen.getByRole('img', { name: player.name }).src).toBe(fallbackUrl)
  fireEvent.error(screen.getByRole('img', { name: player.name }))
  expect(screen.getByLabelText('Example Player photo unavailable')).toHaveTextContent('EP')

  view.rerender(React.createElement(PlayerPhoto, { ...player, photo: null }))
  expect(screen.getByRole('img', { name: player.name }).src).toBe(fallbackUrl)
})

test('the saved club accent follows the system theme until a fixed theme is selected', () => {
  const root = document.documentElement
  const storageKey = 'test-theme'
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia')
  const listeners = new Set()
  const media = {
    matches: false,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => media })
  localStorage.setItem(`${storageKey}-team`, JSON.stringify({ name: 'Example FC', accent: 'red' }))

  function ThemeControl() {
    const { setTheme } = useTheme()
    return React.createElement('button', { onClick: () => setTheme('light') }, 'Use light theme')
  }

  const view = render(React.createElement(ThemeProvider, { storageKey }, React.createElement(ThemeControl)))
  try {
    expect(root).toHaveClass('light')
    expect(root.style.getPropertyValue('--color-primary')).toBe('#a61d31')

    act(() => {
      media.matches = true
      listeners.forEach((listener) => listener())
    })
    expect(root).toHaveClass('dark')
    expect(root.style.getPropertyValue('--color-primary')).toBe('#ff9da7')

    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }))
    expect(root).toHaveClass('light')
    expect(localStorage.getItem(storageKey)).toBe('light')
    expect(listeners.size).toBe(0)
  } finally {
    view.unmount()
    localStorage.removeItem(storageKey)
    localStorage.removeItem(`${storageKey}-team`)
    root.classList.remove('light', 'dark')
    for (const property of ['--color-primary', '--color-ring', '--color-primary-foreground']) root.style.removeProperty(property)
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia)
    else delete window.matchMedia
  }
})

test('push settings restore an existing subscription and hide controls when the public key is removed', async () => {
  const endpoint = 'https://push.example.test/subscription'
  const register = jest.fn().mockResolvedValue({
    active: {},
    pushManager: { getSubscription: async () => ({ endpoint }) },
  })
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) })
  const browserMocks = [
    [navigator, 'serviceWorker', { register }],
    [window, 'PushManager', {}],
    [window, 'Notification', { permission: 'granted' }],
    [global, 'fetch', fetchMock],
  ]
  const originals = browserMocks.map(([target, key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key)
    Object.defineProperty(target, key, { configurable: true, value })
    return [target, key, descriptor]
  })

  try {
    const view = render(React.createElement(PushSettings, { publicKey: 'example-key' }))
    expect(await screen.findByRole('button', { name: 'Disable match notifications' })).toBeEnabled()
    expect(register).toHaveBeenCalledWith('/sw.js')
    expect(fetchMock).toHaveBeenCalledWith('/api/push/subscription', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ endpoint }),
    }))

    view.rerender(React.createElement(PushSettings, { publicKey: null }))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Push notifications are unavailable on this device.')).toBeVisible()
  } finally {
    for (const [target, key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else delete target[key]
    }
  }
})
