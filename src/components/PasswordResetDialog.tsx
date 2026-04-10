type PasswordResetDialogProps = {
  targetName: string
  targetEmail: string
  temporaryPassword: string
  copied: boolean
  onCopy: () => void
  onClose: () => void
}

export function PasswordResetDialog(props: PasswordResetDialogProps) {
  return (
    <div className="confirm-overlay" role="presentation">
      <section
        aria-labelledby="password-reset-title"
        aria-modal="true"
        className="confirm-card password-reset-card"
        role="dialog"
      >
        <div className="confirm-copy">
          <strong id="password-reset-title">临时密码已生成</strong>
          <p>
            已为 <strong>{props.targetName}</strong>
            {props.targetEmail ? `（${props.targetEmail}）` : ''} 重置临时密码。请尽快将新密码发送给对应用户。
          </p>
        </div>

        <div className="password-reset-secret">
          <span className="mini-label">新的临时密码</span>
          <code>{props.temporaryPassword}</code>
        </div>

        <div className="confirm-actions">
          <button className="secondary-button" onClick={props.onClose} type="button">
            关闭
          </button>
          <button className="primary-button" onClick={props.onCopy} type="button">
            {props.copied ? '已复制' : '复制密码'}
          </button>
        </div>
      </section>
    </div>
  )
}
