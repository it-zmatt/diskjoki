import type { Bitrate } from '../lib/ffmpeg'

const OPTIONS: { value: Bitrate; label: string }[] = [
  { value: '128k', label: '128 kbps · compact' },
  { value: '192k', label: '192 kbps · balanced' },
  { value: '320k', label: '320 kbps · max quality' },
]

interface Props {
  value: Bitrate
  disabled?: boolean
  onChange: (value: Bitrate) => void
}

export default function BitrateSelect({ value, disabled, onChange }: Props) {
  return (
    <label className="cassette-select">
      <span className="cassette-select-label">BITRATE</span>
      <span className="cassette-select-window">
        <span className="reel" aria-hidden="true" />
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Bitrate)}>
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="reel" aria-hidden="true" />
      </span>
    </label>
  )
}
