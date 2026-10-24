interface Props {
  loading: boolean
  progress: number
}

export default function ProgressRecord({ loading, progress }: Props) {
  const percent = Math.round(progress * 100)
  return (
    <div className="progress-record" role="status" aria-live="polite">
      <div className="vinyl" aria-hidden="true">
        <div className="vinyl-label" />
      </div>
      <div className="progress-text">
        {loading ? (
          <span>WARMING UP THE DECKS…</span>
        ) : (
          <>
            <span className="progress-percent">{percent}%</span>
            <div className="progress-bar" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
