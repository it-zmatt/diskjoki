import { useCallback, useEffect, useRef, useState } from 'react'
import { convertToMp3, loadFfmpeg, type Bitrate, type ConvertResult } from '../lib/ffmpeg'
import { fetchSource } from '../lib/source'

export type ConverterStatus = 'idle' | 'fetching' | 'loading' | 'converting' | 'done' | 'error'

export function useConverter() {
  const [status, setStatus] = useState<ConverterStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [source, setSource] = useState<File | null>(null)
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultUrl = useRef<string | null>(null)
  // The last downloaded link, so converting again at another quality skips the download.
  const cached = useRef<{ href: string; file: File } | null>(null)

  const clearResult = useCallback(() => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = null
    setResult(null)
  }, [])

  useEffect(() => {
    // Warm up ffmpeg in the background so the first conversion starts sooner.
    loadFfmpeg().catch(() => {})
    return clearResult
  }, [clearResult])

  const reset = useCallback(() => {
    clearResult()
    setError(null)
    setProgress(0)
    setStatus('idle')
  }, [clearResult])

  const convert = useCallback(
    async (url: URL, bitrate: Bitrate) => {
      clearResult()
      setError(null)
      setProgress(0)
      try {
        let file = cached.current?.href === url.href ? cached.current.file : null
        if (!file) {
          setSource(null)
          setStatus('fetching')
          file = await fetchSource(url)
          cached.current = { href: url.href, file }
        }
        setSource(file)

        setStatus('loading')
        await loadFfmpeg()
        setStatus('converting')
        const out = await convertToMp3(file, bitrate, setProgress)
        resultUrl.current = out.url
        setResult(out)
        setStatus('done')
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [clearResult],
  )

  return { status, progress, source, result, error, convert, reset }
}
