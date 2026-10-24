import type { ConverterStatus } from '../hooks/useConverter'
import { formatBytes, type Bitrate, type ConvertResult } from '../lib/ffmpeg'

interface Props {
  status: ConverterStatus
  progress: number
  source: File | null
  result: ConvertResult | null
  bitrate: Bitrate
}

const STAGE: Partial<Record<ConverterStatus, string>> = {
  fetching: 'Getting audio…',
  loading: 'Starting converter…',
  converting: 'Converting…',
}

// The iTunes-style status display at the top of the window.
export default function LcdDisplay({ status, progress, source, result, bitrate }: Props) {
  const busy = status in STAGE
  const percent = Math.round(progress * 100)

  let title = 'MP3 Converter'
  let subtitle = 'Paste a link, pick a quality, click Convert.'
  if (busy) {
    title = STAGE[status]!
    subtitle =
      status === 'fetching'
        ? 'YouTube links can take up to a minute'
        : (source?.name ?? '')
  } else if (status === 'done' && result) {
    title = result.name.replace(/\.mp3$/i, '')
    subtitle = `MP3 · ${bitrate.replace('k', ' kbps')} · ${formatBytes(result.size)}`
  } else if (status === 'error') {
    title = 'Conversion failed'
    subtitle = 'See the details below.'
  }

  return (
    <div className="lcd" role="status" aria-live="polite">
      <span className={`cd${busy ? ' is-spinning' : ''}`} aria-hidden="true" />
      <div className="lcd-text">
        <p className="lcd-title" title={title}>
          {title}
        </p>
        <p className="lcd-sub" title={subtitle}>
          {subtitle}
        </p>
        {busy && (
          <div className="lcd-progress">
            <div className={`aqua-progress${status === 'converting' ? '' : ' is-indeterminate'}`}>
              <div className="aqua-progress-fill" style={status === 'converting' ? { width: `${percent}%` } : undefined} />
            </div>
            {status === 'converting' && <span className="lcd-percent">{percent}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}
