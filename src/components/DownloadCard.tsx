import { useEffect, useRef } from 'react'
import { formatBytes, type ConvertResult } from '../lib/ffmpeg'

interface Props {
  result: ConvertResult
  originalSize: number
  onReset: () => void
}

export default function DownloadCard({ result, originalSize, onReset }: Props) {
  const ref = useRef<HTMLElement>(null)

  // Bring the finished track into view; it can land below the fold.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result.url])

  return (
    <section ref={ref} className="result" aria-label="Your MP3">
      <audio className="result-player" controls src={result.url} />
      <p className="result-meta">
        Saved as “{result.name}” · source was {formatBytes(originalSize)}
      </p>
      <div className="button-row">
        <button type="button" className="aqua-btn" onClick={onReset}>
          Convert Another
        </button>
        <a className="aqua-btn aqua-btn-blue" href={result.url} download={result.name}>
          Download MP3
        </a>
      </div>
    </section>
  )
}
