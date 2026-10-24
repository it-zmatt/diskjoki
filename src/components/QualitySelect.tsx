import type { Bitrate } from '../lib/ffmpeg'

const OPTIONS: { value: Bitrate; name: string; size: string }[] = [
  { value: '128k', name: 'Small', size: '~1 MB per minute' },
  { value: '192k', name: 'Standard', size: '~1.4 MB per minute' },
  { value: '320k', name: 'Best', size: '~2.4 MB per minute' },
]

interface Props {
  value: Bitrate
  disabled: boolean
  onChange: (value: Bitrate) => void
}

export default function QualitySelect({ value, disabled, onChange }: Props) {
  const selected = OPTIONS.find((o) => o.value === value)
  return (
    <fieldset className="row" disabled={disabled}>
      <legend className="row-label">Quality:</legend>
      <div className="row-body">
        <div className="segmented">
          {OPTIONS.map((o) => (
            <label key={o.value} className={`segment${value === o.value ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="bitrate"
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.name}
              <span className="segment-detail">{o.value.replace('k', ' kbps')}</span>
            </label>
          ))}
        </div>
        <p className="row-hint">{selected?.size}</p>
      </div>
    </fieldset>
  )
}
