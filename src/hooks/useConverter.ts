import { useCallback, useEffect, useRef, useState } from 'react'
import { convertToMp3, loadFfmpeg, type Bitrate, type ConvertResult } from '../lib/ffmpeg'

export type ConverterStatus = 'idle' | 'loading' | 'converting' | 'done' | 'error'

export function useConverter() {
  const [status, setStatus] = useState<ConverterStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConvertResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const resultUrl = useRef<string | null>(null)

  const clearResult = useCallback(() => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = null
    setResult(null)
  }, [])

  // Release the last object URL when the component goes away.
  useEffect(() => clearResult, [clearResult])

  const reset = useCallback(() => {
    clearResult()
    setError(null)
    setProgress(0)
    setStatus('idle')
  }, [clearResult])

  const convert = useCallback(
    async (file: File, bitrate: Bitrate) => {
      clearResult()
      setError(null)
      setProgress(0)
      try {
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

  return { status, progress, result, error, convert, reset }
}
