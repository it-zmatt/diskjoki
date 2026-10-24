import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// Server-side fetch that refuses to reach this machine or the local network.
// Shared by the Vite dev/preview proxy and the Netlify function.

const MAX_REDIRECTS = 5

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

export class ProxyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function fetchPublic(start: URL): Promise<Response> {
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
