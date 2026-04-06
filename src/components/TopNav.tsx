import type { NavigationView } from '../types'

type TopNavProps = {
  activeView: NavigationView
  onSwitch: (view: NavigationView) => void
  onReset: () => void
}

export function TopNav(props: TopNavProps) {
  return (
    <nav className="top-nav">
      <button
        className={props.activeView === 'user' ? 'nav-chip active' : 'nav-chip'}
        onClick={() => props.onSwitch('user')}
        type="button"
      >
        用户端
      </button>
      <button
        className={props.activeView === 'admin' ? 'nav-chip active' : 'nav-chip'}
        onClick={() => props.onSwitch('admin')}
        type="button"
      >
        管理员端
      </button>
      <button
        className={props.activeView === 'launch' ? 'nav-chip active' : 'nav-chip'}
        onClick={() => props.onSwitch('launch')}
        type="button"
      >
        上线方案
      </button>
      <button className="ghost-action" onClick={props.onReset} type="button">
        重置演示数据
      </button>
    </nav>
  )
}
