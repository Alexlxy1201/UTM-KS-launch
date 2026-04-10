import type { FormEvent } from 'react'
import './HomeView.css'

type HomeViewProps = {
  isBusy: boolean
  loginName: string
  password: string
  onLoginNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSignIn: () => void
  onGoRegister: () => void
  onGoAdminLogin: () => void
}

export function HomeView(props: HomeViewProps) {
  const isDisabled = props.isBusy || !props.loginName.trim() || !props.password.trim()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isDisabled) {
      props.onSignIn()
    }
  }

  return (
    <main className="landing-page">
      <div className="landing-background" />

      <section className="landing-shell">
        <div className="landing-toolbar">
          <span className="landing-brand">UTM-KS LAUNCH</span>
          <button className="landing-admin-button" onClick={props.onGoAdminLogin} type="button">
            管理员登录
          </button>
        </div>

        <div className="landing-card">
          <div className="landing-card-head">
            <span className="landing-badge">用户入口</span>
            <h1>用户登录</h1>
            <p>登录后即可进入订餐页面，完成下单、上传付款凭证，并查看当日订单记录。</p>
          </div>

          <form className="landing-form" onSubmit={handleSubmit}>
            <div className="landing-field">
              <label htmlFor="userLoginName">登录邮箱</label>
              <input
                autoComplete="email"
                id="userLoginName"
                onChange={(event) => props.onLoginNameChange(event.target.value)}
                placeholder="请输入登录邮箱"
                type="email"
                value={props.loginName}
              />
            </div>

            <div className="landing-field">
              <label htmlFor="userLoginPassword">登录密码</label>
              <input
                autoComplete="current-password"
                id="userLoginPassword"
                onChange={(event) => props.onPasswordChange(event.target.value)}
                placeholder="请输入登录密码"
                type="password"
                value={props.password}
              />
            </div>

            <button className="landing-submit" disabled={isDisabled} type="submit">
              {props.isBusy ? '登录中...' : '立即登录'}
            </button>
          </form>

          <div className="landing-meta">
            <button className="landing-link" onClick={props.onGoRegister} type="button">
              新用户注册
            </button>
            <span>如需重置密码，请联系管理员处理。</span>
          </div>
        </div>
      </section>
    </main>
  )
}
