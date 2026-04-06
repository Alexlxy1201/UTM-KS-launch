import type {
  AppState,
  DailyStatsRow,
  MealItem,
  OrderItem,
  OrderRecord,
  TodayOverview,
} from './types'

export const STORAGE_KEY = 'meal-ordering-launch-demo'

const locale = 'zh-CN'

function buildDateAt(dateKey: string, time: string) {
  return new Date(`${dateKey}T${time}:00`).toISOString()
}

function buildOrder(
  orderNo: string,
  customerName: string,
  createdAt: string,
  paymentStatus: OrderRecord['paymentStatus'],
  items: OrderItem[],
  paymentChannel?: OrderRecord['paymentChannel'],
  paymentProofName?: string,
): OrderRecord {
  return {
    id: `${orderNo}-${customerName}`,
    orderNo,
    customerName,
    createdAt,
    orderDate: getDateKey(createdAt),
    items,
    paymentStatus,
    paymentChannel,
    paymentProofName,
    callbackTime: paymentStatus === '已付' ? createdAt : undefined,
  }
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildSeedMenu(): MealItem[] {
  return [
    {
      id: 'meal-curry',
      name: '咖喱鸡腿饭',
      category: '招牌饭盒',
      flavor: '微辣',
      basePrice: 13,
      todayPrice: 12.5,
      cost: 7.8,
      availableToday: true,
    },
    {
      id: 'meal-braised',
      name: '卤肉双拼饭',
      category: '热销主食',
      flavor: '经典',
      basePrice: 14,
      todayPrice: 13,
      cost: 8.6,
      availableToday: true,
    },
    {
      id: 'meal-pepper',
      name: '黑椒牛柳意面',
      category: '西式便当',
      flavor: '浓香',
      basePrice: 15,
      todayPrice: 14.5,
      cost: 9.2,
      availableToday: true,
    },
    {
      id: 'meal-vegetable',
      name: '轻食鸡胸沙拉',
      category: '轻食系列',
      flavor: '清爽',
      basePrice: 12,
      todayPrice: 11.5,
      cost: 6.4,
      availableToday: true,
    },
    {
      id: 'meal-soy',
      name: '照烧鸡排饭',
      category: '热销主食',
      flavor: '咸甜',
      basePrice: 14,
      todayPrice: 13.5,
      cost: 8.1,
      availableToday: false,
    },
    {
      id: 'meal-tofu',
      name: '麻婆豆腐饭',
      category: '家常快餐',
      flavor: '重辣',
      basePrice: 11,
      todayPrice: 10.5,
      cost: 5.3,
      availableToday: false,
    },
  ]
}

function pickItems(menu: MealItem[], mealIds: string[]): OrderItem[] {
  return mealIds
    .map((id) => menu.find((meal) => meal.id === id))
    .filter((meal): meal is MealItem => Boolean(meal))
    .map((meal) => ({
      mealId: meal.id,
      mealName: meal.name,
      unitPrice: meal.todayPrice,
      cost: meal.cost,
    }))
}

function buildSeedState(): AppState {
  const menu = buildSeedMenu()
  const today = getTodayKey()
  const yesterday = getDateKey(new Date(Date.now() - 86400000).toISOString())

  const orders: OrderRecord[] = [
    buildOrder(
      'M20260406001',
      '林晓',
      buildDateAt(today, '10:18'),
      '已付',
      pickItems(menu, ['meal-curry', 'meal-vegetable']),
      '支付宝',
      'linxiao-proof.png',
    ),
    buildOrder(
      'M20260406002',
      '陈伟',
      buildDateAt(today, '10:42'),
      '未付',
      pickItems(menu, ['meal-braised']),
    ),
    buildOrder(
      'M20260406003',
      '周宁',
      buildDateAt(today, '11:03'),
      '已付',
      pickItems(menu, ['meal-pepper']),
      '微信',
      'zhouning-proof.jpg',
    ),
    buildOrder(
      'M20260405009',
      '林晓',
      buildDateAt(yesterday, '11:26'),
      '已付',
      pickItems(menu, ['meal-braised', 'meal-curry']),
      '支付宝',
      'archive-proof.webp',
    ),
  ]

  return {
    config: {
      orderDeadlineHour: 13,
      exchangeRate: 1.67,
      autoMarkPaid: true,
      qrNote: '支付成功后上传截图即可自动登记。',
      launchBudget: '0 - 20 美元 / 月',
    },
    menu,
    orders,
    payments: [
      {
        id: 'pay-1',
        orderNo: 'M20260406001',
        customerName: '林晓',
        channel: '支付宝',
        proofName: 'linxiao-proof.png',
        uploadedAt: buildDateAt(today, '10:21'),
        status: '已付',
      },
      {
        id: 'pay-2',
        orderNo: 'M20260406003',
        customerName: '周宁',
        channel: '微信',
        proofName: 'zhouning-proof.jpg',
        uploadedAt: buildDateAt(today, '11:08'),
        status: '已付',
      },
      {
        id: 'pay-3',
        orderNo: 'M20260405009',
        customerName: '林晓',
        channel: '支付宝',
        proofName: 'archive-proof.webp',
        uploadedAt: buildDateAt(yesterday, '11:31'),
        status: '已付',
      },
    ],
  }
}

export function createEmptyState(): AppState {
  return {
    config: {
      orderDeadlineHour: 13,
      exchangeRate: 1.7,
      autoMarkPaid: true,
      qrNote: '支付成功后上传截图即可自动登记。',
      launchBudget: '0 - 20 美元 / 月',
    },
    menu: [],
    orders: [],
    payments: [],
  }
}

export function loadInitialState(forceReset = false) {
  if (!forceReset) {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        return JSON.parse(raw) as AppState
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
  }

  return cloneState(buildSeedState())
}

export function getTodayKey() {
  return getDateKey(new Date().toISOString())
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

export function formatCurrency(value: number, currency: 'RM' | 'CNY') {
  return currency === 'RM'
    ? `RM ${value.toFixed(2)}`
    : `¥ ${value.toFixed(2)}`
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

export function isPastDeadline(deadlineHour: number) {
  return new Date().getHours() >= deadlineHour
}

export function getCustomerOrders(appState: AppState, customerName: string) {
  if (!customerName) return []
  const today = getTodayKey()
  return appState.orders
    .filter(
      (order) =>
        order.orderDate === today &&
        order.customerName.toLowerCase().includes(customerName.toLowerCase()),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function getLatestPayableOrder(appState: AppState, customerName: string) {
  if (!customerName) return null
  return (
    appState.orders.find(
      (order) =>
        order.customerName === customerName &&
        order.orderDate === getTodayKey() &&
        order.paymentStatus !== '已付',
    ) ?? null
  )
}

export function buildTodayOverview(
  appState: AppState,
  dateKey: string,
): TodayOverview {
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
