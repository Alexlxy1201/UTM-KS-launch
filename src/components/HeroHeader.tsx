type HeroHeaderProps = {
  paidOrders: number
  totalSoldLabel: string
  launchBudget: string
  modeLabel: string
}

export function HeroHeader(props: HeroHeaderProps) {
  return (
    <header className="hero-panel">
      <div className="hero-copy">
        <span className="eyebrow">低成本上线方案</span>
        <h1>晨味订餐台</h1>
        <p className="hero-text">
          一个面向中文用户的订餐网页原型，覆盖用户下单、静态码支付、付款截图登记、管理员订单台、菜单管理和每日汇总。
        </p>
        <div className="hero-pills">
          <span>用户端</span>
          <span>管理员端</span>
          <span>汇率与统计</span>
          <span>截图支付</span>
        </div>
      </div>

      <div className="hero-brief">
        <div className="floating-card accent-card">
          <span className="mini-label">推荐部署</span>
          <strong>Cloudflare Pages + Supabase</strong>
          <p>前端静态托管，数据库和支付截图走免费额度，适合低成本上线。</p>
        </div>
        <div className="floating-card">
          <span className="mini-label">运行模式</span>
          <strong>{props.modeLabel}</strong>
          <p>已自动识别当前是否连接真实后端，可直接用于测试或上线。</p>
        </div>
        <div className="floating-card">
          <span className="mini-label">今日已付</span>
          <strong>{props.paidOrders} 笔</strong>
          <p>{props.totalSoldLabel} 已计入利润与日报。</p>
        </div>
        <div className="floating-card">
          <span className="mini-label">上线预算</span>
          <strong>{props.launchBudget}</strong>
          <p>静态前端 + 免费数据库即可起步，后续再补短信或通知能力。</p>
        </div>
      </div>
    </header>
  )
}
