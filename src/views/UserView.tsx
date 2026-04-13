import type { ChangeEvent } from 'react'
import {
  calculateOrderTotal,
  formatClock,
  formatCurrency,
  getMealSummaryText,
  getStatusTone,
  isPastDeadline,
} from '../lib/orderUtils'
import { DELIVERY_LOCATIONS } from '../types'
import type { DeliveryLocation, MealItem, OrderRecord, PaymentChannel, UserProfile } from '../types'

type UserViewProps = {
  orderDeadlineHour: number
  exchangeRate: number
  autoMarkPaid: boolean
  qrNote: string
  alipayQrUrl: string
  wechatQrUrl: string
  currentProfile: UserProfile | null
  currentSessionEmail: string | null
  availableMeals: MealItem[]
  selectedMealIds: string[]
  selectedDeliveryLocation: DeliveryLocation
  selectedOrder: OrderRecord | null
  myOrders: OrderRecord[]
  draftTotal: number
  isBusy: boolean
  isOrdersLoading: boolean
  openingProofPath: string | null
  paymentChannel: PaymentChannel
  paymentFileName: string
  paymentNote: string
  onGoHome: () => void
  onGoUserCenter: () => void
  onUserSignOut: () => void
  onMealToggle: (mealId: string) => void
  onDeliveryLocationChange: (location: DeliveryLocation) => void
  onCreateOrder: () => void
  onPaymentChannelChange: (channel: PaymentChannel) => void
  onProofPick: (event: ChangeEvent<HTMLInputElement>) => void
  onPaymentNoteChange: (value: string) => void
  onSubmitPayment: () => void
  onUseOrderForPayment: (orderId: string) => void
  onViewOrderProof: (order: OrderRecord) => void
  onDownloadPaymentQr: (channel: PaymentChannel, qrUrl: string) => void
}

const paymentChannelOptions: Array<{
  value: PaymentChannel
  title: string
  description: string
}> = [
  {
    value: '支付宝',
    title: '支付宝支付',
    description: '选择后将显示支付宝收款码，支付完成后请上传付款凭证。',
  },
  {
    value: '微信',
    title: '微信支付',
    description: '选择后将显示微信收款码，支付完成后请上传付款凭证。',
  },
]

export function UserView(props: UserViewProps) {
  if (!props.currentProfile) {
    return (
      <main className="view-grid single-column">
        <section className="panel">
          <div className="empty-state">
            <strong>当前尚未登录用户账户</strong>
            <p>请先返回首页完成登录，再进入订餐页面继续操作。</p>
            <div className="cta-row compact">
              <button className="primary-button" onClick={props.onGoHome} type="button">
                返回首页
              </button>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const activeQrUrl = props.paymentChannel === '支付宝' ? props.alipayQrUrl : props.wechatQrUrl
  const isDeadlinePassed = isPastDeadline(props.orderDeadlineHour)
  const totalOrderAmount = props.myOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0)
  const pendingOrderCount = props.myOrders.filter((order) => order.paymentStatus !== '已付').length

  return (
    <main className="view-grid">
      <section className="panel order-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">用户页面</span>
            <h2>在线下单</h2>
          </div>
          <div className="panel-actions">
            <span className={isDeadlinePassed ? 'badge warn' : 'badge ok'}>
              {isDeadlinePassed
                ? '今日下单已截止'
                : `今日可下单，截止时间 ${props.orderDeadlineHour}:00`}
            </span>
            <button className="ghost-action compact" onClick={props.onGoHome} type="button">
              返回首页
            </button>
          </div>
        </div>

        <div className="profile-card compact-profile">
          <div>
            <span className="mini-label">用户名</span>
            <strong>{props.currentProfile.username}</strong>
          </div>
          <div>
            <span className="mini-label">真实姓名</span>
            <strong>{props.currentProfile.fullName}</strong>
          </div>
          <div>
            <span className="mini-label">登录邮箱</span>
            <strong>{props.currentSessionEmail || props.currentProfile.email || '未填写'}</strong>
          </div>
          <div>
            <span className="mini-label">联系电话</span>
            <strong>{props.currentProfile.phone || '未填写'}</strong>
          </div>
          <div className="profile-actions">
            <button className="secondary-button" onClick={props.onGoUserCenter} type="button">
              进入用户中心
            </button>
            <button className="secondary-button" onClick={props.onUserSignOut} type="button">
              {props.isBusy ? '处理中...' : '退出登录'}
            </button>
          </div>
        </div>

        <div className="summary-strip">
          <div>
            <span>今日菜单</span>
            <strong>{props.availableMeals.length} 款</strong>
          </div>
          <div>
            <span>配送地点</span>
            <strong>{props.selectedDeliveryLocation}</strong>
          </div>
          <div>
            <span>预计应付</span>
            <strong>{formatCurrency(props.draftTotal, 'RM')}</strong>
          </div>
        </div>

        <section className="location-picker-card">
          <div className="inline-head">
            <span className="section-tag">配送地点</span>
            <h3>请选择本次配送地点</h3>
          </div>
          <div className="delivery-location-grid">
            {DELIVERY_LOCATIONS.map((location) => (
              <button
                key={location}
                className={
                  props.selectedDeliveryLocation === location
                    ? 'payment-method active delivery-location-option'
                    : 'payment-method delivery-location-option'
                }
                onClick={() => props.onDeliveryLocationChange(location)}
                type="button"
              >
                <strong>{location}</strong>
                <p>提交订单后将按该地点统计并安排配送。</p>
              </button>
            ))}
          </div>
        </section>

        <div className="meal-grid">
          {props.availableMeals.map((meal) => {
            const active = props.selectedMealIds.includes(meal.id)
            return (
              <button
                key={meal.id}
                className={active ? 'meal-card active' : 'meal-card'}
                onClick={() => props.onMealToggle(meal.id)}
                type="button"
              >
                <div className="meal-meta">
                  <span className="meal-category">{meal.category}</span>
                  <span className="meal-spicy">{meal.flavor}</span>
                </div>
                <strong>{meal.name}</strong>
                <p>基础售价 {formatCurrency(meal.basePrice, 'RM')}</p>
                <div className="meal-price-row">
                  <span>今日售价</span>
                  <strong>{formatCurrency(meal.todayPrice, 'RM')}</strong>
                </div>
              </button>
            )
          })}
        </div>

        <div className="cta-row">
          <button className="primary-button" onClick={props.onCreateOrder} type="button">
            {props.isBusy ? '提交中...' : '提交订单'}
          </button>
        </div>
      </section>

      <section className="panel payment-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">付款凭证</span>
            <h2>上传付款截图</h2>
          </div>
          <span className="badge accent">
            {props.autoMarkPaid ? '上传后自动标记为已付' : '上传后进入人工核验'}
          </span>
        </div>

        {props.selectedOrder ? (
          <>
            <div className="payment-order-card">
              <div>
                <span className="order-code">订单号 {props.selectedOrder.orderNo}</span>
                <strong>{props.selectedOrder.customerName}</strong>
                <p>配送地点：{props.selectedOrder.deliveryLocation}</p>
                <p>{getMealSummaryText(props.selectedOrder)}</p>
              </div>
              <div className="payment-amounts">
                <div>
                  <span>应付金额（RM）</span>
                  <strong>{formatCurrency(calculateOrderTotal(props.selectedOrder), 'RM')}</strong>
                </div>
                <div>
                  <span>参考金额（CNY）</span>
                  <strong>
                    {formatCurrency(
                      calculateOrderTotal(props.selectedOrder) * props.exchangeRate,
                      'CNY',
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="tip-card">
              <strong>当前显示的是参考汇率</strong>
              <p>实际付款金额请以支付宝 / 微信支付页面显示的人民币金额为准。</p>
            </div>

            {props.selectedOrder.paymentProofName ? (
              <div className="cta-row compact">
                <button
                  className="secondary-button"
                  disabled={props.openingProofPath === props.selectedOrder.paymentProofName}
                  onClick={() => {
                    if (props.selectedOrder) {
                      props.onViewOrderProof(props.selectedOrder)
                    }
                  }}
                  type="button"
                >
                  {props.openingProofPath === props.selectedOrder.paymentProofName
                    ? '打开中...'
                    : '查看已上传的支付截图'}
                </button>
              </div>
            ) : null}

            <div className="payment-methods">
              {paymentChannelOptions.map((option) => (
                <button
                  key={option.value}
                  className={
                    props.paymentChannel === option.value ? 'payment-method active' : 'payment-method'
                  }
                  onClick={() => props.onPaymentChannelChange(option.value)}
                  type="button"
                >
                  <span>{option.value}</span>
                  <strong>{option.title}</strong>
                  <p>{option.description}</p>
                </button>
              ))}
            </div>

            <div className="payment-qr-card">
              <div className="payment-qr-copy">
                <span className="mini-label">{props.paymentChannel}</span>
                <strong>{props.paymentChannel === '支付宝' ? '支付宝收款码' : '微信收款码'}</strong>
                <p>{props.qrNote}</p>
              </div>

              {activeQrUrl ? (
                <>
                  <img alt={`${props.paymentChannel}收款码`} className="payment-qr-image" src={activeQrUrl} />
                  <button
                    className="secondary-button"
                    onClick={() => props.onDownloadPaymentQr(props.paymentChannel, activeQrUrl)}
                    type="button"
                  >
                    保存收款码
                  </button>
                </>
              ) : (
                <div className="empty-state compact-empty">
                  <strong>当前渠道尚未配置收款码</strong>
                  <p>请联系管理员在后台上传 {props.paymentChannel} 收款二维码后再继续付款。</p>
                </div>
              )}
            </div>

            <div className="field-row">
              <label htmlFor="proofUpload">付款截图</label>
              <label className="upload-box" htmlFor="proofUpload">
                <span>{props.paymentFileName || '点击选择付款截图（png / jpg / webp）'}</span>
                <small>截图将与当前订单绑定，并提交至系统留档。</small>
              </label>
              <input
                accept="image/*"
                className="hidden-input"
                id="proofUpload"
                onChange={props.onProofPick}
                type="file"
              />
            </div>

            <div className="field-row">
              <label htmlFor="paymentNote">付款备注</label>
              <textarea
                id="paymentNote"
                onChange={(event) => props.onPaymentNoteChange(event.target.value)}
                placeholder="例如：微信尾号 6802"
                rows={4}
                value={props.paymentNote}
              />
            </div>

            <div className="cta-row compact">
              <button className="primary-button" onClick={props.onSubmitPayment} type="button">
                {props.isBusy ? '提交中...' : '提交付款凭证'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>当前没有待支付订单</strong>
            <p>请先提交订单，或在下方“我的订单”中选择一笔订单继续付款。</p>
          </div>
        )}
      </section>

      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">我的订单</span>
            <h2>当前账户的今日订单</h2>
          </div>
        </div>

        {props.isOrdersLoading ? (
          <div className="tip-card">
            <strong>正在同步订单数据</strong>
            <p>系统正在读取当前账户今天的订单记录，请稍候。</p>
          </div>
        ) : null}

        <div className="my-order-summary">
          <article className="metric-card">
            <span>今日订单</span>
            <strong>{props.myOrders.length} 笔</strong>
          </article>
          <article className="metric-card">
            <span>待处理订单</span>
            <strong>{pendingOrderCount} 笔</strong>
          </article>
          <article className="metric-card">
            <span>金额合计</span>
            <strong>{formatCurrency(totalOrderAmount, 'RM')}</strong>
          </article>
        </div>

        <div className="table-wrap responsive-card-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>订单号</th>
                <th>配送地点</th>
                <th>餐点</th>
                <th>金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {props.myOrders.length ? (
                props.myOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="时间">{formatClock(order.createdAt)}</td>
                    <td data-label="订单号">{order.orderNo}</td>
                    <td data-label="配送地点">{order.deliveryLocation}</td>
                    <td data-label="餐点">{getMealSummaryText(order)}</td>
                    <td data-label="金额">{formatCurrency(calculateOrderTotal(order), 'RM')}</td>
                    <td data-label="状态">
                      <span className={`status-pill ${getStatusTone(order.paymentStatus)}`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="table-action-cell" data-label="操作">
                      <div className="table-action-stack">
                        <button
                          className="table-action"
                          onClick={() => props.onUseOrderForPayment(order.id)}
                          type="button"
                        >
                          查看订单
                        </button>
                        {order.paymentProofName ? (
                          <button
                            className="table-action ghost"
                            disabled={props.openingProofPath === order.paymentProofName}
                            onClick={() => props.onViewOrderProof(order)}
                            type="button"
                          >
                            {props.openingProofPath === order.paymentProofName ? '打开中...' : '查看截图'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="table-empty" colSpan={7}>
                    今日暂无订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
