import type { AppState, DailyStatsRow, OrderRecord, OrderStatus, TodayOverview } from '../types'

const locale = 'zh-CN'

export function createEmptyState(): AppState {
  return {
    config: {
      orderDeadlineHour: 13,
      exchangeRate: 1.7,
      autoMarkPaid: true,
      qrNote: '支付成功后上传截图即可登记订单。',
      launchBudget: '低成本上线',
      alipayQrUrl: '',
      wechatQrUrl: '',
    },
    menu: [],
    orders: [],
    payments: [],
  }
}

export function getDateKey(value: string) {
  return value.slice(0, 10)
}

export function formatClock(value: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatCurrency(value: number, currency: 'RM' | 'CNY') {
  return currency === 'RM' ? `RM ${value.toFixed(2)}` : `CNY ${value.toFixed(2)}`
}

export function calculateOrderTotal(order: Pick<OrderRecord, 'items'>) {
  return order.items.reduce((sum, item) => sum + item.unitPrice, 0)
}

export function calculateOrderCost(order: Pick<OrderRecord, 'items'>) {
  return order.items.reduce((sum, item) => sum + item.cost, 0)
}

export function getMealSummaryText(order: Pick<OrderRecord, 'items'>) {
  return order.items.map((item) => item.mealName).join('、')
}

export function getStatusTone(status: OrderStatus) {
  if (status === '已付') return 'paid'
  if (status === '待核验') return 'pending'
  return 'unpaid'
}

export function isPastDeadline(deadlineHour: number) {
  return new Date().getHours() >= deadlineHour
}

export function buildTodayOverview(appState: AppState, dateKey: string): TodayOverview {
  const todayOrders = appState.orders.filter((order) => order.orderDate === dateKey)
  const paidOrders = todayOrders.filter((order) => order.paymentStatus === '已付')
  const totalSold = paidOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0)
  const totalCost = paidOrders.reduce((sum, order) => sum + calculateOrderCost(order), 0)
  const summaryMap = new Map<string, { quantity: number; sold: number }>()

  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = summaryMap.get(item.mealName)
      if (existing) {
        existing.quantity += 1
        existing.sold += item.unitPrice
        return
      }

      summaryMap.set(item.mealName, { quantity: 1, sold: item.unitPrice })
    })
  })

  return {
    totalSold,
    totalCost,
    totalProfit: totalSold - totalCost,
    totalOrders: todayOrders.length,
    paidOrders: paidOrders.length,
    unpaidOrders: todayOrders.filter((order) => order.paymentStatus !== '已付').length,
    summary: Array.from(summaryMap.entries())
      .map(([mealName, value]) => ({
        mealName,
        quantity: value.quantity,
        sold: value.sold,
      }))
      .sort((left, right) => right.quantity - left.quantity),
  }
}

export function buildDailyStats(appState: AppState): DailyStatsRow[] {
  const rows = new Map<string, DailyStatsRow>()

  appState.orders
    .filter((order) => order.paymentStatus === '已付')
    .forEach((order) => {
      const existing = rows.get(order.orderDate)
      const totalSold = calculateOrderTotal(order)
      const totalCost = calculateOrderCost(order)

      if (existing) {
        existing.totalSold += totalSold
        existing.totalCost += totalCost
        existing.totalProfit += totalSold - totalCost
        existing.paidOrders += 1
        return
      }

      rows.set(order.orderDate, {
        date: order.orderDate,
        totalSold,
        totalCost,
        totalProfit: totalSold - totalCost,
        paidOrders: 1,
      })
    })

  return Array.from(rows.values()).sort((left, right) => right.date.localeCompare(left.date))
}
