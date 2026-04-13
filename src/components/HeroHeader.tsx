import brandLogo from '../assets/fumanjia-logo.jpeg'

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
        <div className="hero-brand-lockup">
          <img alt="福满家 FUMANJIA ISS" className="hero-brand-logo" src={brandLogo} />
          <div>
            <span className="eyebrow">FUMANJIA ISS</span>
            <p className="hero-brand-caption">福满家订餐平台</p>
          </div>
        </div>
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
