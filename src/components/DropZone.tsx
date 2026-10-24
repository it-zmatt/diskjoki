import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { formatBytes } from '../lib/ffmpeg'

interface Props {
  file: File | null
  disabled?: boolean
  onFile: (file: File) => void
}

export default function DropZone({ file, disabled, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pick = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFile(dropped)
  }

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick()
    }
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={pick}
      onKeyDown={handleKey}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/*"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) onFile(picked)
          e.target.value = ''
        }}
      />
      {file ? (
        <>
          <span className="dropzone-icon" aria-hidden="true">♫</span>
          <span className="dropzone-file">{file.name}</span>
          <span className="dropzone-hint">{formatBytes(file.size)} · click or drop to swap</span>
        </>
      ) : (
        <>
          <span className="dropzone-icon" aria-hidden="true">⏏</span>
          <span className="dropzone-file">DROP A TRACK HERE</span>
          <span className="dropzone-hint">or click to pick · WAV, FLAC, M4A, MP4, WebM…</span>
        </>
      )}
    </div>
  )
}
