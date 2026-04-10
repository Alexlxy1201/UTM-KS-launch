type HeroHeaderProps = {
  title: string
  description: string
  modeLabel: string
  exchangeRateLabel: string
  orderDeadlineLabel: string
}

export function HeroHeader(props: HeroHeaderProps) {
  return (
    <header className="hero-panel compact-hero">
      <div className="hero-copy">
        <span className="eyebrow">UTM-KS Launch</span>
        <h1>{props.title}</h1>
        <p className="hero-text">{props.description}</p>
        <div className="hero-pills">
          <span>{props.modeLabel}</span>
          <span>{props.orderDeadlineLabel}</span>
          <span>{props.exchangeRateLabel}</span>
        </div>
      </div>
    </header>
  )
}
