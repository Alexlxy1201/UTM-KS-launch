export type NavigationView = 'home' | 'register' | 'admin-login' | 'user' | 'user-center' | 'admin'

export type OrderStatus = '\u672a\u4ed8' | '\u5f85\u6838\u9a8c' | '\u5df2\u4ed8'

export type PaymentChannel = '\u652f\u4ed8\u5b9d' | '\u5fae\u4fe1'

export type UserProfile = {
  userId: string
  username: string
  fullName: string
  email: string
  phone: string
}

export type ManagedUserProfile = UserProfile & {
  createdAt: string
  updatedAt: string
}

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
  alipayQrUrl: string
  wechatQrUrl: string
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
