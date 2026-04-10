type ConfirmPromptProps = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmPrompt(props: ConfirmPromptProps) {
  return (
    <div className="confirm-overlay" role="presentation">
      <section
        aria-labelledby="confirm-title"
        aria-modal="true"
        className="confirm-card"
        role="alertdialog"
      >
        <div className="confirm-copy">
          <strong id="confirm-title">{props.title}</strong>
          <p>{props.description}</p>
        </div>

        <div className="confirm-actions">
          <button className="secondary-button" onClick={props.onCancel} type="button">
            {props.cancelLabel ?? '取消'}
          </button>
          <button className="primary-button" disabled={props.isBusy} onClick={props.onConfirm} type="button">
            {props.isBusy ? '处理中...' : props.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
