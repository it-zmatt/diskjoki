interface Props {
  disabled: boolean
  busy: boolean
  onClick: () => void
}

export default function ConvertButton({ disabled, busy, onClick }: Props) {
  return (
    <button type="button" className="btn btn-convert" disabled={disabled} onClick={onClick}>
      {busy ? 'SPINNING…' : 'CONVERT'}
    </button>
  )
}
