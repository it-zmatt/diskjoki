import { fetchPublic, ProxyError } from '../../server/safeFetch.ts'

// Netlify version of /api/fetch for the deployed site. It relays direct file
// links whose hosts block cross-origin downloads. It can't run yt-dlp, so web
// page links (YouTube, SoundCloud, ...) only work with the local dev server.

// Netlify caps streamed function responses at 20 MB.
const MAX_BYTES = 20 * 1024 * 1024

const text = (status: number, message: string) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return text(405, 'Method not allowed.')

  let url: URL
  try {
    url = new URL(new URL(req.url).searchParams.get('url') ?? '')
  } catch {
    return text(400, 'That does not look like a valid URL.')
  }

  try {
    const upstream = await fetchPublic(url)
    if (upstream.headers.get('content-type')?.includes('text/html')) {
      await upstream.body?.cancel()
      return text(
        422,
        'That link is a web page (like YouTube), not an audio file. Page links only work when you run the app locally with npm run dev and yt-dlp; here, use a direct link to an audio or video file.',
      )
    }
    if (!upstream.ok || !upstream.body) {
      return text(502, `The link answered ${upstream.status} ${upstream.statusText}.`)
    }
    const length = Number(upstream.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) {
      return text(413, 'That file is larger than 20 MB, the limit on this site. Run the app locally for bigger files.')
    }

    let received = 0
    const capped = upstream.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength
          if (received > MAX_BYTES) controller.error(new Error('too large'))
          else controller.enqueue(chunk)
        },
      }),
    )
    const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' })
    if (length) headers.set('Content-Length', String(length))
    return new Response(capped, { status: 200, headers })
  } catch (err) {
    if (err instanceof ProxyError) return text(err.status, err.message)
    return text(502, 'Could not download that link.')
  }
}

export const config = { path: '/api/fetch' }
