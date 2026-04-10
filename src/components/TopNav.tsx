import type { NavigationView } from '../types'

type TopNavProps = {
  activeView: NavigationView
  canAccessUserPage: boolean
  canAccessAdminPage: boolean
  onSwitch: (view: NavigationView) => void
  onRefresh: () => void
}

export function TopNav(props: TopNavProps) {
  return (
    <nav className="top-nav">
      <button
        className={props.activeView === 'home' ? 'nav-chip active' : 'nav-chip'}
        onClick={() => props.onSwitch('home')}
        type="button"
      >
        首页
      </button>
      {props.canAccessUserPage ? (
        <>
          <button
            className={props.activeView === 'user' ? 'nav-chip active' : 'nav-chip'}
            onClick={() => props.onSwitch('user')}
            type="button"
          >
            订餐页面
          </button>
          <button
            className={props.activeView === 'user-center' ? 'nav-chip active' : 'nav-chip'}
            onClick={() => props.onSwitch('user-center')}
            type="button"
          >
            用户中心
          </button>
        </>
      ) : null}
      {props.canAccessAdminPage || props.activeView === 'admin' ? (
        <button
          className={props.activeView === 'admin' ? 'nav-chip active' : 'nav-chip'}
          onClick={() => props.onSwitch('admin')}
          type="button"
        >
          管理后台
        </button>
      ) : null}
      <button className="ghost-action" onClick={props.onRefresh} type="button">
        刷新数据
      </button>
    </nav>
  )
}
