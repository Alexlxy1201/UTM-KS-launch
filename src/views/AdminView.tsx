import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  calculateOrderCost,
  calculateOrderTotal,
  formatClock,
  formatCurrency,
  formatDateTime,
  getMealSummaryText,
  getStatusTone,
} from '../lib/orderUtils'
import type {
  DailyStatsRow,
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
      onFocus={() => {
        setDraft(String(props.value))
        setIsEditing(true)
      }}
      onBlur={handleBlur}
      onChange={(event) => setDraft(event.target.value)}
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
          <p>选择图片后点击顶部“保存全部修改”即可生效。</p>
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
      <div className="panel-head">
        <div>
          <span className="section-tag">运营总览</span>
          <h2>今日经营概览</h2>
        </div>
        <span className="badge accent">
          已付 {props.todayOverview.paidOrders} / {props.todayOverview.totalOrders}
        </span>
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
          <p>可编辑内容会先保留在当前页面草稿中，点击顶部“保存全部修改”后才会正式写入数据库。</p>
          <p>订单状态修改、查看支付截图、删除订单和重置临时密码属于即时操作，无需等待总保存按钮。</p>
        </div>
      </div>
    </section>
  )
}

export function AdminView(props: AdminViewProps) {
  const [activeModuleId, setActiveModuleId] = useState<AdminModuleId>('overview')
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward')

  const moduleCards: ModuleCard[] = [
    {
      id: 'overview',
      title: '运营总览',
      description: '查看今日经营数据和销量汇总。',
      meta: `${props.todayOverview.paidOrders}/${props.todayOverview.totalOrders} 已付`,
    },
    {
      id: 'today-orders',
      title: '今日下单',
      description: '查看今天谁下单了什么菜。',
      meta: `${props.orders.length} 笔下单`,
    },
    {
      id: 'config',
      title: '系统配置',
      description: '维护截单时间、汇率、支付说明和收款码。',
      meta: `截单 ${props.orderDeadlineHour}:00`,
    },
    {
      id: 'orders',
      title: '订单管理',
      description: '处理订单状态并查看订单截图。',
      meta: `${props.orders.length} 笔订单`,
    },
    {
      id: 'users',
      title: '用户管理',
      description: '维护用户资料并重置临时密码。',
      meta: `${props.managedUsers.length} 位用户`,
    },
    {
      id: 'menu',
      title: '今日菜单',
      description: '调整菜品内容、价格和上架状态。',
      meta: `${props.menu.filter((meal) => meal.availableToday).length} 个上架`,
    },
    {
      id: 'payments',
      title: '付款记录',
      description: '查看付款登记与支付截图。',
      meta: `${props.payments.length} 条记录`,
    },
    {
      id: 'stats',
      title: '每日统计',
      description: '查看 DailyStats 快照。',
      meta: `${props.dailyStats.length} 天数据`,
    },
  ]

  const filteredOrders = useMemo(() => {
    const keyword = props.adminSearch.trim().toLowerCase()
    if (!keyword) return props.orders
    return props.orders.filter((order) =>
      [order.customerName, order.orderNo, getMealSummaryText(order), order.paymentStatus].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    )
  }, [props.adminSearch, props.orders])

  const todayOrderDigest = props.orders.map((order) => ({
    id: order.id,
    time: formatClock(order.createdAt),
    customerName: order.customerName,
    meals: order.items.map((item) => item.mealName),
  }))

  function openModule(nextId: AdminModuleId) {
    if (nextId === activeModuleId) return
    const currentIndex = moduleCards.findIndex((card) => card.id === activeModuleId)
    const nextIndex = moduleCards.findIndex((card) => card.id === nextId)
    setSlideDirection(nextIndex >= currentIndex ? 'forward' : 'backward')
    setActiveModuleId(nextId)
  }

  if (props.isLiveMode && !props.isAdminAuthorized) {
    return (
      <main className="admin-layout single-column">
        <section className="panel auth-panel centered-panel">
          <div className="panel-head">
            <div>
              <span className="section-tag">后台保护</span>
              <h2>请先完成管理员登录</h2>
            </div>
            <span className="badge dark">{props.authLoading ? '校验中...' : '需要管理员权限'}</span>
          </div>
          <div className="tip-card">
            <strong>当前页面仅限管理员访问</strong>
            <p>请返回首页，从右上角“管理员登录”入口进入后台。</p>
          </div>
          <div className="cta-row compact">
            <button className="primary-button" onClick={props.onGoHome} type="button">
              返回首页
            </button>
            {props.adminSessionEmail ? (
              <button className="secondary-button" onClick={props.onAdminSignOut} type="button">
                退出当前账户
              </button>
            ) : null}
          </div>
        </section>
      </main>
    )
  }

  const modules: Record<AdminModuleId, ReactNode> = {
    overview: <AdminOverview todayOverview={props.todayOverview} />,
    'today-orders': (
      <section className="panel admin-module-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">今日下单</span>
            <h2>今天谁下单了什么菜</h2>
            <p className="panel-subtext">这里只展示下单时间、姓名和菜品，不显示价格与成本。</p>
          </div>
          <span className="badge ok">{todayOrderDigest.length} 笔</span>
        </div>
        {todayOrderDigest.length ? (
          <div className="today-order-grid">
            {todayOrderDigest.map((order) => (
              <article key={order.id} className="today-order-card">
                <div className="today-order-head">
                  <strong>{order.customerName}</strong>
                  <span>{order.time}</span>
                </div>
                <div className="today-order-meals">
                  {order.meals.map((meal, index) => (
                    <span key={`${order.id}-${meal}-${index}`}>{meal}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>今日暂无下单记录</strong>
            <p>用户提交订单后，这里会自动展示今日下单摘要。</p>
          </div>
        )}
      </section>
    ),
    config: (
      <section className="panel admin-module-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">系统配置</span>
            <h2>营业与支付参数</h2>
            <p className="panel-subtext">页面仅显示当日参考汇率，实际金额以支付宝 / 微信支付页为准。</p>
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
            <span className="mini-label">当日汇率</span>
            <DraftNumberInput
              inputMode="decimal"
              onCommit={props.onUpdateExchangeRate}
              value={props.exchangeRate}
            />
          </div>
          <button
            className="secondary-button"
            disabled={props.exchangeRatePending || props.isBusy}
            onClick={props.onRefreshExchangeRate}
            type="button"
          >
            {props.exchangeRatePending ? '更新中...' : '自动抓参考值'}
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
        <div className="panel-head">
          <div>
            <span className="section-tag">订单管理</span>
            <h2>今日订单</h2>
          </div>
          <div className="search-inline wide">
            <input
              onChange={(event) => props.onAdminSearchChange(event.target.value)}
              placeholder="搜索姓名 / 订单号 / 餐点 / 状态"
              value={props.adminSearch}
            />
          </div>
        </div>
        <div className="table-wrap responsive-card-wrap">
          <table className="responsive-table">
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
              {filteredOrders.length ? (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="时间">{formatClock(order.createdAt)}</td>
                    <td data-label="姓名">{order.customerName}</td>
                    <td data-label="订单号">{order.orderNo}</td>
                    <td data-label="餐点">{getMealSummaryText(order)}</td>
                    <td data-label="售价">{formatCurrency(calculateOrderTotal(order), 'RM')}</td>
                    <td data-label="成本">{formatCurrency(calculateOrderCost(order), 'RM')}</td>
                    <td data-label="状态">
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
                    <td className="table-action-cell" data-label="操作">
                      <div className="table-action-stack">
                        {order.paymentProofName ? (
                          <button
                            className="table-action ghost"
                            disabled={props.openingProofPath === order.paymentProofName}
                            onClick={() =>
                              props.onViewPaymentProof(order.paymentProofName!, order.callbackTime ?? order.createdAt)
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
                  <td className="table-empty" colSpan={8}>
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
        <div className="panel-head">
          <div>
            <span className="section-tag">用户管理</span>
            <h2>用户信息维护</h2>
          </div>
          <span className="badge accent">共 {props.managedUsers.length} 位用户</span>
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
        <div className="panel-head">
          <div>
            <span className="section-tag">今日菜单</span>
            <h2>菜单设置</h2>
          </div>
          <button className="secondary-button" onClick={props.onAddMeal} type="button">
            添加菜品
          </button>
        </div>
        <div className="menu-admin-list">
          {props.menu.map((meal) => (
            <article key={meal.id} className="menu-admin-card">
              <div className="menu-admin-top">
                <div>
                  <strong>{meal.name || '未命名菜品'}</strong>
                  <p>
                    {meal.category || '未分类'} / {meal.flavor || '常规'}
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
                  菜品名称
                  <input
                    onChange={(event) => props.onUpdateMealTextField(meal.id, 'name', event.target.value)}
                    type="text"
                    value={meal.name}
                  />
                </label>
                <label>
                  分类
                  <input
                    onChange={(event) => props.onUpdateMealTextField(meal.id, 'category', event.target.value)}
                    type="text"
                    value={meal.category}
                  />
                </label>
                <label>
                  口味
                  <input
                    onChange={(event) => props.onUpdateMealTextField(meal.id, 'flavor', event.target.value)}
                    type="text"
                    value={meal.flavor}
                  />
                </label>
              </div>

              <div className="config-grid three">
                <label>
                  基础售价
                  <DraftNumberInput
                    inputMode="decimal"
                    onCommit={(value) => props.onUpdateMealField(meal.id, 'basePrice', value)}
                    value={meal.basePrice}
                  />
                </label>
                <label>
                  今日售价
                  <DraftNumberInput
                    inputMode="decimal"
                    onCommit={(value) => props.onUpdateMealField(meal.id, 'todayPrice', value)}
                    value={meal.todayPrice}
                  />
                </label>
                <label>
                  成本
                  <DraftNumberInput
                    inputMode="decimal"
                    onCommit={(value) => props.onUpdateMealField(meal.id, 'cost', value)}
                    value={meal.cost}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    ),
    payments: (
      <section className="panel admin-module-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">付款记录</span>
            <h2>支付截图登记</h2>
            <p className="panel-subtext">支付截图仅保留 7 天，超期后系统将自动清理。</p>
          </div>
        </div>
        <div className="table-wrap responsive-card-wrap">
          <table className="responsive-table">
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
                    <td data-label="上传时间">{formatClock(payment.uploadedAt)}</td>
                    <td data-label="订单号">{payment.orderNo}</td>
                    <td data-label="姓名">{payment.customerName}</td>
                    <td data-label="支付方式">{payment.channel}</td>
                    <td data-label="文件路径">{payment.proofName}</td>
                    <td data-label="状态">
                      <span className={`status-pill ${getStatusTone(payment.status)}`}>{payment.status}</span>
                    </td>
                    <td className="table-action-cell" data-label="截图">
                      <div className="table-action-stack">
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
                      </div>
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
        <div className="panel-head">
          <div>
            <span className="section-tag">每日统计</span>
            <h2>DailyStats 快照</h2>
          </div>
        </div>
        <div className="table-wrap responsive-card-wrap">
          <table className="responsive-table">
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
              {props.dailyStats.length ? (
                props.dailyStats.map((row) => (
                  <tr key={row.date}>
                    <td data-label="日期">{row.date}</td>
                    <td data-label="总售出">{formatCurrency(row.totalSold, 'RM')}</td>
                    <td data-label="总成本">{formatCurrency(row.totalCost, 'RM')}</td>
                    <td data-label="总利润">{formatCurrency(row.totalProfit, 'RM')}</td>
                    <td data-label="已付订单数">{row.paidOrders}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={5}>
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
    <main className="admin-layout single-column">
      <section className="panel admin-topbar">
        <div className="admin-topbar-row">
          <div>
            <span className="section-tag">功能导览</span>
            <h2>后台功能模块</h2>
            <p className="panel-subtext">点击下方标签切换模块，保存按钮固定在本栏。</p>
          </div>
          <div className={`admin-save-slot ${props.hasPendingChanges ? 'dirty' : 'clean'}`}>
            {props.hasPendingChanges ? (
              <>
                <div className="admin-save-slot-copy">
                  <span className="mini-label">待保存修改</span>
                  <strong>当前有未保存内容</strong>
                  <p>配置、收款码、菜单或用户资料已更新。</p>
                </div>
                <button
                  className="primary-button admin-save-button"
                  disabled={props.saveAllPending || props.isBusy}
                  onClick={props.onSaveAll}
                  type="button"
                >
                  {props.saveAllPending ? '保存中...' : '保存全部修改'}
                </button>
              </>
            ) : (
              <div className="admin-save-slot-copy">
                <span className="mini-label">保存状态</span>
                <strong>当前没有未保存修改</strong>
                <p>页面内容变更后，可直接在这里保存。</p>
              </div>
            )}
          </div>
        </div>

        <div aria-label="后台功能模块" className="admin-tab-strip" role="tablist">
          {moduleCards.map((card) => (
            <button
              key={card.id}
              aria-selected={card.id === activeModuleId}
              className={`admin-tab-button ${card.id === activeModuleId ? 'active' : ''}`}
              onClick={() => openModule(card.id)}
              role="tab"
              title={card.description}
              type="button"
            >
              <span className="mini-label">{card.meta}</span>
              <strong>{card.title}</strong>
              <small>{card.description}</small>
            </button>
          ))}
        </div>

        <div className="panel-actions">
          {props.adminSessionEmail ? <span className="badge accent">{props.adminSessionEmail}</span> : null}
          {props.isLiveMode ? (
            <button className="ghost-action compact" onClick={props.onAdminSignOut} type="button">
              退出登录
            </button>
          ) : null}
          <span className="badge dark">{props.isSwitching ? '切换中...' : '管理模式'}</span>
        </div>
      </section>

      <div className={`admin-module-stage ${slideDirection}`} key={`${activeModuleId}-${slideDirection}`}>
        {modules[activeModuleId]}
      </div>
    </main>
  )
}
