import { useState } from 'react'
import Header from './components/Header'
import DropZone from './components/DropZone'
import BitrateSelect from './components/BitrateSelect'
import ConvertButton from './components/ConvertButton'
import ProgressRecord from './components/ProgressRecord'
import DownloadCard from './components/DownloadCard'
import Footer from './components/Footer'
import { useConverter } from './hooks/useConverter'
import type { Bitrate } from './lib/ffmpeg'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [bitrate, setBitrate] = useState<Bitrate>('192k')
  const { status, progress, result, error, convert, reset } = useConverter()

  const busy = status === 'loading' || status === 'converting'

  const handleFile = (next: File) => {
    setFile(next)
    reset()
  }

  return (
    <div className="page">
      <Header />
      <main className="deck">
        <DropZone file={file} disabled={busy} onFile={handleFile} />
        <div className="controls">
          <BitrateSelect value={bitrate} disabled={busy} onChange={setBitrate} />
          <ConvertButton disabled={!file || busy} busy={busy} onClick={() => file && convert(file, bitrate)} />
        </div>
        {busy && <ProgressRecord loading={status === 'loading'} progress={progress} />}
        {status === 'error' && error && (
          <p className="error" role="alert">
            <strong>SKIP!</strong> {error}
          </p>
        )}
        {status === 'done' && result && file && <DownloadCard originalSize={file.size} result={result} />}
      </main>
      <Footer />
    </div>
  )
}
