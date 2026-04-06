import {
  calculateOrderCost,
  calculateOrderTotal,
  formatClock,
  formatCurrency,
  getMealSummaryText,
} from '../demoData'
import type {
  DailyStatsRow,
  MealItem,
  OrderRecord,
  OrderStatus,
  PaymentRecord,
  TodayOverview,
} from '../types'

type AdminViewProps = {
  isLiveMode: boolean
  isSwitching: boolean
  isBusy: boolean
  isAdminAuthorized: boolean
  authLoading: boolean
  adminSessionEmail: string | null
  adminEmail: string
  adminPassword: string
  todayOverview: TodayOverview
  dailyStats: DailyStatsRow[]
  orders: OrderRecord[]
  payments: PaymentRecord[]
  menu: MealItem[]
  orderDeadlineHour: number
  exchangeRate: number
  autoMarkPaid: boolean
  adminSearch: string
  onAdminSearchChange: (value: string) => void
  onUseOrderForPayment: (orderId: string) => void
  onDeleteOrder: (orderId: string) => void
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void
  onUpdateDeadline: (value: number) => void
  onUpdateExchangeRate: (value: number) => void
  onToggleAutoMarkPaid: (value: boolean) => void
  onToggleMealAvailability: (mealId: string) => void
  onUpdateMealField: (
    mealId: string,
    field: 'todayPrice' | 'basePrice' | 'cost',
    value: number,
  ) => void
  onSaveConfig: () => void
  onSaveMenu: () => void
  onAdminEmailChange: (value: string) => void
  onAdminPasswordChange: (value: string) => void
  onAdminSignIn: () => void
  onAdminSignOut: () => void
}

export function AdminView(props: AdminViewProps) {
  if (props.isLiveMode && !props.isAdminAuthorized) {
    return (
      <main className="admin-layout single-column">
        <section className="panel auth-panel">
          <div className="panel-head">
            <div>
              <span className="section-tag">管理员登录</span>
              <h2>先登录才能进入后台</h2>
            </div>
            <span className="badge dark">{props.authLoading ? '检查中…' : '受保护区域'}</span>
          </div>

          <div className="field-row">
            <label htmlFor="adminEmail">管理员邮箱</label>
            <input
              id="adminEmail"
              value={props.adminEmail}
              onChange={(event) => props.onAdminEmailChange(event.target.value)}
              placeholder="admin@example.com"
              type="email"
            />
          </div>

          <div className="field-row">
            <label htmlFor="adminPassword">密码</label>
            <input
              id="adminPassword"
              value={props.adminPassword}
              onChange={(event) => props.onAdminPasswordChange(event.target.value)}
              placeholder="请输入密码"
              type="password"
            />
          </div>

          <div className="cta-row">
            <button className="primary-button" onClick={props.onAdminSignIn} type="button">
              {props.isBusy ? '正在登录...' : '登录管理员后台'}
            </button>
            {props.adminSessionEmail ? (
              <button className="secondary-button" onClick={props.onAdminSignOut} type="button">
                退出当前账号
              </button>
            ) : null}
          </div>

          <div className="tip-card">
            <strong>首次初始化说明</strong>
            <p>
              先在 Supabase Auth 里创建管理员账号，再把该账号写入 `admin_users`
              表。完成后刷新页面即可进入后台。
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-layout">
      <section className="panel admin-kpis">
        <div className="panel-head">
          <div>
            <span className="section-tag">管理员端</span>
            <h2>今日经营概览</h2>
          </div>
          <div className="panel-actions">
            {props.adminSessionEmail ? (
              <span className="badge accent">{props.adminSessionEmail}</span>
            ) : null}
            {props.isLiveMode ? (
              <button className="ghost-action compact" onClick={props.onAdminSignOut} type="button">
                退出登录
              </button>
            ) : null}
            <span className="badge dark">{props.isSwitching ? '切换中…' : '实时聚合'}</span>
          </div>
        </div>

        <div className="metric-grid">
          <article className="metric-card highlight">
            <span>总售出</span>
            <strong>{formatCurrency(props.todayOverview.totalSold, 'RM')}</strong>
            <p>仅统计“已付”订单</p>
          </article>
          <article className="metric-card">
            <span>总成本</span>
            <strong>{formatCurrency(props.todayOverview.totalCost, 'RM')}</strong>
            <p>按菜单成本自动累计</p>
          </article>
          <article className="metric-card">
            <span>总利润</span>
            <strong>{formatCurrency(props.todayOverview.totalProfit, 'RM')}</strong>
            <p>售出减去成本</p>
          </article>
          <article className="metric-card">
            <span>订单状态</span>
            <strong>
              {props.todayOverview.paidOrders} / {props.todayOverview.totalOrders}
            </strong>
            <p>已付 / 今日总订单</p>
          </article>
        </div>

        <div className="summary-board">
          <div className="summary-card">
            <h3>当日 summary</h3>
            <ul>
              {props.todayOverview.summary.length ? (
                props.todayOverview.summary.map((row) => (
                  <li key={row.mealName}>
                    <span>{row.mealName}</span>
                    <strong>{row.quantity} 份</strong>
                  </li>
                ))
              ) : (
                <li>
                  <span>暂无已付订单</span>
                  <strong>0</strong>
                </li>
              )}
            </ul>
          </div>
          <div className="summary-card">
            <div className="panel-head inline-head">
              <div>
                <h3>系统配置</h3>
              </div>
              <button className="secondary-button" onClick={props.onSaveConfig} type="button">
                {props.isBusy ? '保存中...' : '保存配置'}
              </button>
            </div>
            <div className="config-grid">
              <label>
                截单时间
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={props.orderDeadlineHour}
                  onChange={(event) => props.onUpdateDeadline(Number(event.target.value || props.orderDeadlineHour))}
                />
              </label>
              <label>
                汇率 RM → CNY
                <input
                  type="number"
                  step="0.01"
                  value={props.exchangeRate}
                  onChange={(event) =>
                    props.onUpdateExchangeRate(Number(event.target.value || props.exchangeRate))
                  }
                />
              </label>
              <label className="toggle-line">
                <input
                  checked={props.autoMarkPaid}
                  onChange={(event) => props.onToggleAutoMarkPaid(event.target.checked)}
                  type="checkbox"
                />
                上传截图后直接改成“已付”
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">订单台</span>
            <h2>今日订单管理</h2>
          </div>
          <div className="search-inline wide">
            <input
              value={props.adminSearch}
              onChange={(event) => props.onAdminSearchChange(event.target.value)}
              placeholder="搜索姓名 / 订单号 / 餐点"
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>姓名</th>
                <th>订单号</th>
                <th>餐点</th>
                <th>售价</th>
                <th>成本</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {props.orders.length ? (
                props.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatClock(order.createdAt)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.orderNo}</td>
                    <td>{getMealSummaryText(order)}</td>
                    <td>{formatCurrency(calculateOrderTotal(order), 'RM')}</td>
                    <td>{formatCurrency(calculateOrderCost(order), 'RM')}</td>
                    <td>
                      <select
                        value={order.paymentStatus}
                        onChange={(event) =>
                          props.onUpdateOrderStatus(order.id, event.target.value as OrderStatus)
                        }
                      >
                        <option value="未付">未付</option>
                        <option value="待核验">待核验</option>
                        <option value="已付">已付</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="table-action ghost"
                        onClick={() => props.onUseOrderForPayment(order.id)}
                        type="button"
                      >
                        打开支付
                      </button>
                      <button
                        className="table-action danger"
                        onClick={() => props.onDeleteOrder(order.id)}
                        type="button"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="table-empty">
                    没有匹配到订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">MenuToday</span>
            <h2>今日菜单设置</h2>
          </div>
          <button className="secondary-button" onClick={props.onSaveMenu} type="button">
            {props.isBusy ? '保存中...' : '保存菜单'}
          </button>
        </div>
        <div className="menu-admin-list">
          {props.menu.map((meal) => (
            <article key={meal.id} className="menu-admin-card">
              <div className="menu-admin-top">
                <div>
                  <strong>{meal.name}</strong>
                  <p>
                    {meal.category} · {meal.flavor}
                  </p>
                </div>
                <label className="toggle-line">
                  <input
                    checked={meal.availableToday}
                    onChange={() => props.onToggleMealAvailability(meal.id)}
                    type="checkbox"
                  />
                  今日上架
                </label>
              </div>
              <div className="config-grid three">
                <label>
                  基础售价
                  <input
                    type="number"
                    step="0.1"
                    value={meal.basePrice}
                    onChange={(event) =>
                      props.onUpdateMealField(
                        meal.id,
                        'basePrice',
                        Number(event.target.value || meal.basePrice),
                      )
                    }
                  />
                </label>
                <label>
                  今日售价
                  <input
                    type="number"
                    step="0.1"
                    value={meal.todayPrice}
                    onChange={(event) =>
                      props.onUpdateMealField(
                        meal.id,
                        'todayPrice',
                        Number(event.target.value || meal.todayPrice),
                      )
                    }
                  />
                </label>
                <label>
                  成本
                  <input
                    type="number"
                    step="0.1"
                    value={meal.cost}
                    onChange={(event) =>
                      props.onUpdateMealField(meal.id, 'cost', Number(event.target.value || meal.cost))
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">Payments</span>
            <h2>付款截图记录</h2>
          </div>
        </div>
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>上传时间</th>
                <th>订单号</th>
                <th>姓名</th>
                <th>支付方式</th>
                <th>文件路径</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {props.payments.length ? (
                props.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatClock(payment.uploadedAt)}</td>
                    <td>{payment.orderNo}</td>
                    <td>{payment.customerName}</td>
                    <td>{payment.channel}</td>
                    <td>{payment.proofName}</td>
                    <td>
                      <span className={`status-pill ${payment.status}`}>{payment.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    暂无付款记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">DailyStats</span>
            <h2>每日汇总快照</h2>
          </div>
        </div>
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>总售出</th>
                <th>总成本</th>
                <th>总利润</th>
                <th>已付订单数</th>
              </tr>
            </thead>
            <tbody>
              {props.dailyStats.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{formatCurrency(row.totalSold, 'RM')}</td>
                  <td>{formatCurrency(row.totalCost, 'RM')}</td>
                  <td>{formatCurrency(row.totalProfit, 'RM')}</td>
                  <td>{row.paidOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
