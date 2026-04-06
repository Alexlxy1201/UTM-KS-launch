type NoticeBannerProps = {
  tone: 'success' | 'warning'
  title: string
  description: string
  onClose: () => void
}

export function NoticeBanner(props: NoticeBannerProps) {
  return (
    <section className={`notice ${props.tone}`}>
      <div>
        <strong>{props.title}</strong>
        <p>{props.description}</p>
      </div>
      <button className="notice-close" onClick={props.onClose} type="button">
        收起
      </button>
    </section>
  )
}
