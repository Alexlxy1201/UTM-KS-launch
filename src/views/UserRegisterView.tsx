type UserRegisterViewProps = {
  isBusy: boolean
  username: string
  fullName: string
  email: string
  phone: string
  password: string
  onUsernameChange: (value: string) => void
  onFullNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onGoLogin: () => void
}

export function UserRegisterView(props: UserRegisterViewProps) {
  return (
    <main className="auth-stage">
      <section className="auth-card register-card">
        <div className="auth-brand">
          <span className="eyebrow">UTM-KS Launch</span>
          <h1>用户注册</h1>
          <p>请完整填写账户信息。注册完成后，可使用登录邮箱和密码进入系统。</p>
        </div>

        <div className="field-row">
          <label htmlFor="registerUsername">用户名</label>
          <input
            autoComplete="username"
            id="registerUsername"
            onChange={(event) => props.onUsernameChange(event.target.value)}
            placeholder="请输入用户名"
            type="text"
            value={props.username}
          />
        </div>

        <div className="field-row">
          <label htmlFor="registerFullName">真实姓名</label>
          <input
            id="registerFullName"
            onChange={(event) => props.onFullNameChange(event.target.value)}
            placeholder="请输入真实姓名"
            type="text"
            value={props.fullName}
          />
        </div>

        <div className="field-row">
          <label htmlFor="registerEmail">登录邮箱</label>
          <input
            autoComplete="email"
            id="registerEmail"
            onChange={(event) => props.onEmailChange(event.target.value)}
            placeholder="请输入登录邮箱"
            type="email"
            value={props.email}
          />
        </div>

        <div className="field-row">
          <label htmlFor="registerPhone">联系电话</label>
          <input
            autoComplete="tel"
            id="registerPhone"
            onChange={(event) => props.onPhoneChange(event.target.value)}
            placeholder="请输入联系电话"
            type="text"
            value={props.phone}
          />
        </div>

        <div className="field-row">
          <label htmlFor="registerPassword">登录密码</label>
          <input
            autoComplete="new-password"
            id="registerPassword"
            onChange={(event) => props.onPasswordChange(event.target.value)}
            placeholder="请设置登录密码"
            type="password"
            value={props.password}
          />
        </div>

        <button className="primary-button auth-submit" onClick={props.onSubmit} type="button">
          {props.isBusy ? '注册中...' : '提交注册'}
        </button>

        <div className="auth-meta-row">
          <button className="auth-text-button" onClick={props.onGoLogin} type="button">
            返回登录
          </button>
        </div>
      </section>
    </main>
  )
}
