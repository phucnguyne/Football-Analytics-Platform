import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

const safeMethods = new Set(['GET', 'HEAD'])
const privateApi = /^\/api\/(?:auth|dashboard|favorites|push|internal|platform-stats|predictions)(?:\/|$)/

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  if (path === '/api' || path.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const canonical = new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000').origin
    const foreign = origin !== null && origin !== canonical
    const browserWrite = !safeMethods.has(request.method) && !path.startsWith('/api/internal/')
    if (foreign || (browserWrite && (origin === null || request.headers.get('sec-fetch-site') === 'cross-site'))) {
      return NextResponse.json({ error: 'Forbidden origin' }, {
        status: 403,
        headers: { 'Cache-Control': 'no-store', Vary: 'Origin' },
      })
    }

    const response = NextResponse.next()
    if (privateApi.test(path)) response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  const nonce = randomBytes(18).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const connections = supabase
    ? [new URL(supabase).origin, new URL(supabase).origin.replace(/^http/, 'ws')].join(' ')
    : ''
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${connections}${dev ? ' ws: wss:' : ''}`.trim(),
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  const headers = new Headers(request.headers)
  headers.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next/|\\.well-known/|.*\\.[^/]+$).*)'],
}
