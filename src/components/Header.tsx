export default function Header() {
  return (
    <header className="header">
      <div className="cassette-label">
        <span className="cassette-side">SIDE A</span>
        <h1 className="title">MP3 CONVERTER</h1>
        <span className="cassette-side">C-90</span>
      </div>
      <p className="tagline">Drop it. Spin it. Save it.</p>
      <div className="eq-stripe" aria-hidden="true" />
    </header>
  )
}
