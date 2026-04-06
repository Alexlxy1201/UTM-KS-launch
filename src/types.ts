export type NavigationView = 'user' | 'admin' | 'launch'

export type OrderStatus = '未付' | '待核验' | '已付'

export type PaymentChannel = '支付宝' | '微信'

export type MealItem = {
  id: string
  name: string
  category: string
  flavor: string
  basePrice: number
  todayPrice: number
  cost: number
  availableToday: boolean
}

export type OrderItem = {
  mealId: string
  mealName: string
  unitPrice: number
  cost: number
}

export type OrderRecord = {
  id: string
  orderNo: string
  customerName: string
  createdAt: string
  orderDate: string
  paymentStatus: OrderStatus
  paymentChannel?: PaymentChannel
  paymentProofName?: string
  paymentNote?: string
  callbackTime?: string
  items: OrderItem[]
}

export type PaymentRecord = {
  id: string
  orderNo: string
  customerName: string
  channel: PaymentChannel
  proofName: string
  uploadedAt: string
  status: OrderStatus
}

export type AppConfig = {
  orderDeadlineHour: number
  exchangeRate: number
  autoMarkPaid: boolean
  qrNote: string
  launchBudget: string
}

export type AppState = {
  config: AppConfig
  menu: MealItem[]
  orders: OrderRecord[]
  payments: PaymentRecord[]
}

export type MealSummaryRow = {
  mealName: string
  quantity: number
  sold: number
}

export type TodayOverview = {
  totalSold: number
  totalCost: number
  totalProfit: number
  totalOrders: number
  paidOrders: number
  unpaidOrders: number
  summary: MealSummaryRow[]
}

export type DailyStatsRow = {
  date: string
  totalSold: number
  totalCost: number
  totalProfit: number
  paidOrders: number
}
