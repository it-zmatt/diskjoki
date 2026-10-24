import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export type Bitrate = '128k' | '192k' | '320k'

export interface ConvertResult {
  url: string
  size: number
  name: string
}

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'

let instance: FFmpeg | null = null
let loading: Promise<FFmpeg> | null = null

/** Loads ffmpeg.wasm once and reuses it for every conversion. */
export function loadFfmpeg(): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance)
  if (loading) return loading

  loading = (async () => {
    const ffmpeg = new FFmpeg()
    // Blob URLs sidestep cross-origin worker restrictions under COEP.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    instance = ffmpeg
    return ffmpeg
  })()

  loading.catch(() => {
    loading = null
  })
  return loading
}

export function mp3Name(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const base = dot > 0 ? fileName.slice(0, dot) : fileName
  return `${base}.mp3`
}

export async function convertToMp3(
  file: File,
  bitrate: Bitrate,
  onProgress?: (ratio: number) => void,
): Promise<ConvertResult> {
  const ffmpeg = await loadFfmpeg()

  const dot = file.name.lastIndexOf('.')
  const ext = dot > 0 ? file.name.slice(dot) : ''
  const input = `input${ext}`
  const output = 'output.mp3'

  // ffmpeg's progress can overshoot or go negative on odd inputs, so clamp it.
  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)))
  }
  ffmpeg.on('progress', handleProgress)

  try {
    await ffmpeg.writeFile(input, await fetchFile(file))
    const code = await ffmpeg.exec(['-i', input, '-vn', '-codec:a', 'libmp3lame', '-b:a', bitrate, output])
    if (code !== 0) {
      throw new Error('ffmpeg could not decode this file. Is it an audio or video file?')
    }

    const data = await ffmpeg.readFile(output)
    if (typeof data === 'string') throw new Error('Unexpected text output from ffmpeg.')

    const blob = new Blob([new Uint8Array(data)], { type: 'audio/mpeg' })
    onProgress?.(1)
    return { url: URL.createObjectURL(blob), size: blob.size, name: mp3Name(file.name) }
  } finally {
    ffmpeg.off('progress', handleProgress)
    await ffmpeg.deleteFile(input).catch(() => {})
    await ffmpeg.deleteFile(output).catch(() => {})
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unit]}`
}
