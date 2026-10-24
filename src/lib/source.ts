export function parseLink(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

function nameFromUrl(url: URL, type: string): string {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
  if (last.includes('.')) return last
  const ext = type.split('/')[1]?.split(';')[0]
  return `${last || 'track'}${ext ? `.${ext}` : ''}`
}

/**
 * Downloads a link into a File. Tries the link directly first; if the host
 * blocks cross-origin requests (fetch() throws a TypeError) or the link is a
 * web page rather than a file, goes through the dev server's proxy, which
 * pulls the audio out of pages with yt-dlp.
 */
export async function fetchSource(url: URL): Promise<File> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`The link answered ${res.status} ${res.statusText}.`)
    const blob = await res.blob()
    if (!blob.type.startsWith('text/html')) return new File([blob], nameFromUrl(url, blob.type), { type: blob.type })
  } catch (err) {
    if (!(err instanceof TypeError)) throw err
  }

  let res: Response
  try {
    res = await fetch(`/api/fetch?url=${encodeURIComponent(url.href)}`)
  } catch {
    throw new Error('Could not reach the converter server. Make sure `npm run dev` is running, then reload the page.')
  }
  // A host without the proxy (a plain static deploy) answers with its own HTML page.
  if (res.headers.get('content-type')?.includes('text/html')) {
    throw new Error(
      'This link’s host blocks downloads from other sites, and the download helper isn’t running here. Try a direct link from a host that allows it, or run the app locally with npm run dev.',
    )
  }
  if (!res.ok) throw new Error((await res.text()) || `Download failed (${res.status}).`)
  const blob = await res.blob()
  const header = res.headers.get('X-Filename')
  return new File([blob], header ? decodeURIComponent(header) : nameFromUrl(url, blob.type), { type: blob.type })
}
