/** @jest-environment jsdom */

require('@testing-library/jest-dom')
const React = require('react')
const { fireEvent, render, screen, within } = require('@testing-library/react')
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query')

jest.mock('next-intl', () => ({
  useTranslations: (namespace) => (key) => require('../messages/en.json')[namespace][key],
  useFormatter: () => ({ dateTime: () => '' }),
}))

const { DataSourceLabel } = require('@/components/ui/DataSourceLabel')
const { PageSkeleton } = require('@/components/ui/Skeleton')
const { GlobalSearch } = require('@/components/navigation/GlobalSearch')

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
