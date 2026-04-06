import type { ChangeEvent } from 'react'
import {
  calculateOrderTotal,
  formatClock,
  formatCurrency,
  getMealSummaryText,
  isPastDeadline,
} from '../demoData'
import type { MealItem, OrderRecord, PaymentChannel } from '../types'

type UserViewProps = {
  orderDeadlineHour: number
  exchangeRate: number
  autoMarkPaid: boolean
  customerName: string
  lookupName: string
  availableMeals: MealItem[]
  selectedMealIds: string[]
  selectedOrder: OrderRecord | null
  myOrders: OrderRecord[]
  draftTotal: number
  isBusy: boolean
  isOrdersLoading: boolean
  paymentChannel: PaymentChannel
  paymentFileName: string
  paymentNote: string
  onCustomerNameChange: (value: string) => void
  onLookupNameChange: (value: string) => void
  onMealToggle: (mealId: string) => void
  onCreateOrder: () => void
  onSyncLookupName: () => void
  onPaymentChannelChange: (channel: PaymentChannel) => void
  onProofPick: (event: ChangeEvent<HTMLInputElement>) => void
  onPaymentNoteChange: (value: string) => void
  onSubmitPayment: () => void
  onUseOrderForPayment: (orderId: string) => void
}

export function UserView(props: UserViewProps) {
  return (
    <main className="view-grid">
      <section className="panel order-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">用户端</span>
            <h2>首页下单</h2>
          </div>
          <span className={isPastDeadline(props.orderDeadlineHour) ? 'badge warn' : 'badge ok'}>
            {isPastDeadline(props.orderDeadlineHour)
              ? '今日已截单'
              : `今日可下单，${props.orderDeadlineHour}:00 截止`}
          </span>
        </div>

        <div className="field-row">
          <label htmlFor="customerName">姓名</label>
          <input
            id="customerName"
            value={props.customerName}
            onChange={(event) => props.onCustomerNameChange(event.target.value)}
            placeholder="例如：林晓"
          />
        </div>

        <div className="summary-strip">
          <div>
            <span>今日菜品</span>
            <strong>{props.availableMeals.length} 款</strong>
          </div>
          <div>
            <span>当前汇率</span>
            <strong>1 RM ≈ {props.exchangeRate.toFixed(2)} CNY</strong>
          </div>
          <div>
            <span>预估应付</span>
            <strong>{formatCurrency(props.draftTotal, 'RM')}</strong>
          </div>
        </div>

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
                  <span>今日价</span>
                  <strong>{formatCurrency(meal.todayPrice, 'RM')}</strong>
                </div>
              </button>
            )
          })}
        </div>

        <div className="cta-row">
          <button className="primary-button" onClick={props.onCreateOrder} type="button">
            {props.isBusy ? '正在处理...' : '创建订单'}
          </button>
          <button className="secondary-button" onClick={props.onSyncLookupName} type="button">
            查询我的订单
          </button>
        </div>
      </section>

      <section className="panel payment-panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">支付页</span>
            <h2>静态码付款 + 截图上传</h2>
          </div>
          <span className="badge accent">
            {props.autoMarkPaid ? '上传后自动已付' : '上传后进入待核验'}
          </span>
        </div>

        {props.selectedOrder ? (
          <>
            <div className="payment-order-card">
              <div>
                <span className="order-code">订单号 {props.selectedOrder.orderNo}</span>
                <strong>{props.selectedOrder.customerName}</strong>
                <p>{getMealSummaryText(props.selectedOrder)}</p>
              </div>
              <div className="payment-amounts">
                <div>
                  <span>应付 RM</span>
                  <strong>{formatCurrency(calculateOrderTotal(props.selectedOrder), 'RM')}</strong>
                </div>
                <div>
                  <span>折合 CNY</span>
                  <strong>
                    {formatCurrency(
                      calculateOrderTotal(props.selectedOrder) * props.exchangeRate,
                      'CNY',
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="payment-methods">
              {(['支付宝', '微信'] as PaymentChannel[]).map((channel) => (
                <button
                  key={channel}
                  className={props.paymentChannel === channel ? 'payment-method active' : 'payment-method'}
                  onClick={() => props.onPaymentChannelChange(channel)}
                  type="button"
                >
                  <span>{channel}</span>
                  <strong>{channel === '支付宝' ? '静态收款码 A' : '静态收款码 W'}</strong>
                  <p>上线后替换为真实二维码图片或对象存储地址。</p>
                </button>
              ))}
            </div>

            <div className="field-row">
              <label htmlFor="proofUpload">付款截图</label>
              <label className="upload-box" htmlFor="proofUpload">
                <span>{props.paymentFileName || '点击选择截图文件（png / jpg / webp）'}</span>
                <small>演示版仅记录文件名；生产版改为直传 Supabase Storage 或 Google Drive。</small>
              </label>
              <input
                id="proofUpload"
                className="hidden-input"
                type="file"
                accept="image/*"
                onChange={props.onProofPick}
              />
            </div>

            <div className="field-row">
              <label htmlFor="paymentNote">支付备注</label>
              <textarea
                id="paymentNote"
                value={props.paymentNote}
                onChange={(event) => props.onPaymentNoteChange(event.target.value)}
                placeholder="例如：使用企业微信付款，尾号 6802"
                rows={4}
              />
            </div>

            <div className="cta-row compact">
              <button className="primary-button" onClick={props.onSubmitPayment} type="button">
                {props.isBusy ? '正在提交...' : '上传付款截图并完成订单'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <strong>还没有选中订单</strong>
            <p>先在左侧创建订单，或在下方“我的订单”中选择一笔未付款订单继续支付。</p>
          </div>
        )}

        <div className="tip-card">
          <strong>当前页面对应参考流程</strong>
          <p>
            下单后跳到支付页，展示 RM 与 CNY 金额，上传截图后把订单直接推进到
            “已付/待核验”，统计和汇总由管理员端实时读取。
          </p>
        </div>
      </section>

      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">我的订单</span>
            <h2>按姓名查询当日订单</h2>
          </div>
          <div className="search-inline">
            <input
              value={props.lookupName}
              onChange={(event) => props.onLookupNameChange(event.target.value)}
              placeholder="输入姓名"
            />
          </div>
        </div>

        {props.isOrdersLoading ? (
          <div className="tip-card">
            <strong>正在读取订单</strong>
            <p>如果已经接入 Supabase，这里会实时查询该姓名今天的订单记录。</p>
          </div>
        ) : null}

        <div className="my-order-summary">
          <div className="metric-card">
            <span>今日订单数</span>
            <strong>{props.myOrders.length}</strong>
          </div>
          <div className="metric-card">
            <span>今日金额</span>
            <strong>
              {formatCurrency(
                props.myOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0),
                'RM',
              )}
            </strong>
          </div>
          <div className="metric-card">
            <span>待支付</span>
            <strong>{props.myOrders.filter((order) => order.paymentStatus !== '已付').length} 笔</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>订单号</th>
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
                    <td>{formatClock(order.createdAt)}</td>
                    <td>{order.orderNo}</td>
                    <td>{getMealSummaryText(order)}</td>
                    <td>{formatCurrency(calculateOrderTotal(order), 'RM')}</td>
                    <td>
                      <span className={`status-pill ${order.paymentStatus}`}>{order.paymentStatus}</span>
                    </td>
                    <td>
                      <button
                        className="table-action"
                        onClick={() => props.onUseOrderForPayment(order.id)}
                        type="button"
                      >
                        继续支付
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    暂无今日订单
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
