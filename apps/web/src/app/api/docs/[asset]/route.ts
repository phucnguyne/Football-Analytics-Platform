import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params
  if (asset === 'init.js') {
    return new Response(`SwaggerUIBundle({
      url: '/api/openapi',
      dom_id: '#swagger-ui',
      validatorUrl: null,
      supportedSubmitMethods: ['get'],
      docExpansion: 'list',
    });`, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } })
  }
  if (asset !== 'swagger-ui.css' && asset !== 'swagger-ui-bundle.js') {
    return new Response('Not found', { status: 404 })
  }

  return new Response(await readFile(join(process.cwd(), "node_modules", "swagger-ui-dist", asset), 'utf8'), {
    headers: {
      'Content-Type': asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
