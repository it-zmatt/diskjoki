import { useEffect, useRef } from 'react'

interface Props {
  value: string
  invalid: boolean
  disabled: boolean
  onChange: (value: string) => void
}

const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

export default function LinkInput({ value, invalid, disabled, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) onChange(text.trim())
    } catch {
      // Clipboard permission denied: the user can still paste by hand.
    }
    inputRef.current?.focus()
  }

  const clear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="row">
      <label className="row-label" htmlFor="link">
        Link:
      </label>
      <div className="row-body">
        <div className="link-row">
          <input
            ref={inputRef}
            id="link"
            className={`aqua-field${invalid ? ' is-invalid' : ''}`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="YouTube, SoundCloud or a direct audio link"
            value={value}
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'link-error' : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {value ? (
            <button type="button" className="aqua-btn aqua-btn-small" onClick={clear} disabled={disabled}>
              Clear
            </button>
          ) : (
            canPaste && (
              <button type="button" className="aqua-btn aqua-btn-small" onClick={paste} disabled={disabled}>
                Paste
              </button>
            )
          )}
        </div>
        {invalid && (
          <p id="link-error" className="field-error">
            That doesn’t look like a link. It should start with https://
          </p>
        )}
      </div>
    </div>
  )
}
