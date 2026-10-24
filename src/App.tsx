import { useState, type FormEvent } from 'react'
import Header from './components/Header'
import LcdDisplay from './components/LcdDisplay'
import LinkInput from './components/LinkInput'
import QualitySelect from './components/QualitySelect'
import ConvertButton from './components/ConvertButton'
import DownloadCard from './components/DownloadCard'
import Footer from './components/Footer'
import { useConverter } from './hooks/useConverter'
import type { Bitrate } from './lib/ffmpeg'
import { parseLink } from './lib/source'

export default function App() {
  const [link, setLink] = useState('')
  const [bitrate, setBitrate] = useState<Bitrate>('192k')
  const [showInvalid, setShowInvalid] = useState(false)
  const [convertedAt, setConvertedAt] = useState<Bitrate>('192k')
  const { status, progress, source, result, error, convert, reset } = useConverter()

  const busy = status === 'fetching' || status === 'loading' || status === 'converting'

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const url = parseLink(link)
    if (!url) {
      setShowInvalid(true)
      return
    }
    setConvertedAt(bitrate)
    convert(url, bitrate)
  }

  const handleLinkChange = (value: string) => {
    setLink(value)
    setShowInvalid(false)
  }

  const startOver = () => {
    reset()
    setLink('')
  }

  return (
    <div className="desktop">
      <div className="window">
        <Header />
        <main className="window-body">
          <LcdDisplay status={status} progress={progress} source={source} result={result} bitrate={convertedAt} />

          <form className="form" onSubmit={handleSubmit} noValidate>
            <LinkInput value={link} invalid={showInvalid} disabled={busy} onChange={handleLinkChange} />
            <QualitySelect value={bitrate} disabled={busy} onChange={setBitrate} />
            <div className="button-row">
              <ConvertButton disabled={busy || !link.trim()} busy={busy} again={status === 'done'} />
            </div>
          </form>

          {status === 'error' && error && (
            <div className="alert" role="alert">
              <span className="alert-icon" aria-hidden="true">!</span>
              <div>
                <p className="alert-title">Couldn’t convert that link.</p>
                <p className="alert-body">{error}</p>
              </div>
            </div>
          )}

          {status === 'done' && result && source && (
            <DownloadCard result={result} originalSize={source.size} onReset={startOver} />
          )}
        </main>
      </div>
      <Footer />
    </div>
  )
}
