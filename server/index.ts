import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { handleFetch } from './fetchProxy.ts'

// Production server: serves the built app from dist/ and the /api/fetch
// download proxy (direct links plus yt-dlp for YouTube-style pages).
// Run with `npm start` after `npm run build`.

const PORT = Number(process.env.PORT ?? 8080)
const DIST = resolve(process.env.DIST_DIR ?? 'dist')
// Other sites allowed to call /api/fetch, e.g. https://diskjoki.netlify.app
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
)
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 30)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

// Simple per-IP limit on /api/fetch so a public deploy isn't an open download relay.
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT
}

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000
  for (const [ip, times] of hits) if (times.every((t) => t < cutoff)) hits.delete(ip)
}, 10 * 60 * 1000).unref()

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req.socket.remoteAddress || 'unknown'
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  let file = normalize(join(DIST, pathname))
  if (!file.startsWith(DIST)) {
    res.statusCode = 403
    return void res.end()
  }

  let info = await stat(file).catch(() => null)
  if (info?.isDirectory()) {
    file = join(file, 'index.html')
    info = await stat(file).catch(() => null)
  }
  if (!info) {
    // Single-page app: unknown paths get the app.
    file = join(DIST, 'index.html')
    info = await stat(file)
  }

  res.statusCode = 200
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  res.setHeader('Content-Length', String(info.size))
  res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache')
  if (req.method === 'HEAD') return void res.end()
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  // ffmpeg.wasm needs a cross-origin isolated page.
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

  const { pathname } = new URL(req.url ?? '/', 'http://localhost')

  if (pathname === '/healthz') {
    res.setHeader('Content-Type', 'text/plain')
    return void res.end('ok')
  }

  if (pathname === '/api/fetch') {
    const origin = req.headers.origin
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Expose-Headers', 'X-Filename')
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      return void res.end()
    }
    if (rateLimited(clientIp(req))) {
      res.statusCode = 429
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      return void res.end('Too many downloads from your connection. Try again later.')
    }
    return void handleFetch(req, res)
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return void res.end()
  }
  serveStatic(req, res).catch(() => {
    res.statusCode = 500
    res.end()
  })
})

server.listen(PORT, () => console.log(`diskjoki listening on http://localhost:${PORT}`))
