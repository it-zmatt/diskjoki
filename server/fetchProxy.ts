import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// Lets the browser load file links whose hosts don't send CORS headers:
// GET /api/fetch?url=<link> downloads the file on the dev/preview server
// and streams it back same-origin. When the link is a web page (YouTube,
// SoundCloud, ...) it hands the page to yt-dlp and returns the audio track.

const MAX_BYTES = 500 * 1024 * 1024
const MAX_REDIRECTS = 5
const YT_DLP_TIMEOUT_MS = 5 * 60 * 1000

const AUDIO_TYPES: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
}

function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

// Refuse anything that resolves to this machine or the local network.
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyError(400, 'Only http and https links are supported.')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (addresses.length === 0) throw new ProxyError(400, `Could not resolve ${host}.`)
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ProxyError(400, 'Links to local or private network addresses are not allowed.')
  }
}

class ProxyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function fetchPublic(start: URL): Promise<Response> {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url)
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    return res
  }
  throw new ProxyError(502, 'Too many redirects.')
}

// Turns yt-dlp's stderr into one sentence a person can act on.
function explainYtDlpError(stderr: string): string {
  const line = stderr.split('\n').find((l) => l.startsWith('ERROR:')) ?? ''
  const reason = line
    .replace(/^ERROR:\s*/, '')
    .replace(/^\[[^\]]+\]\s*[^:]*:\s*/, '')
    .replace(/\s*\(caused by[\s\S]*$/, '')
    .trim()
  if (/unsupported url/i.test(reason)) {
    return 'That site isn’t supported. Try a YouTube or SoundCloud link, or a direct link to an audio file.'
  }
  if (/private video|video unavailable|not available/i.test(reason)) return 'That video is private or unavailable.'
  if (/sign in|age-restricted|confirm your age/i.test(reason)) return 'That video needs a signed-in account, so it can’t be downloaded here.'
  const http = reason.match(/HTTP Error (\d{3})/)
  if (http) return `The site answered with an error (${http[1]}). Check the link and try again.`
  return reason ? `${reason.replace(/\.?$/, '.')}` : 'Couldn’t find any audio on that page.'
}

function runYtDlp(url: URL, dir: string): Promise<void> {
  const args = [
    '--no-playlist',
    '--format', 'bestaudio[ext=m4a]/bestaudio',
    '--max-filesize', '500M',
    '--output', join(dir, '%(title).150B.%(ext)s'),
    '--no-progress',
    '--quiet',
    '--no-warnings',
    '--',
    url.href,
  ]
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    const timer = setTimeout(() => child.kill('SIGKILL'), YT_DLP_TIMEOUT_MS)
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(
        err.code === 'ENOENT'
          ? new ProxyError(501, 'That link is a web page, and yt-dlp is not installed to pull audio from it (brew install yt-dlp).')
          : err,
      )
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve()
      reject(new ProxyError(422, explainYtDlpError(stderr)))
    })
  })
}

async function extractAudio(url: URL, res: ServerResponse): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'mp3-converter-'))
  const cleanup = () => void rm(dir, { recursive: true, force: true })
  try {
    await runYtDlp(url, dir)
    const [name] = await readdir(dir)
    if (!name) throw new ProxyError(413, 'No audio found on that page, or it is larger than 500 MB.')
    const path = join(dir, name)
    const { size } = await stat(path)

    res.statusCode = 200
    res.setHeader('Content-Type', AUDIO_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Content-Length', String(size))
    res.setHeader('X-Filename', encodeURIComponent(name))
    const file = createReadStream(path)
    // 'close' fires whether the download finished or the browser went away.
    res.on('close', () => {
      file.destroy()
      cleanup()
    })
    file.on('error', () => res.destroy())
    file.pipe(res)
  } catch (err) {
    cleanup()
    throw err
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const fail = (status: number, message: string) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(message)
  }

  if (req.method !== 'GET') return fail(405, 'Method not allowed.')

  const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
  let url: URL
  try {
    url = new URL(target ?? '')
  } catch {
    return fail(400, 'That does not look like a valid URL.')
  }

  try {
    const upstream = await fetchPublic(url)
    if (upstream.headers.get('content-type')?.includes('text/html')) {
      await upstream.body?.cancel()
      return await extractAudio(url, res)
    }
    if (!upstream.ok || !upstream.body) {
      return fail(502, `The server answered ${upstream.status} ${upstream.statusText}.`)
    }
    const length = Number(upstream.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) return fail(413, 'That file is larger than 500 MB.')

    res.statusCode = 200
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream')
    if (length) res.setHeader('Content-Length', String(length))

    let received = 0
    const body = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream)
    body.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (received > MAX_BYTES) body.destroy(new Error('too large'))
    })
    body.on('error', () => res.destroy())
    body.pipe(res)
  } catch (err) {
    if (err instanceof ProxyError) return fail(err.status, err.message)
    fail(502, 'Could not download that link.')
  }
}

export function fetchProxy(): Plugin {
  const route = (req: IncomingMessage, res: ServerResponse) => void handle(req, res)

  // Block bodies on purpose: a hook that returns a function is treated as a post hook.
  return {
    name: 'mp3-converter-fetch-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch', route)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/fetch', route)
    },
  }
}
