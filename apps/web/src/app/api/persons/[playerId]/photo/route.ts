import { NextRequest, NextResponse } from 'next/server'

interface WikipediaPage {
  title: string
  thumbnail?: { source?: string }
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isMatchingPageTitle(pageTitle: string, playerName: string): boolean {
  const pageTokens = normalizeName(pageTitle).split(/\s+/)
  const playerTokens = normalizeName(playerName).split(/\s+/)
  if (pageTokens.join(' ') === playerTokens.join(' ')) return true

  return (
    pageTokens.length >= 2 &&
    playerTokens.length >= 2 &&
    pageTokens[0] === playerTokens[0] &&
    pageTokens.at(-1) === playerTokens.at(-1)
  )
}

function unavailablePhoto(): NextResponse {
  const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" fill="#e5e7eb"/><circle cx="64" cy="45" r="24" fill="#9ca3af"/><path d="M20 128c2-29 19-44 44-44s42 15 44 44" fill="#9ca3af"/></svg>`
  return new NextResponse(placeholder, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params
  if (!/^\d+$/.test(playerId)) {
    return NextResponse.json({ error: 'invalid player id' }, { status: 400 })
  }

  const name = request.nextUrl.searchParams.get('name')?.trim()
  if (!name) {
    return NextResponse.json({ error: 'player name is required' }, { status: 400 })
  }

  try {
    const url = new URL('https://en.wikipedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', `${name} footballer`)
    url.searchParams.set('gsrnamespace', '0')
    url.searchParams.set('gsrlimit', '8')
    url.searchParams.set('prop', 'pageimages')
    url.searchParams.set('piprop', 'thumbnail')
    url.searchParams.set('pithumbsize', '320')
    url.searchParams.set('format', 'json')

    const response = await fetch(url, {
      headers: { 'User-Agent': 'FootballAnalyticsPlatform/1.0' },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    })
    if (!response.ok) {
      return unavailablePhoto()
    }

    const data = await response.json() as {
      query?: { pages?: Record<string, WikipediaPage> }
    }
    const matchingPage = Object.values(data.query?.pages ?? {}).find((page) =>
      isMatchingPageTitle(page.title, name),
    )
    const imageUrl = matchingPage?.thumbnail?.source
    if (!imageUrl) return unavailablePhoto()

    const parsedImageUrl = new URL(imageUrl)
    if (parsedImageUrl.protocol !== 'https:' ||
        !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(parsedImageUrl.hostname)) {
      return unavailablePhoto()
    }

    return NextResponse.redirect(parsedImageUrl, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch {
    return unavailablePhoto()
  }
}
