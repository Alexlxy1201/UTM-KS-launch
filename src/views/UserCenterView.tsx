import type { FormEvent } from 'react'
import type { UserProfile } from '../types'

type UserCenterViewProps = {
  currentProfile: UserProfile | null
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
  onBackToUserPage: () => void
}

export function UserCenterView(props: UserCenterViewProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    props.onSubmit()
  }

  if (!props.currentProfile) {
    return null
  }

  return (
    <main className="view-grid single-column">
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">用户中心</span>
            <h2>个人信息与账户设置</h2>
            <p className="panel-subtext">
              你可以在这里维护用户名、真实姓名、登录邮箱、联系电话以及登录密码。
            </p>
          </div>
          <button className="secondary-button" onClick={props.onBackToUserPage} type="button">
            返回订餐页面
          </button>
        </div>

        <form className="config-grid user-grid" onSubmit={handleSubmit}>
          <label>
            用户名
            <input
              onChange={(event) => props.onUsernameChange(event.target.value)}
              type="text"
              value={props.username}
            />
          </label>

          <label>
            真实姓名
            <input
              onChange={(event) => props.onFullNameChange(event.target.value)}
              type="text"
              value={props.fullName}
            />
          </label>

          <label>
            登录邮箱
            <input
              autoComplete="email"
              onChange={(event) => props.onEmailChange(event.target.value)}
              type="email"
              value={props.email}
            />
          </label>

          <label>
            联系电话
            <input
              onChange={(event) => props.onPhoneChange(event.target.value)}
              type="text"
              value={props.phone}
            />
          </label>

          <label>
            新密码
            <input
              autoComplete="new-password"
              onChange={(event) => props.onPasswordChange(event.target.value)}
              placeholder="如无需要修改密码，可留空"
              type="password"
              value={props.password}
            />
          </label>

          <div className="cta-row compact">
            <button className="primary-button" disabled={props.isBusy} type="submit">
              {props.isBusy ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
