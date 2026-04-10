import type { Session } from '@supabase/supabase-js'
import type {
  AppConfig,
  DailyStatsRow,
  ManagedUserProfile,
  MealItem,
  OrderRecord,
  OrderStatus,
  PaymentChannel,
  PaymentRecord,
  UserProfile,
} from '../types'
import { fetchLatestRmToCnyRate } from './exchangeRate'
import { getDateKey } from './orderUtils'
import { supabase } from './supabaseClient'

const TODAY = () => getDateKey(new Date().toISOString())

type ConfigRow = {
  key: string
  value: string
  is_public: boolean
}

type ExchangeRateMeta = {
  publishedOn: string
  source: string
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
  customer_name: string | null
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
  customer_name: string | null
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

type UserProfileRow = {
  user_id: string
  username: string
  full_name: string
  auth_email?: string
  email: string
  phone: string
  created_at?: string | null
  updated_at?: string | null
}

type AdminUserRow = {
  email: string
  user_id: string | null
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

function getConfigValue(rows: ConfigRow[], key: string, fallback = '') {
  return rows.find((row) => row.key === key)?.value ?? fallback
}

function mapConfig(rows: ConfigRow[]): AppConfig {
  return {
    orderDeadlineHour: Number(getConfigValue(rows, 'ORDER_DEADLINE_HOUR', '13')),
    exchangeRate: Number(getConfigValue(rows, 'RM_TO_CNY', '1.7')),
    autoMarkPaid: parseBoolean(getConfigValue(rows, 'AUTO_MARK_PAID', 'true'), true),
    qrNote: getConfigValue(rows, 'QR_NOTE', '支付成功后上传截图即可登记订单。'),
    launchBudget: getConfigValue(rows, 'LAUNCH_BUDGET', '低成本上线'),
    alipayQrUrl: getConfigValue(rows, 'ALIPAY_QR_URL', ''),
    wechatQrUrl: getConfigValue(rows, 'WECHAT_QR_URL', ''),
  }
}

function mapExchangeRateMeta(rows: ConfigRow[]): ExchangeRateMeta | null {
  const publishedOn = getConfigValue(rows, 'RM_TO_CNY_UPDATED_AT', '')
  const source = getConfigValue(rows, 'RM_TO_CNY_SOURCE', '')

  if (!publishedOn && !source) {
    return null
  }

  return {
    publishedOn,
    source,
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
    customerName: row.customer_name ?? '未命名用户',
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
    customerName: row.customer_name ?? '未命名用户',
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

function mapUserProfile(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
  }
}

function mapManagedUserProfile(row: UserProfileRow): ManagedUserProfile {
  return {
    ...mapUserProfile(row),
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

function normalizeAdminManageUserError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()

  if (
    normalized.includes('failed to send a request to the edge function') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('not found') ||
    normalized.includes('404')
  ) {
    return new Error(
      '管理员账户管理服务仍未按新版部署完成。请重新部署 admin-manage-user Edge Function，并确认该函数允许 x-supabase-auth 请求头、已关闭 Verify JWT。',
    )
  }

  if (
    normalized.includes('invalid jwt') ||
    normalized.includes('jwt') ||
    normalized.includes('401')
  ) {
    return new Error(
      '管理员账户管理服务的鉴权配置异常。请重新部署 admin-manage-user Edge Function，并关闭该函数的 JWT 网关校验。',
    )
  }

  return error instanceof Error ? error : new Error(message || '管理员账户管理服务异常。')
}

async function invokeAdminManageUserFunction(body: Record<string, unknown>) {
  const client = requireSupabase()
  const { data: sessionData, error: sessionError } = await client.auth.getSession()

  if (sessionError) throw sessionError
  if (!sessionData.session?.access_token) {
    throw new Error('管理员登录状态已失效，请重新登录后再试。')
  }

  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-user`, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'x-supabase-auth': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw normalizeAdminManageUserError(error)
  }

  const rawText = await response.text()
  let parsed: Record<string, unknown> | null = null

  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const parsedError =
      parsed && typeof parsed.error !== 'undefined' ? String(parsed.error) : ''
    const parsedMessage =
      parsed && typeof parsed.message !== 'undefined' ? String(parsed.message) : ''
    const serverMessage = parsedError || parsedMessage || rawText || `HTTP ${response.status}`

    throw normalizeAdminManageUserError(
      new Error(
        response.status === 401
          ? `401 ${serverMessage}`
          : response.status === 403
            ? '当前账号没有管理员权限。'
            : serverMessage,
      ),
    )
  }

  return (parsed ?? {}) as Record<string, unknown>
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取付款码图片失败。'))
    reader.readAsDataURL(file)
  })
}

async function getRequiredAuthUser() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()

  if (!error && data.user) {
    return data.user
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession()

  if (sessionError) throw sessionError
  if (sessionData.session?.user) {
    return sessionData.session.user
  }

  if (error) {
    throw error
  }

  throw new Error('请先登录后再继续。')
}

async function upsertOwnProfileFromSession() {
  const client = requireSupabase()
  const user = await getRequiredAuthUser()
  const fallbackUsername = String(user.user_metadata.username ?? '').trim() || `user_${user.id.slice(0, 6)}`
  const fallbackName =
    String(user.user_metadata.full_name ?? '').trim() || user.email?.split('@')[0] || fallbackUsername
  const fallbackPhone = String(user.user_metadata.phone ?? '').trim()
  const fallbackProfileEmail = String(
    user.user_metadata.profile_email ?? user.user_metadata.email ?? '',
  ).trim()

  const { data, error } = await client
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        username: fallbackUsername,
        full_name: fallbackName,
        auth_email: user.email ?? '',
        email: fallbackProfileEmail,
        phone: fallbackPhone,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, username, full_name, email, phone, created_at, updated_at')
    .single()

  if (error) throw error
  return mapUserProfile(data as UserProfileRow)
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
    client.from('daily_menu').select('meal_id, today_price, is_available').eq('menu_date', today),
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
    exchangeRateMeta: mapExchangeRateMeta((configResult.data ?? []) as ConfigRow[]),
    menu: mapMenu(
      (masterResult.data ?? []) as MenuMasterRow[],
      (dailyResult.data ?? []) as DailyMenuRow[],
    ),
    dailyStats: mapDailyStats((statsResult.data ?? []) as DailyStatRow[]),
  }
}

export async function fetchCurrentProfile() {
  const client = requireSupabase()
  const user = await getRequiredAuthUser()

  const { data, error } = await client
    .from('user_profiles')
    .select('user_id, username, full_name, email, phone, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (data) return mapUserProfile(data as UserProfileRow)

  return upsertOwnProfileFromSession()
}

export async function fetchMyOrders() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('orders')
    .select(
      'id, order_no, customer_name, ordered_at, order_date, payment_channel, payment_status, payment_proof_path, payment_note, callback_time, order_items(meal_id, meal_name, unit_price, meal_cost)',
    )
    .eq('order_date', TODAY())
    .order('ordered_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as OrderRow[]).map(mapOrderRow)
}

export async function createLiveOrder(mealIds: string[]) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_order_with_items', {
    p_meal_ids: mealIds,
  })

  if (error) throw error

  return data as { order_id: string; order_no: string; customer_name: string }
}

export async function uploadPaymentProof(args: {
  file: File
  orderNo: string
  channel: PaymentChannel
  note: string
}) {
  const client = requireSupabase()
  const user = await getRequiredAuthUser()
  const extension = args.file.name.includes('.') ? args.file.name.split('.').pop() : 'png'
  const baseName = args.file.name.includes('.')
    ? args.file.name.slice(0, args.file.name.lastIndexOf('.'))
    : args.file.name

  const objectPath = `${user.id}/${TODAY()}/${args.orderNo}/${Date.now()}-${sanitizeFileName(
    baseName,
  )}.${extension}`

  const uploadResult = await client.storage.from('payment-proofs').upload(objectPath, args.file, {
    contentType: args.file.type || 'image/png',
    upsert: false,
  })

  if (uploadResult.error) throw uploadResult.error

  const { data, error } = await client.rpc('register_payment', {
    p_order_no: args.orderNo,
    p_payment_channel: args.channel,
    p_proof_path: objectPath,
    p_payment_note: args.note.trim() || null,
  })

  if (error) throw error

  return data as { order_id: string; order_no: string; payment_status: OrderRecord['paymentStatus'] }
}

export async function createPaymentProofSignedUrl(proofPath: string) {
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from('payment-proofs')
    .createSignedUrl(proofPath, 60 * 10)

  if (error) throw error
  return data.signedUrl
}

export async function cleanupExpiredPaymentProofs() {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('cleanup-payment-proofs')

  if (error) throw error
  return data as { ok: boolean; deletedCount: number }
}

export async function signUpUser(args: {
  username: string
  fullName: string
  email: string
  phone: string
  password: string
}) {
  const client = requireSupabase()
  const normalizedUsername = args.username.trim().toLowerCase()
  const normalizedEmail = args.email.trim().toLowerCase()
  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password: args.password,
    options: {
      data: {
        username: normalizedUsername,
        full_name: args.fullName.trim(),
        email: normalizedEmail,
        profile_email: normalizedEmail,
        phone: args.phone.trim(),
      },
    },
  })

  if (error) throw error

  return {
    session: data.session,
    needsEmailConfirmation: !data.session,
  }
}

export async function signInUser(login: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: login.trim().toLowerCase(),
    password,
  })

  if (error) throw error
  return data
}

export async function signInAdmin(login: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: login.trim(),
    password,
  })

  if (error) throw error
  return data
}

export async function signOutCurrentUser() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function signOutAdmin() {
  return signOutCurrentUser()
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

  const [
    configResult,
    masterResult,
    dailyResult,
    orderResult,
    paymentResult,
    statsResult,
    usersResult,
    adminUsersResult,
  ] = await Promise.all([
    client.from('app_config').select('key, value, is_public'),
    client
      .from('menu_master')
      .select('id, name, category, flavor, base_price, cost, default_enabled')
      .order('created_at', { ascending: true }),
    client.from('daily_menu').select('meal_id, today_price, is_available').eq('menu_date', today),
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
    client
      .from('user_profiles')
      .select('user_id, username, full_name, email, phone, created_at, updated_at')
      .order('created_at', { ascending: false }),
    client.from('admin_users').select('email, user_id'),
  ])

  if (configResult.error) throw configResult.error
  if (masterResult.error) throw masterResult.error
  if (dailyResult.error) throw dailyResult.error
  if (orderResult.error) throw orderResult.error
  if (paymentResult.error) throw paymentResult.error
  if (statsResult.error) throw statsResult.error
  if (usersResult.error) throw usersResult.error
  if (adminUsersResult.error) throw adminUsersResult.error

  const adminRows = (adminUsersResult.data ?? []) as AdminUserRow[]
  const adminUserIds = new Set(
    adminRows
      .map((row) => row.user_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )
  const adminEmails = new Set(
    adminRows
      .map((row) => String(row.email ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  const visibleUsers = ((usersResult.data ?? []) as UserProfileRow[]).filter((user) => {
    if (adminUserIds.has(user.user_id)) return false
    if (adminEmails.has(String(user.email ?? '').trim().toLowerCase())) return false
    return true
  })

  return {
    config: mapConfig((configResult.data ?? []) as ConfigRow[]),
    exchangeRateMeta: mapExchangeRateMeta((configResult.data ?? []) as ConfigRow[]),
    menu: mapMenu(
      (masterResult.data ?? []) as MenuMasterRow[],
      (dailyResult.data ?? []) as DailyMenuRow[],
    ),
    orders: ((orderResult.data ?? []) as OrderRow[]).map(mapOrderRow),
    payments: ((paymentResult.data ?? []) as PaymentRow[]).map(mapPaymentRow),
    dailyStats: mapDailyStats((statsResult.data ?? []) as DailyStatRow[]),
    users: visibleUsers.map(mapManagedUserProfile),
  }
}

export async function updateLiveOrderStatus(orderId: string, status: OrderStatus) {
  const client = requireSupabase()
  const payload = {
    payment_status: status,
    callback_time: status === '\u5df2\u4ed8' ? new Date().toISOString() : null,
  }

  const { error } = await client.from('orders').update(payload).eq('id', orderId)
  if (error) throw error
}

export async function updateManagedUserProfile(
  userId: string,
  payload: { username: string; fullName: string; email: string; phone: string; password?: string },
) {
  return invokeAdminManageUserFunction({
    userId,
    username: payload.username.trim(),
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    password: payload.password?.trim() ? payload.password.trim() : undefined,
  })
}

export async function resetManagedUserTemporaryPassword(
  userId: string,
  payload: { username: string; fullName: string; email: string; phone: string },
) {
  const normalizedPayload = {
    userId,
    username: payload.username.trim(),
    fullName: payload.fullName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
  }

  try {
    const data = await invokeAdminManageUserFunction({
      ...normalizedPayload,
      resetTemporaryPassword: true,
    })

    return data as { ok: boolean; profile: UserProfileRow; temporaryPassword: string | null }
  } catch {
    const temporaryPassword = `Temp@${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
    let fallback
    try {
      fallback = await invokeAdminManageUserFunction({
        ...normalizedPayload,
        password: temporaryPassword,
      })
    } catch (error) {
      throw normalizeAdminManageUserError(error)
    }

    return {
      ...(fallback as { ok: boolean; profile: UserProfileRow }),
      temporaryPassword,
    }
  }
}

export async function updateCurrentUserSettings(payload: {
  username: string
  fullName: string
  email: string
  phone: string
  password?: string
}) {
  const client = requireSupabase()
  const user = await getRequiredAuthUser()
  const normalizedUsername = payload.username.trim().toLowerCase()
  const normalizedEmail = payload.email.trim().toLowerCase()

  if (payload.password?.trim() && payload.password.trim().length < 6) {
    throw new Error('新密码至少需要 6 位。')
  }

  const authPayload: {
    email?: string
    password?: string
    data: { username: string; full_name: string; phone: string; profile_email: string }
  } = {
    data: {
      username: normalizedUsername,
      full_name: payload.fullName.trim(),
      phone: payload.phone.trim(),
      profile_email: normalizedEmail,
    },
  }

  if (normalizedEmail && normalizedEmail !== (user.email ?? '').trim().toLowerCase()) {
    authPayload.email = normalizedEmail
  }

  if (payload.password?.trim()) {
    authPayload.password = payload.password.trim()
  }

  const { data: authData, error: authError } = await client.auth.updateUser(authPayload)
  if (authError) throw authError

  const effectiveProfileEmail = (authData.user?.email ?? normalizedEmail).trim().toLowerCase()

  const { data, error } = await client
    .from('user_profiles')
    .update({
      username: normalizedUsername,
      full_name: payload.fullName.trim(),
      auth_email: effectiveProfileEmail,
      email: effectiveProfileEmail,
      phone: payload.phone.trim(),
    })
    .eq('user_id', user.id)
    .select('user_id, username, full_name, email, phone, created_at, updated_at')
    .single()

  if (error) throw error
  return mapUserProfile(data as UserProfileRow)
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
    { key: 'ALIPAY_QR_URL', value: config.alipayQrUrl, is_public: true },
    { key: 'WECHAT_QR_URL', value: config.wechatQrUrl, is_public: true },
  ]

  const { error } = await client.from('app_config').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

export async function syncLiveExchangeRate() {
  const client = requireSupabase()
  const functionNames = ['sync-exchange-rate', 'clever-processor']
  let lastError: unknown = null

  for (const functionName of functionNames) {
    const { data, error } = await client.functions.invoke(functionName, {
      body: {},
    })

    if (!error) {
      return data as {
        ok: boolean
        rate: number
        source: string
        publishedOn: string
      }
    }

    lastError = error
  }

  const fallbackRate = await fetchLatestRmToCnyRate()

  if (!fallbackRate) {
    throw lastError ?? new Error('汇率同步函数不可用，且参考汇率抓取失败。')
  }

  const rows = [
    { key: 'RM_TO_CNY', value: String(fallbackRate.rate), is_public: true },
    { key: 'RM_TO_CNY_SOURCE', value: fallbackRate.source, is_public: true },
    { key: 'RM_TO_CNY_UPDATED_AT', value: fallbackRate.publishedOn || new Date().toISOString(), is_public: true },
    { key: 'RM_TO_CNY_AUTO_UPDATE_HOUR', value: '0', is_public: true },
  ]

  const { error: saveError } = await client.from('app_config').upsert(rows, { onConflict: 'key' })

  if (saveError) {
    throw saveError
  }

  return {
    ok: true,
    rate: fallbackRate.rate,
    source: fallbackRate.source,
    publishedOn: fallbackRate.publishedOn,
  }
}

export async function saveLiveMenu(menu: MealItem[]) {
  const client = requireSupabase()
  const today = TODAY()

  const masterPayload = menu.map((meal) => ({
    id: meal.id,
    name: meal.name.trim(),
    category: meal.category.trim() || null,
    flavor: meal.flavor.trim() || null,
    base_price: meal.basePrice,
    cost: meal.cost,
    default_enabled: meal.availableToday,
  }))

  const dailyPayload = menu.map((meal) => ({
    menu_date: today,
    meal_id: meal.id,
    today_price: meal.todayPrice,
    is_available: meal.availableToday,
  }))

  const [masterResult, dailyResult] = await Promise.all([
    client.from('menu_master').upsert(masterPayload, { onConflict: 'id' }),
    client.from('daily_menu').upsert(dailyPayload, { onConflict: 'menu_date,meal_id' }),
  ])

  if (masterResult.error) throw masterResult.error
  if (dailyResult.error) throw dailyResult.error
}

export async function uploadAdminPaymentQr(channel: PaymentChannel, file: File) {
  const client = requireSupabase()
  const suffix = file.name.includes('.') ? file.name.split('.').pop() : 'png'
  const folder = channel === '支付宝' ? 'alipay' : 'wechat'
  const objectPath = `qrs/${folder}/${Date.now()}-${sanitizeFileName(file.name.replace(/\.[^.]+$/, ''))}.${suffix}`

  const uploadResult = await client.storage.from('payment-qrs').upload(objectPath, file, {
    contentType: file.type || 'image/png',
    upsert: false,
  })

  if (uploadResult.error) {
    const inlineUrl = await readFileAsDataUrl(file)
    return {
      path: objectPath,
      publicUrl: inlineUrl,
    }
  }

  const { data } = client.storage.from('payment-qrs').getPublicUrl(objectPath)
  return {
    path: objectPath,
    publicUrl: data.publicUrl,
  }
}
