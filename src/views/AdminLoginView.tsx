type AdminLoginViewProps = {
  isBusy: boolean
  loginName: string
  password: string
  onLoginNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onGoBack: () => void
}

export function AdminLoginView(props: AdminLoginViewProps) {
  return (
    <main className="auth-stage">
      <section className="auth-card admin-auth-card">
        <div className="auth-brand">
          <span className="eyebrow">FUMANJIA ISS</span>
          <h1>管理员登录</h1>
          <p>登录后进入管理后台，处理订单、菜单、用户、收款码与统计配置。</p>
        </div>

        <div className="field-row">
          <label htmlFor="adminLoginName">管理员邮箱</label>
          <input
            autoComplete="username"
            id="adminLoginName"
            onChange={(event) => props.onLoginNameChange(event.target.value)}
            placeholder="请输入管理员邮箱"
            type="email"
            value={props.loginName}
          />
        </div>

        <div className="field-row">
          <label htmlFor="adminLoginPassword">登录密码</label>
          <input
            autoComplete="current-password"
            id="adminLoginPassword"
            onChange={(event) => props.onPasswordChange(event.target.value)}
            placeholder="请输入登录密码"
            type="password"
            value={props.password}
          />
        </div>

        <button className="primary-button auth-submit" onClick={props.onSubmit} type="button">
          {props.isBusy ? '登录中...' : '进入管理后台'}
        </button>

        <div className="auth-meta-row">
          <button className="auth-text-button" onClick={props.onGoBack} type="button">
            返回用户登录
          </button>
        </div>
      </section>
    </main>
  )
}
