export type NavigationView = 'home' | 'register' | 'admin-login' | 'user' | 'user-center' | 'admin'

export type OrderStatus = '未付' | '待核验' | '已付'

export type PaymentChannel = '支付宝' | '微信'

export const DELIVERY_LOCATIONS = ['MUET 送餐点', '计算机学院', 'UTM SPACE', 'V01'] as const

export type DeliveryLocation = (typeof DELIVERY_LOCATIONS)[number]

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
  mealCategory: string
  unitPrice: number
  cost: number
}

export type OrderRecord = {
  id: string
  orderNo: string
  customerName: string
  deliveryLocation: string
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
  note: string
  extraIncome: number
  extraExpense: number
}
