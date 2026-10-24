interface Props {
  disabled: boolean
  busy: boolean
  again: boolean
}

export default function ConvertButton({ disabled, busy, again }: Props) {
  return (
    <button type="submit" className={`aqua-btn${again ? '' : ' aqua-btn-default'}`} disabled={disabled}>
      {busy ? 'Working…' : again ? 'Convert Again' : 'Convert'}
    </button>
  )
}
