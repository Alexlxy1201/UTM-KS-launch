import type { Session } from '@supabase/supabase-js'
import type {
  AppConfig,
  DailyStatsRow,
  MealItem,
  OrderRecord,
  OrderStatus,
  PaymentChannel,
  PaymentRecord,
} from '../types'
import { getDateKey } from '../demoData'
import { supabase } from './supabaseClient'

const TODAY = () => getDateKey(new Date().toISOString())

type ConfigRow = {
  key: string
  value: string
  is_public: boolean
}

type MenuMasterRow = {
  id: string
  name: string
  category: string | null
  flavor: string | null
  base_price: number
  cost: number
  default_enabled: boolean
}

type DailyMenuRow = {
  meal_id: string
  today_price: number
  is_available: boolean
}

type OrderItemRow = {
  meal_id: string | null
  meal_name: string
  unit_price: number
  meal_cost: number
}

type OrderRow = {
  id: string
  order_no: string
  customer_name: string
  ordered_at: string
  order_date: string
  payment_channel: PaymentChannel | null
  payment_status: OrderRecord['paymentStatus']
  payment_proof_path: string | null
  payment_note: string | null
  callback_time: string | null
  order_items?: OrderItemRow[]
}

type PaymentRow = {
  id: string
  order_no: string
  customer_name: string
  payment_channel: PaymentChannel
  proof_path: string
  uploaded_at: string
  status: PaymentRecord['status']
}

type DailyStatRow = {
  stat_date: string
  total_sold: number
  total_cost: number
  total_profit: number
  paid_orders: number
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 环境变量未配置。')
  }
  return supabase
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function mapConfig(rows: ConfigRow[]): AppConfig {
  const map = new Map(rows.map((row) => [row.key, row.value]))
  return {
    orderDeadlineHour: Number(map.get('ORDER_DEADLINE_HOUR') ?? 13),
    exchangeRate: Number(map.get('RM_TO_CNY') ?? 1.7),
    autoMarkPaid: parseBoolean(map.get('AUTO_MARK_PAID') ?? 'true', true),
    qrNote: map.get('QR_NOTE') ?? '支付成功后上传截图即可自动登记。',
    launchBudget: map.get('LAUNCH_BUDGET') ?? '0 - 20 美元 / 月',
  }
}

function mapMenu(masterRows: MenuMasterRow[], dailyRows: DailyMenuRow[]): MealItem[] {
  const dailyMap = new Map(dailyRows.map((row) => [row.meal_id, row]))
  return masterRows.map((row) => {
    const daily = dailyMap.get(row.id)
    return {
      id: row.id,
      name: row.name,
      category: row.category ?? '未分类',
      flavor: row.flavor ?? '常规',
      basePrice: Number(row.base_price),
      todayPrice: Number(daily?.today_price ?? row.base_price),
      cost: Number(row.cost),
      availableToday: daily?.is_available ?? row.default_enabled,
    }
  })
}

function mapOrderRow(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    createdAt: row.ordered_at,
    orderDate: row.order_date,
    paymentStatus: row.payment_status,
    paymentChannel: row.payment_channel ?? undefined,
    paymentProofName: row.payment_proof_path ?? undefined,
    paymentNote: row.payment_note ?? undefined,
    callbackTime: row.callback_time ?? undefined,
    items: (row.order_items ?? []).map((item) => ({
      mealId: item.meal_id ?? '',
      mealName: item.meal_name,
      unitPrice: Number(item.unit_price),
      cost: Number(item.meal_cost),
    })),
  }
}

function mapPaymentRow(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerName: row.customer_name,
    channel: row.payment_channel,
    proofName: row.proof_path,
    uploadedAt: row.uploaded_at,
    status: row.status,
  }
}

function mapDailyStats(rows: DailyStatRow[]): DailyStatsRow[] {
  return rows.map((row) => ({
    date: row.stat_date,
    totalSold: Number(row.total_sold),
    totalCost: Number(row.total_cost),
    totalProfit: Number(row.total_profit),
    paidOrders: Number(row.paid_orders),
  }))
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

export async function fetchPublicBootstrap() {
  const client = requireSupabase()
  const today = TODAY()

  const [configResult, masterResult, dailyResult, statsResult] = await Promise.all([
    client.from('app_config').select('key, value, is_public').eq('is_public', true),
    client
      .from('menu_master')
      .select('id, name, category, flavor, base_price, cost, default_enabled')
      .order('created_at', { ascending: true }),
    client
      .from('daily_menu')
      .select('meal_id, today_price, is_available')
      .eq('menu_date', today),
    client
      .from('daily_stats')
      .select('stat_date, total_sold, total_cost, total_profit, paid_orders')
      .order('stat_date', { ascending: false })
      .limit(14),
  ])

  if (configResult.error) throw configResult.error
  if (masterResult.error) throw masterResult.error
  if (dailyResult.error) throw dailyResult.error
  if (statsResult.error) throw statsResult.error

  return {
    config: mapConfig((configResult.data ?? []) as ConfigRow[]),
    menu: mapMenu(
      (masterResult.data ?? []) as MenuMasterRow[],
      (dailyResult.data ?? []) as DailyMenuRow[],
    ),
    dailyStats: mapDailyStats((statsResult.data ?? []) as DailyStatRow[]),
  }
}

export async function fetchOrdersByName(customerName: string) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_orders_by_name', {
    p_customer_name: customerName.trim(),
    p_order_date: TODAY(),
  })

  if (error) throw error
  return ((data ?? []) as OrderRow[]).map(mapOrderRow)
}

export async function createLiveOrder(customerName: string, mealIds: string[]) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_order_with_items', {
    p_customer_name: customerName.trim(),
    p_meal_ids: mealIds,
  })

  if (error) throw error
  return data as { order_id: string; order_no: string; customer_name: string }
}

export async function uploadPaymentProof(args: {
  file: File
  orderNo: string
  customerName: string
  channel: PaymentChannel
  note: string
}) {
  const client = requireSupabase()
  const extension = args.file.name.includes('.')
    ? args.file.name.split('.').pop()
    : 'png'
  const objectPath = `${TODAY()}/${args.orderNo}/${Date.now()}-${sanitizeFileName(
    args.customerName,
  )}.${extension}`

  const uploadResult = await client.storage
    .from('payment-proofs')
    .upload(objectPath, args.file, {
      contentType: args.file.type || 'image/png',
      upsert: false,
    })

  if (uploadResult.error) throw uploadResult.error

  const { data, error } = await client.rpc('register_payment', {
    p_order_no: args.orderNo,
    p_customer_name: args.customerName.trim(),
    p_payment_channel: args.channel,
    p_proof_path: objectPath,
    p_payment_note: args.note.trim() || null,
  })

  if (error) throw error
  return data as { order_id: string; order_no: string; payment_status: OrderRecord['paymentStatus'] }
}

export async function signInAdmin(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOutAdmin() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getCurrentSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session
}

export function subscribeToAuthChanges(
  callback: (event: string, session: Session | null) => void,
) {
  const client = requireSupabase()
  return client.auth.onAuthStateChange(callback)
}

export async function checkIsAdmin() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('is_admin')
  if (error) throw error
  return Boolean(data)
}

export async function fetchAdminDashboard() {
  const client = requireSupabase()
  const today = TODAY()
  const [configResult, masterResult, dailyResult, orderResult, paymentResult, statsResult] =
    await Promise.all([
      client.from('app_config').select('key, value, is_public'),
      client
        .from('menu_master')
        .select('id, name, category, flavor, base_price, cost, default_enabled')
        .order('created_at', { ascending: true }),
      client
        .from('daily_menu')
        .select('meal_id, today_price, is_available')
        .eq('menu_date', today),
      client
        .from('orders')
        .select(
          'id, order_no, customer_name, ordered_at, order_date, payment_channel, payment_status, payment_proof_path, payment_note, callback_time, order_items(meal_id, meal_name, unit_price, meal_cost)',
        )
        .eq('order_date', today)
        .order('ordered_at', { ascending: false }),
      client
        .from('payments')
        .select('id, order_no, customer_name, payment_channel, proof_path, uploaded_at, status')
        .gte('uploaded_at', `${today}T00:00:00`)
        .order('uploaded_at', { ascending: false }),
      client
        .from('daily_stats')
        .select('stat_date, total_sold, total_cost, total_profit, paid_orders')
        .order('stat_date', { ascending: false })
        .limit(14),
    ])

  if (configResult.error) throw configResult.error
  if (masterResult.error) throw masterResult.error
  if (dailyResult.error) throw dailyResult.error
  if (orderResult.error) throw orderResult.error
  if (paymentResult.error) throw paymentResult.error
  if (statsResult.error) throw statsResult.error

  return {
    config: mapConfig((configResult.data ?? []) as ConfigRow[]),
    menu: mapMenu(
      (masterResult.data ?? []) as MenuMasterRow[],
      (dailyResult.data ?? []) as DailyMenuRow[],
    ),
    orders: ((orderResult.data ?? []) as OrderRow[]).map(mapOrderRow),
    payments: ((paymentResult.data ?? []) as PaymentRow[]).map(mapPaymentRow),
    dailyStats: mapDailyStats((statsResult.data ?? []) as DailyStatRow[]),
  }
}

export async function updateLiveOrderStatus(orderId: string, status: OrderStatus) {
  const client = requireSupabase()
  const payload = {
    payment_status: status,
    callback_time: status === '已付' ? new Date().toISOString() : null,
  }
  const { error } = await client.from('orders').update(payload).eq('id', orderId)
  if (error) throw error
}

export async function deleteLiveOrder(orderId: string) {
  const client = requireSupabase()
  const { error } = await client.from('orders').delete().eq('id', orderId)
  if (error) throw error
}

export async function saveLiveConfig(config: AppConfig) {
  const client = requireSupabase()
  const rows = [
    { key: 'ORDER_DEADLINE_HOUR', value: String(config.orderDeadlineHour), is_public: true },
    { key: 'RM_TO_CNY', value: String(config.exchangeRate), is_public: true },
    { key: 'AUTO_MARK_PAID', value: String(config.autoMarkPaid), is_public: true },
    { key: 'QR_NOTE', value: config.qrNote, is_public: true },
    { key: 'LAUNCH_BUDGET', value: config.launchBudget, is_public: true },
  ]
  const { error } = await client.from('app_config').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

export async function saveLiveMenu(menu: MealItem[]) {
  const client = requireSupabase()
  const today = TODAY()
  const masterPayload = menu.map((meal) => ({
    id: meal.id,
    name: meal.name,
    category: meal.category,
    flavor: meal.flavor,
    base_price: meal.basePrice,
    cost: meal.cost,
  }))
  const dailyPayload = menu.map((meal) => ({
    menu_date: today,
    meal_id: meal.id,
    today_price: meal.todayPrice,
    is_available: meal.availableToday,
  }))

  const [masterResult, dailyResult] = await Promise.all([
    client.from('menu_master').upsert(masterPayload),
    client.from('daily_menu').upsert(dailyPayload, { onConflict: 'menu_date,meal_id' }),
  ])

  if (masterResult.error) throw masterResult.error
  if (dailyResult.error) throw dailyResult.error
}
