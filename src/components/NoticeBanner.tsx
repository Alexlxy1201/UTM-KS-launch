type NoticeBannerProps = {
  tone: 'success' | 'warning'
  title: string
  description: string
  onClose: () => void
}

export function NoticeBanner(props: NoticeBannerProps) {
  return (
    <div aria-live="polite" className="notice-stack" role="status">
      <section className={`notice ${props.tone}`}>
        <div className="notice-copy">
          <strong>{props.title}</strong>
          <p>{props.description}</p>
        </div>
        <button className="notice-close" onClick={props.onClose} type="button">
          关闭
        </button>
      </section>
    </div>
  )
}
