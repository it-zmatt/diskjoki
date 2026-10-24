import { formatBytes, type ConvertResult } from '../lib/ffmpeg'

interface Props {
  originalSize: number
  result: ConvertResult
}

export default function DownloadCard({ originalSize, result }: Props) {
  return (
    <div className="download-card">
      <p className="download-name">{result.name}</p>
      <dl className="download-sizes">
        <div>
          <dt>ORIGINAL</dt>
          <dd>{formatBytes(originalSize)}</dd>
        </div>
        <div>
          <dt>MP3</dt>
          <dd>{formatBytes(result.size)}</dd>
        </div>
      </dl>
      <audio className="download-preview" controls src={result.url} />
      <a className="btn btn-download" href={result.url} download={result.name}>
        DOWNLOAD MP3
      </a>
    </div>
  )
}
