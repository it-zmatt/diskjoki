export default function Header() {
  return (
    <header className="titlebar">
      <span className="traffic" aria-hidden="true">
        <span className="light light-close" />
        <span className="light light-min" />
        <span className="light light-zoom" />
      </span>
      <h1 className="window-title">MP3 Converter</h1>
    </header>
  )
}
