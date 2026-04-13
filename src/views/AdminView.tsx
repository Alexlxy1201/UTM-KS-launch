import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import brandLogo from '../assets/fumanjia-logo.jpeg'
import {
  calculateOrderCost,
  calculateOrderTotal,
  formatClock,
  formatCurrency,
  formatDateTime,
  getMealSummaryText,
  getStatusTone,
} from '../lib/orderUtils'
import { DELIVERY_LOCATIONS } from '../types'
import type {
  DailyStatsRow,
  DeliveryLocation,
  ManagedUserProfile,
  MealItem,
  OrderRecord,
  OrderStatus,
  PaymentChannel,
  PaymentRecord,
  TodayOverview,
} from '../types'

type AdminViewProps = {
  isLiveMode: boolean
  isSwitching: boolean
  isBusy: boolean
  saveAllPending: boolean
  hasPendingChanges: boolean
  exchangeRatePending: boolean
  openingProofPath: string | null
  resettingUserId: string | null
  isAdminAuthorized: boolean
  authLoading: boolean
  adminSessionEmail: string | null
  todayOverview: TodayOverview
  dailyStats: DailyStatsRow[]
  orders: OrderRecord[]
  payments: PaymentRecord[]
  menu: MealItem[]
  managedUsers: ManagedUserProfile[]
  orderDeadlineHour: number
  exchangeRate: number
  exchangeRatePublishedOn: string | null
  exchangeRateSource: string | null
  autoMarkPaid: boolean
  qrNote: string
  alipayQrPreviewUrl: string
  wechatQrPreviewUrl: string
  alipayQrFileName: string
  wechatQrFileName: string
  adminSearch: string
  onAdminSearchChange: (value: string) => void
  onDeleteOrder: (orderId: string) => void
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void
  onUpdateDeadline: (value: number) => void
  onUpdateExchangeRate: (value: number) => void
  onUpdateQrNote: (value: string) => void
  onToggleAutoMarkPaid: (value: boolean) => void
  onAddMeal: () => void
  onToggleMealAvailability: (mealId: string) => void
  onUpdateMealTextField: (
    mealId: string,
    field: 'name' | 'category' | 'flavor',
    value: string,
  ) => void
  onUpdateMealField: (
    mealId: string,
    field: 'todayPrice' | 'basePrice' | 'cost',
    value: number,
  ) => void
  onRefreshExchangeRate: () => void
  onViewPaymentProof: (proofPath: string, uploadedAt: string) => void
  onResetManagedUserPassword: (
    userId: string,
    payload: { username: string; fullName: string; email: string; phone: string },
  ) => void
  onUpdateManagedUserField: (
    userId: string,
    field: 'username' | 'fullName' | 'email' | 'phone',
    value: string,
  ) => void
  onUpdateDailyStatField: (
    date: string,
    field: 'note' | 'extraIncome' | 'extraExpense',
    value: string | number,
  ) => void
  onSaveAll: () => void
  onAdminSignOut: () => void
  onGoHome: () => void
  onQrFilePick: (channel: PaymentChannel, file: File | null) => void
}

type AdminModuleId =
  | 'overview'
  | 'today-orders'
  | 'config'
  | 'orders'
  | 'users'
  | 'menu'
  | 'payments'
  | 'stats'

type ModuleCard = {
  id: AdminModuleId
  title: string
  description: string
  meta: string
}

type DraftNumberInputProps = {
  value: number
  inputMode: 'numeric' | 'decimal'
  onCommit: (value: number) => void
  min?: number
  max?: number
}

type TodayOrderSummaryRow = {
  location: DeliveryLocation
  countsByCategory: Record<string, number>
  total: number
}

const orderStatusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: '未付', label: '未付' },
  { value: '待核验', label: '待核验' },
  { value: '已付', label: '已付' },
]

function isProofExpired(uploadedAt: string) {
  const uploadedTime = new Date(uploadedAt).getTime()
  if (Number.isNaN(uploadedTime)) return false
  return Date.now() - uploadedTime > 7 * 24 * 60 * 60 * 1000
}

function DraftNumberInput(props: DraftNumberInputProps) {
  const [draft, setDraft] = useState(() => String(props.value))
  const [isEditing, setIsEditing] = useState(false)

  function handleBlur() {
    const parsed = Number(draft)
    const invalid =
      !draft.trim() ||
      !Number.isFinite(parsed) ||
      (props.inputMode === 'numeric' && !Number.isInteger(parsed)) ||
      (typeof props.min === 'number' && parsed < props.min) ||
      (typeof props.max === 'number' && parsed > props.max)

    if (invalid) {
      setDraft(String(props.value))
      setIsEditing(false)
      return
    }

    props.onCommit(parsed)
    setIsEditing(false)
  }

  return (
    <input
      inputMode={props.inputMode}
      onBlur={handleBlur}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setIsEditing(true)}
      type="text"
      value={isEditing ? draft : String(props.value)}
    />
  )
}

function QrUploadCard(props: {
  channel: PaymentChannel
  previewUrl: string
  fileName: string
  onPick: (file: File | null) => void
}) {
  const inputId = props.channel === '支付宝' ? 'admin-alipay-qr' : 'admin-wechat-qr'

  return (
    <article className="qr-upload-card">
      <div className="qr-upload-head">
        <div>
          <span className="mini-label">{props.channel}</span>
          <strong>{props.channel === '支付宝' ? '支付宝收款码' : '微信收款码'}</strong>
        </div>
      </div>

      {props.previewUrl ? (
        <img alt={`${props.channel}收款码`} className="qr-upload-image" src={props.previewUrl} />
      ) : (
        <div className="empty-state compact-empty">
          <strong>当前尚未上传收款码</strong>
          <p>选择图片后点击“保存修改”即可生效。</p>
        </div>
      )}

      <label className="upload-box" htmlFor={inputId}>
        <span>{props.fileName || '点击上传二维码图片（png / jpg / webp）'}</span>
        <small>支持直接替换当前收款二维码。</small>
      </label>
      <input
        accept="image/*"
        className="hidden-input"
        id={inputId}
        onChange={(event) => props.onPick(event.target.files?.[0] ?? null)}
        type="file"
      />
    </article>
  )
}

function AdminOverview(props: { todayOverview: TodayOverview }) {
  return (
    <section className="panel admin-module-panel">
      <div className="panel-head admin-wide-panel-head">
        <div>
          <span className="section-tag">运营总览</span>
          <h2>今日经营概览</h2>
        </div>
        <div className="admin-wide-panel-actions">
          <span className="badge accent">
            已付 {props.todayOverview.paidOrders} / {props.todayOverview.totalOrders}
          </span>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card highlight">
          <span>总售出</span>
          <strong>{formatCurrency(props.todayOverview.totalSold, 'RM')}</strong>
          <p>仅统计已付订单。</p>
        </article>
        <article className="metric-card">
          <span>总成本</span>
          <strong>{formatCurrency(props.todayOverview.totalCost, 'RM')}</strong>
          <p>按菜品成本自动汇总。</p>
        </article>
        <article className="metric-card">
          <span>总利润</span>
          <strong>{formatCurrency(props.todayOverview.totalProfit, 'RM')}</strong>
          <p>销售额减去成本。</p>
        </article>
        <article className="metric-card">
          <span>已付订单</span>
          <strong>
            {props.todayOverview.paidOrders} / {props.todayOverview.totalOrders}
          </strong>
          <p>今日支付完成情况。</p>
        </article>
      </div>

      <div className="summary-board">
        <div className="summary-card">
          <h3>当日销量汇总</h3>
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
          <h3>后台说明</h3>
          <p>菜单、用户资料、统计备注、支付说明和收款码属于可编辑内容，保存后会自动刷新后台数据。</p>
          <p>订单状态修改、删除订单、查看支付截图和重置临时密码属于即时操作，无需等待统一保存。</p>
        </div>
      </div>
    </section>
  )
}

function getStatsRangeStart(anchorDate: string, period: 'day' | 'week' | 'month') {
  if (!anchorDate) return ''
  if (period === 'day') return anchorDate

  const anchor = new Date(`${anchorDate}T00:00:00`)
  const offset = period === 'week' ? 6 : 29
  anchor.setDate(anchor.getDate() - offset)
  return anchor.toISOString().slice(0, 10)
}

export function AdminView(props: AdminViewProps) {
  const [activeModuleId, setActiveModuleId] = useState<AdminModuleId>('overview')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [statsAnchorDate, setStatsAnchorDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [statsPeriod, setStatsPeriod] = useState<'day' | 'week' | 'month'>('day')

  const moduleCards: ModuleCard[] = [
    { id: 'overview', title: '运营总览', description: '查看今日经营数据和销量汇总。', meta: `${props.todayOverview.paidOrders}/${props.todayOverview.totalOrders} 已付` },
    { id: 'today-orders', title: '今日订单', description: '查看今日订单与地点分类统计。', meta: `${props.orders.length} 笔` },
    { id: 'config', title: '系统配置', description: '维护截单时间、汇率、支付说明和收款码。', meta: `截单 ${props.orderDeadlineHour}:00` },
    { id: 'orders', title: '订单管理', description: '处理订单状态并查看支付截图。', meta: `${props.orders.length} 笔订单` },
    { id: 'users', title: '用户管理', description: '维护用户资料并重置临时密码。', meta: `${props.managedUsers.length} 位用户` },
    { id: 'menu', title: '今日菜单', description: '管理菜品上架与详细资料。', meta: `${props.menu.filter((meal) => meal.availableToday).length} 个上架` },
    { id: 'payments', title: '付款记录', description: '查看付款登记与支付截图。', meta: `${props.payments.length} 条记录` },
    { id: 'stats', title: '每日统计', description: '查看统计明细、备注与附加收入支出。', meta: `${props.dailyStats.length} 天` },
  ]

  const filteredOrders = useMemo(() => {
    const keyword = props.adminSearch.trim().toLowerCase()
    if (!keyword) return props.orders
    return props.orders.filter((order) =>
      [order.customerName, order.orderNo, order.deliveryLocation, getMealSummaryText(order), order.paymentStatus].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    )
  }, [props.adminSearch, props.orders])

  const todayOrderCategories = useMemo(() => {
    const categories = new Set<string>()
    for (const order of props.orders) {
      for (const item of order.items) {
        categories.add(item.mealCategory || '未分类')
      }
    }
    return Array.from(categories)
  }, [props.orders])

  const todayOrderSummaryRows = useMemo<TodayOrderSummaryRow[]>(() => {
    return DELIVERY_LOCATIONS.map((location) => {
      const countsByCategory = Object.fromEntries(todayOrderCategories.map((category) => [category, 0]))
      let total = 0

      for (const order of props.orders) {
        if (order.deliveryLocation !== location) continue
        for (const item of order.items) {
          const category = item.mealCategory || '未分类'
          countsByCategory[category] = (countsByCategory[category] ?? 0) + 1
          total += 1
        }
      }

      return { location, countsByCategory, total }
    })
  }, [props.orders, todayOrderCategories])

  const statsRows = useMemo(() => {
    const startDate = getStatsRangeStart(statsAnchorDate, statsPeriod)
    return props.dailyStats
      .filter((row) => !startDate || (row.date >= startDate && row.date <= statsAnchorDate))
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [props.dailyStats, statsAnchorDate, statsPeriod])

  const statsSummary = useMemo(() => ({
    rows: statsRows,
    totalSold: statsRows.reduce((sum, row) => sum + row.totalSold, 0),
    totalCost: statsRows.reduce((sum, row) => sum + row.totalCost, 0),
    totalProfit: statsRows.reduce((sum, row) => sum + row.totalProfit, 0),
    extraIncome: statsRows.reduce((sum, row) => sum + row.extraIncome, 0),
    extraExpense: statsRows.reduce((sum, row) => sum + row.extraExpense, 0),
  }), [statsRows])

  const selectedDailyStat =
    props.dailyStats.find((row) => row.date === statsAnchorDate) ?? {
      date: statsAnchorDate,
      totalSold: 0,
      totalCost: 0,
      totalProfit: 0,
      paidOrders: 0,
      note: '',
      extraIncome: 0,
      extraExpense: 0,
    }

  const editingMeal = props.menu.find((meal) => meal.id === editingMealId) ?? null
  const activeModule = moduleCards.find((card) => card.id === activeModuleId) ?? moduleCards[0]

  function openModule(nextId: AdminModuleId) {
    if (nextId === activeModuleId) return
    const currentIndex = moduleCards.findIndex((card) => card.id === activeModuleId)
    const nextIndex = moduleCards.findIndex((card) => card.id === nextId)
    setSlideDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    setActiveModuleId(nextId)
  }

  if (props.isLiveMode && !props.isAdminAuthorized) {
    return <main className="admin-layout single-column"><section className="panel centered-panel"><div className="panel-head"><div><span className="section-tag">后台保护</span><h2>请先完成管理员登录</h2></div><span className="badge dark">{props.authLoading ? '校验中...' : '需要管理员权限'}</span></div><div className="tip-card"><strong>当前页面仅限管理员访问</strong><p>请返回首页，从右上角“管理员登录”入口进入后台。</p></div><div className="cta-row compact"><button className="primary-button" onClick={props.onGoHome} type="button">返回首页</button></div></section></main>
  }

  const modules: Record<AdminModuleId, ReactNode> = {
    overview: <AdminOverview todayOverview={props.todayOverview} />,
    'today-orders': (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">今日订单</span>
            <h2>今日订单</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <span className="badge accent">{props.orders.length} 笔</span>
            <span className="badge ok">
              {
                DELIVERY_LOCATIONS.filter((location) =>
                  props.orders.some((order) => order.deliveryLocation === location),
                ).length
              }{' '}
              个地点
            </span>
          </div>
        </div>

        <div className="table-wrap responsive-card-wrap mobile-scroll-table">
          <table>
            <thead>
              <tr>
                <th>配送地点</th>
                {todayOrderCategories.map((category) => (
                  <th key={category}>{category}</th>
                ))}
                <th>总计</th>
              </tr>
            </thead>
            <tbody>
              {todayOrderSummaryRows.map((row) => (
                <tr key={row.location}>
                  <td>{row.location}</td>
                  {todayOrderCategories.map((category) => (
                    <td key={`${row.location}-${category}`}>{row.countsByCategory[category] ?? 0}</td>
                  ))}
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-wrap responsive-card-wrap mobile-scroll-table">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>姓名</th>
                <th>配送地点</th>
                <th>菜品</th>
              </tr>
            </thead>
            <tbody>
              {props.orders.length ? (
                props.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatClock(order.createdAt)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.deliveryLocation}</td>
                    <td>{getMealSummaryText(order)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={4}>
                    今日暂无订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    ),
    config: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">系统配置</span>
            <h2>营业与支付参数</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <span className="badge accent">截单 {props.orderDeadlineHour}:00</span>
            <span className="badge ok">当日汇率 {props.exchangeRate.toFixed(4)}</span>
          </div>
        </div>

        <div className="config-grid">
          <label>
            截单时间
            <DraftNumberInput
              inputMode="numeric"
              max={23}
              min={0}
              onCommit={props.onUpdateDeadline}
              value={props.orderDeadlineHour}
            />
          </label>

          <label className="toggle-line">
            <input
              checked={props.autoMarkPaid}
              onChange={(event) => props.onToggleAutoMarkPaid(event.target.checked)}
              type="checkbox"
            />
            上传截图后自动标记为已付
          </label>
        </div>

        <div className="field-row">
          <label htmlFor="qrNote">支付说明</label>
          <textarea
            id="qrNote"
            onChange={(event) => props.onUpdateQrNote(event.target.value)}
            rows={3}
            value={props.qrNote}
          />
        </div>

        <div className="exchange-card">
          <div className="exchange-card-copy">
            <span className="mini-label">当日参考汇率</span>
            <DraftNumberInput
              inputMode="decimal"
              onCommit={props.onUpdateExchangeRate}
              value={props.exchangeRate}
            />
            <p className="config-note">
              实际付款金额以支付宝 / 微信支付页面为准。
              {props.exchangeRateSource ? ` 当前来源：${props.exchangeRateSource}` : ''}
            </p>
          </div>
          <button
            className="secondary-button"
            disabled={props.exchangeRatePending || props.isBusy}
            onClick={props.onRefreshExchangeRate}
            type="button"
          >
            {props.exchangeRatePending ? '抓取中...' : '自动抓参考值'}
          </button>
        </div>

        <div className="qr-upload-grid">
          <QrUploadCard
            channel="支付宝"
            fileName={props.alipayQrFileName}
            onPick={(file) => props.onQrFilePick('支付宝', file)}
            previewUrl={props.alipayQrPreviewUrl}
          />
          <QrUploadCard
            channel="微信"
            fileName={props.wechatQrFileName}
            onPick={(file) => props.onQrFilePick('微信', file)}
            previewUrl={props.wechatQrPreviewUrl}
          />
        </div>
      </section>
    ),
    orders: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">订单管理</span>
            <h2>今日订单管理</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <input
              onChange={(event) => props.onAdminSearchChange(event.target.value)}
              placeholder="搜索姓名 / 订单号 / 地点 / 菜品"
              value={props.adminSearch}
            />
          </div>
        </div>

        <div className="table-wrap responsive-card-wrap mobile-scroll-table">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>姓名</th>
                <th>配送地点</th>
                <th>订单号</th>
                <th>餐点</th>
                <th>售价</th>
                <th>成本</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length ? (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{formatClock(order.createdAt)}</td>
                    <td>{order.customerName}</td>
                    <td>{order.deliveryLocation}</td>
                    <td>{order.orderNo}</td>
                    <td>{getMealSummaryText(order)}</td>
                    <td>{formatCurrency(calculateOrderTotal(order), 'RM')}</td>
                    <td>{formatCurrency(calculateOrderCost(order), 'RM')}</td>
                    <td>
                      <select
                        onChange={(event) =>
                          props.onUpdateOrderStatus(order.id, event.target.value as OrderStatus)
                        }
                        value={order.paymentStatus}
                      >
                        {orderStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-action-cell">
                      <div className="table-action-stack">
                        {order.paymentProofName ? (
                          <button
                            className="table-action ghost"
                            disabled={props.openingProofPath === order.paymentProofName}
                            onClick={() =>
                              props.onViewPaymentProof(
                                order.paymentProofName!,
                                order.callbackTime ?? order.createdAt,
                              )
                            }
                            type="button"
                          >
                            {props.openingProofPath === order.paymentProofName ? '打开中...' : '查看截图'}
                          </button>
                        ) : null}
                        <button
                          className="table-action danger"
                          disabled={props.isBusy}
                          onClick={() => props.onDeleteOrder(order.id)}
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={9}>
                    没有匹配到订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    ),
    users: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">用户管理</span>
            <h2>用户信息维护</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <span className="badge accent">共 {props.managedUsers.length} 位用户</span>
          </div>
        </div>

        <div className="user-manage-grid">
          {props.managedUsers.length ? (
            props.managedUsers.map((user) => (
              <article key={user.userId} className="user-manage-card">
                <div className="user-manage-card-head">
                  <div className="user-manage-identity">
                    <strong>{user.fullName}</strong>
                    <p className="user-manage-account">{user.username}</p>
                  </div>
                  <button
                    className="secondary-button user-manage-reset"
                    disabled={props.resettingUserId === user.userId}
                    onClick={() =>
                      props.onResetManagedUserPassword(user.userId, {
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email,
                        phone: user.phone,
                      })
                    }
                    type="button"
                  >
                    {props.resettingUserId === user.userId ? '重置中...' : '重置为临时密码'}
                  </button>
                </div>

                <div className="config-grid user-grid">
                  <label>
                    用户名
                    <input
                      onChange={(event) =>
                        props.onUpdateManagedUserField(user.userId, 'username', event.target.value)
                      }
                      type="text"
                      value={user.username}
                    />
                  </label>
                  <label>
                    真实姓名
                    <input
                      onChange={(event) =>
                        props.onUpdateManagedUserField(user.userId, 'fullName', event.target.value)
                      }
                      type="text"
                      value={user.fullName}
                    />
                  </label>
                  <label>
                    登录邮箱
                    <input
                      onChange={(event) =>
                        props.onUpdateManagedUserField(user.userId, 'email', event.target.value)
                      }
                      type="text"
                      value={user.email}
                    />
                  </label>
                  <label>
                    联系电话
                    <input
                      onChange={(event) =>
                        props.onUpdateManagedUserField(user.userId, 'phone', event.target.value)
                      }
                      type="text"
                      value={user.phone}
                    />
                  </label>
                </div>

                <div className="user-manage-meta">
                  <span>注册时间：{formatDateTime(user.createdAt)}</span>
                  <span>最近更新：{formatDateTime(user.updatedAt || user.createdAt)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <strong>暂无用户数据</strong>
              <p>当前还没有注册用户，或用户资料尚未完成同步。</p>
            </div>
          )}
        </div>
      </section>
    ),
    menu: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">今日菜单</span>
            <h2>今日菜单</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <button className="secondary-button" onClick={props.onAddMeal} type="button">
              添加菜品
            </button>
          </div>
        </div>

        <div className="menu-admin-list">
          {props.menu.map((meal) => (
            <article key={meal.id} className="menu-admin-card">
              <div className="menu-admin-header">
                <div className="menu-admin-summary">
                  <strong>{meal.name || '未命名菜品'}</strong>
                  <div className="menu-admin-badges">
                    <span>{meal.category || '未分类'}</span>
                    <span>{meal.flavor || '常规'}</span>
                    <span>{formatCurrency(meal.todayPrice, 'RM')}</span>
                  </div>
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

              <div className="menu-admin-actions">
                <button className="secondary-button" onClick={() => setEditingMealId(meal.id)} type="button">
                  编辑详情
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    ),
    payments: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">付款记录</span>
            <h2>支付截图登记</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <span className="badge accent">共 {props.payments.length} 条</span>
            <span className="badge warn">截图保留 7 天</span>
          </div>
        </div>

        <div className="table-wrap responsive-card-wrap mobile-scroll-table">
          <table>
            <thead>
              <tr>
                <th>上传时间</th>
                <th>订单号</th>
                <th>姓名</th>
                <th>支付方式</th>
                <th>文件路径</th>
                <th>状态</th>
                <th>截图</th>
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
                      <span className={`status-pill ${getStatusTone(payment.status)}`}>{payment.status}</span>
                    </td>
                    <td>
                      {isProofExpired(payment.uploadedAt) ? (
                        <span className="badge warn">已过期</span>
                      ) : (
                        <button
                          className="table-action"
                          disabled={props.openingProofPath === payment.proofName}
                          onClick={() => props.onViewPaymentProof(payment.proofName, payment.uploadedAt)}
                          type="button"
                        >
                          {props.openingProofPath === payment.proofName ? '打开中...' : '查看截图'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    暂无付款记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    ),
    stats: (
      <section className="panel admin-module-panel">
        <div className="panel-head admin-wide-panel-head">
          <div>
            <span className="section-tag">每日统计</span>
            <h2>经营统计</h2>
          </div>
          <div className="admin-wide-panel-actions">
            <span className="badge accent">共 {statsSummary.rows.length} 天</span>
          </div>
        </div>

        <div className="stats-filter-bar admin-wide-toolbar">
          <label className="stats-filter-field">
            统计日期
            <input onChange={(event) => setStatsAnchorDate(event.target.value)} type="date" value={statsAnchorDate} />
          </label>
          <label className="stats-filter-field">
            汇总周期
            <select onChange={(event) => setStatsPeriod(event.target.value as 'day' | 'week' | 'month')} value={statsPeriod}>
              <option value="day">当日</option>
              <option value="week">近 7 天</option>
              <option value="month">近 30 天</option>
            </select>
          </label>
        </div>

        <div className="metric-grid stats-summary-grid">
          <article className="metric-card highlight">
            <span>周期售出</span>
            <strong>{formatCurrency(statsSummary.totalSold, 'RM')}</strong>
          </article>
          <article className="metric-card">
            <span>周期成本</span>
            <strong>{formatCurrency(statsSummary.totalCost, 'RM')}</strong>
          </article>
          <article className="metric-card">
            <span>附加收支</span>
            <strong>{formatCurrency(statsSummary.extraIncome - statsSummary.extraExpense, 'RM')}</strong>
          </article>
          <article className="metric-card">
            <span>周期净利润</span>
            <strong>
              {formatCurrency(
                statsSummary.totalProfit + statsSummary.extraIncome - statsSummary.extraExpense,
                'RM',
              )}
            </strong>
          </article>
        </div>

        <section className="stats-editor-card">
          <div className="inline-head">
            <span className="section-tag">统计备注</span>
            <h3>{statsAnchorDate || '未选择日期'}</h3>
          </div>

          <div className="stats-editor-grid">
            <label className="menu-admin-field menu-admin-field-price">
              附加收入
              <DraftNumberInput
                inputMode="decimal"
                onCommit={(value) => props.onUpdateDailyStatField(statsAnchorDate, 'extraIncome', value)}
                value={selectedDailyStat.extraIncome}
              />
            </label>
            <label className="menu-admin-field menu-admin-field-price">
              附加支出
              <DraftNumberInput
                inputMode="decimal"
                onCommit={(value) => props.onUpdateDailyStatField(statsAnchorDate, 'extraExpense', value)}
                value={selectedDailyStat.extraExpense}
              />
            </label>
            <label className="stats-note-field">
              备注
              <textarea
                onChange={(event) => props.onUpdateDailyStatField(statsAnchorDate, 'note', event.target.value)}
                rows={3}
                value={selectedDailyStat.note}
              />
            </label>
          </div>
        </section>

        <div className="table-wrap responsive-card-wrap mobile-scroll-table">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>总售出</th>
                <th>总成本</th>
                <th>总利润</th>
                <th>已付订单数</th>
                <th>附加收入</th>
                <th>附加支出</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {statsSummary.rows.length ? (
                statsSummary.rows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{formatCurrency(row.totalSold, 'RM')}</td>
                    <td>{formatCurrency(row.totalCost, 'RM')}</td>
                    <td>{formatCurrency(row.totalProfit, 'RM')}</td>
                    <td>{row.paidOrders}</td>
                    <td>{formatCurrency(row.extraIncome, 'RM')}</td>
                    <td>{formatCurrency(row.extraExpense, 'RM')}</td>
                    <td>{row.note || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    暂无统计数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    ),
  }

  return (
    <main className="admin-layout single-column admin-console">
      <section className="panel admin-toolbar">
        <div className="admin-toolbar-head">
          <div className="admin-toolbar-brand">
            <img alt="福满家 FUMANJIA ISS" className="admin-toolbar-brand-logo" src={brandLogo} />
            <div className="admin-toolbar-title">
              <span className="section-tag">FUMANJIA ISS</span>
              <h1>管理后台</h1>
            </div>
          </div>

          <div className="admin-toolbar-actions">
            {props.hasPendingChanges ? (
              <button
                className="primary-button admin-toolbar-save"
                disabled={props.saveAllPending || props.isBusy}
                onClick={props.onSaveAll}
                type="button"
              >
                {props.saveAllPending ? '保存中...' : '保存修改'}
              </button>
            ) : null}
            <button className="secondary-button admin-toolbar-signout" onClick={props.onAdminSignOut} type="button">
              退出登录
            </button>
          </div>
        </div>

        <div aria-label="后台功能模块" className="admin-toolbar-tabs" role="tablist">
          {moduleCards.map((card) => (
            <button
              key={card.id}
              aria-selected={card.id === activeModuleId}
              className={`admin-toolbar-tab ${card.id === activeModuleId ? 'active' : ''}`}
              onClick={() => openModule(card.id)}
              role="tab"
              title={`${card.title} · ${card.meta}`}
              type="button"
            >
              {card.title}
            </button>
          ))}
        </div>

        <div className="admin-toolbar-meta">
          {props.adminSessionEmail ? <span className="badge accent">{props.adminSessionEmail}</span> : null}
          <span className="badge dark">{activeModule.title}</span>
          {props.hasPendingChanges ? <span className="badge warn">有未保存修改</span> : null}
        </div>
      </section>

      <div className={`admin-module-stage ${slideDirection}`} key={`${activeModuleId}-${slideDirection}`}>
        {modules[activeModuleId]}
      </div>

      {editingMeal ? (
        <div className="confirm-overlay">
          <div className="confirm-card menu-editor-dialog">
            <div className="confirm-copy">
              <span className="section-tag">菜品详情</span>
              <strong>{editingMeal.name || '未命名菜品'}</strong>
              <p>修改后点击页面顶部“保存修改”即可同步到数据库。</p>
            </div>

            <div className="menu-editor-grid">
              <label className="menu-admin-field">
                菜品名称
                <input
                  onChange={(event) => props.onUpdateMealTextField(editingMeal.id, 'name', event.target.value)}
                  type="text"
                  value={editingMeal.name}
                />
              </label>
              <label className="menu-admin-field">
                类别
                <input
                  onChange={(event) => props.onUpdateMealTextField(editingMeal.id, 'category', event.target.value)}
                  type="text"
                  value={editingMeal.category}
                />
              </label>
              <label className="menu-admin-field">
                口味
                <input
                  onChange={(event) => props.onUpdateMealTextField(editingMeal.id, 'flavor', event.target.value)}
                  type="text"
                  value={editingMeal.flavor}
                />
              </label>
              <label className="menu-admin-field menu-admin-field-price">
                基础售价
                <DraftNumberInput
                  inputMode="decimal"
                  onCommit={(value) => props.onUpdateMealField(editingMeal.id, 'basePrice', value)}
                  value={editingMeal.basePrice}
                />
              </label>
              <label className="menu-admin-field menu-admin-field-price">
                今日售价
                <DraftNumberInput
                  inputMode="decimal"
                  onCommit={(value) => props.onUpdateMealField(editingMeal.id, 'todayPrice', value)}
                  value={editingMeal.todayPrice}
                />
              </label>
              <label className="menu-admin-field menu-admin-field-price">
                成本
                <DraftNumberInput
                  inputMode="decimal"
                  onCommit={(value) => props.onUpdateMealField(editingMeal.id, 'cost', value)}
                  value={editingMeal.cost}
                />
              </label>
            </div>

            <div className="confirm-actions">
              <button className="secondary-button" onClick={() => setEditingMealId(null)} type="button">
                完成
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
