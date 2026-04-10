import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import './App.css'
import { ConfirmPrompt } from './components/ConfirmPrompt'
import { HeroHeader } from './components/HeroHeader'
import { NoticeBanner } from './components/NoticeBanner'
import { PasswordResetDialog } from './components/PasswordResetDialog'
import { TopNav } from './components/TopNav'
import {
  checkIsAdmin,
  cleanupExpiredPaymentProofs,
  createPaymentProofSignedUrl,
  createLiveOrder,
  deleteLiveOrder,
  fetchAdminDashboard,
  fetchCurrentProfile,
  fetchMyOrders,
  fetchPublicBootstrap,
  getCurrentSession,
  saveLiveConfig,
  saveLiveMenu,
  signInAdmin,
  signInUser,
  signOutAdmin,
  signOutCurrentUser,
  signUpUser,
  subscribeToAuthChanges,
  syncLiveExchangeRate,
  updateLiveOrderStatus,
  resetManagedUserTemporaryPassword,
  updateCurrentUserSettings,
  updateManagedUserProfile,
  uploadAdminPaymentQr,
  uploadPaymentProof,
} from './lib/liveApi'
import { buildTodayOverview, createEmptyState, getDateKey, isPastDeadline } from './lib/orderUtils'
import { isSupabaseConfigured } from './lib/supabaseClient'
import type {
  AppConfig,
  AppState,
  DailyStatsRow,
  ManagedUserProfile,
  MealItem,
  NavigationView,
  OrderRecord,
  OrderStatus,
  PaymentChannel,
  PaymentRecord,
  UserProfile,
} from './types'
import { AdminView } from './views/AdminView'
import { AdminLoginView } from './views/AdminLoginView'
import { HomeView } from './views/HomeView'
import { UserCenterView } from './views/UserCenterView'
import { UserRegisterView } from './views/UserRegisterView'
import { UserView } from './views/UserView'

type Notice = {
  tone: 'success' | 'warning'
  title: string
  description: string
}

type ConfirmPromptState = {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void> | void
}

type PasswordResetResult = {
  targetName: string
  targetEmail: string
  temporaryPassword: string
}

type RefreshScope = {
  public?: boolean
  user?: boolean
  admin?: boolean
}

type PendingQrUpload = {
  file: File
  fileName: string
  previewUrl: string
}

const ACTIVE_VIEW_STORAGE_KEY = 'utm-ks-launch-active-view'

function getStoredActiveView(): NavigationView {
  if (typeof window === 'undefined') {
    return 'home'
  }

  const raw = window.sessionStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)
  if (
    raw === 'home' ||
    raw === 'register' ||
    raw === 'admin-login' ||
    raw === 'user' ||
    raw === 'user-center' ||
    raw === 'admin'
  ) {
    return raw
  }

  return 'home'
}

type ExchangeRateMeta = {
  publishedOn: string
  source: string
} | null

const isLiveMode = isSupabaseConfigured

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function cloneConfig(config: AppConfig): AppConfig {
  return { ...config }
}

function cloneMenu(menu: MealItem[]): MealItem[] {
  return menu.map((meal) => ({ ...meal }))
}

function cloneManagedUsers(users: ManagedUserProfile[]): ManagedUserProfile[] {
  return users.map((user) => ({ ...user }))
}

function normalizeMenu(menu: MealItem[]) {
  return [...menu]
    .map((meal) => ({ ...meal }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function normalizeManagedUsers(users: ManagedUserProfile[]) {
  return [...users]
    .map((user) => ({ ...user }))
    .sort((left, right) => left.userId.localeCompare(right.userId))
}

function getRefreshScopeForView(view: NavigationView): RefreshScope {
  if (view === 'admin') {
    return { public: false, user: false, admin: true }
  }

  if (view === 'user' || view === 'user-center') {
    return { public: true, user: true, admin: false }
  }

  return { public: true, user: false, admin: false }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function App() {
  const [appState, setAppState] = useState<AppState>(() => createEmptyState())
  const [activeView, setActiveView] = useState<NavigationView>(() => getStoredActiveView())
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('\u652f\u4ed8\u5b9d')
  const [paymentFileName, setPaymentFileName] = useState('')
  const [paymentFile, setPaymentFile] = useState<File | null>(null)
  const [paymentNote, setPaymentNote] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [userOrders, setUserOrders] = useState<OrderRecord[]>([])
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStatsRow[]>([])
  const [managedUsers, setManagedUsers] = useState<ManagedUserProfile[]>([])
  const [exchangeRateMeta, setExchangeRateMeta] = useState<ExchangeRateMeta>(null)
  const [bootLoading, setBootLoading] = useState(isLiveMode)
  const [actionPending, setActionPending] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(isLiveMode)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false)
  const [userLoginName, setUserLoginName] = useState('')
  const [userLoginPassword, setUserLoginPassword] = useState('')
  const [registerUsername, setRegisterUsername] = useState('')
  const [registerFullName, setRegisterFullName] = useState('')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [adminLoginName, setAdminLoginName] = useState('admin@example.com')
  const [adminPassword, setAdminPassword] = useState('')
  const [requestedAuthView, setRequestedAuthView] = useState<'user' | 'admin' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmPrompt, setConfirmPrompt] = useState<ConfirmPromptState | null>(null)
  const [passwordResetResult, setPasswordResetResult] = useState<PasswordResetResult | null>(null)
  const [passwordResetCopied, setPasswordResetCopied] = useState(false)
  const [confirmPending, setConfirmPending] = useState(false)
  const [saveAllPending, setSaveAllPending] = useState(false)
  const [exchangeRatePending, setExchangeRatePending] = useState(false)
  const [openingProofPath, setOpeningProofPath] = useState<string | null>(null)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [adminConfigBaseline, setAdminConfigBaseline] = useState<AppConfig | null>(null)
  const [adminMenuBaseline, setAdminMenuBaseline] = useState<MealItem[]>([])
  const [adminUsersBaseline, setAdminUsersBaseline] = useState<ManagedUserProfile[]>([])
  const [profileUsername, setProfileUsername] = useState('')
  const [profileFullName, setProfileFullName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [pendingAlipayQrUpload, setPendingAlipayQrUpload] = useState<PendingQrUpload | null>(null)
  const [pendingWechatQrUpload, setPendingWechatQrUpload] = useState<PendingQrUpload | null>(null)

  const todayKey = getDateKey(new Date().toISOString())

  const refreshPublicData = useCallback(async () => {
    if (!isLiveMode) return

    const data = await fetchPublicBootstrap()
    setAppState((current) => ({
      ...current,
      config: data.config,
      menu: data.menu,
    }))
    setDailyStats(data.dailyStats)
    setExchangeRateMeta(data.exchangeRateMeta)
  }, [])

  const refreshAdminData = useCallback(
    async (force = false) => {
      if (!isLiveMode || (!force && !isAdminAuthorized)) return

      const data = await fetchAdminDashboard()
      const nextConfig = cloneConfig(data.config)
      const nextMenu = cloneMenu(data.menu)
      const nextUsers = cloneManagedUsers(data.users)

      setAppState((current) => ({
        ...current,
        config: nextConfig,
        menu: nextMenu,
      }))
      setAdminOrders(data.orders)
      setPayments(data.payments)
      setDailyStats(data.dailyStats)
      setManagedUsers(nextUsers)
      setExchangeRateMeta(data.exchangeRateMeta)
      setAdminConfigBaseline(cloneConfig(nextConfig))
      setAdminMenuBaseline(cloneMenu(nextMenu))
      setAdminUsersBaseline(cloneManagedUsers(nextUsers))
    },
    [isAdminAuthorized],
  )

  const refreshUserData = useCallback(async () => {
    if (!isLiveMode) return

    setOrdersLoading(true)
    try {
      const [profile, orders] = await Promise.all([fetchCurrentProfile(), fetchMyOrders()])
      setCurrentUserProfile(profile)
      setUserOrders(orders)
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const syncSessionContext = useEffectEvent(async (session: Session | null) => {
    setCurrentSession(session)

    if (!session) {
      setCurrentUserProfile(null)
      setUserOrders([])
      setIsAdminAuthorized(false)
      setAdminOrders([])
      setPayments([])
      setManagedUsers([])
      setAdminConfigBaseline(null)
      setAdminMenuBaseline([])
      setAdminUsersBaseline([])
      if (activeView === 'user' || activeView === 'user-center' || activeView === 'admin') {
        setActiveView('home')
      }
      return
    }

    const [, admin] = await Promise.all([refreshUserData(), checkIsAdmin()])
    setIsAdminAuthorized(admin)

    if (admin) {
      await refreshAdminData(true)
    } else {
      setAdminOrders([])
      setPayments([])
      setManagedUsers([])
      setAdminConfigBaseline(null)
      setAdminMenuBaseline([])
      setAdminUsersBaseline([])
    }

    if (requestedAuthView === 'admin') {
      setRequestedAuthView(null)
      if (admin) {
        setActiveView('admin')
      } else {
        setActiveView('admin-login')
        setNotice({
          tone: 'warning',
          title: '当前账户无后台访问权限',
          description: '请使用已加入管理员名单的内部账户登录管理后台。',
        })
      }
      return
    }

    if (requestedAuthView === 'user') {
      setRequestedAuthView(null)
      setActiveView(activeView === 'user-center' ? 'user-center' : 'user')
      return
    }

    if (admin) {
      setActiveView('admin')
    } else if (activeView === 'user' || activeView === 'user-center') {
      setActiveView(activeView)
    } else {
      setActiveView('user')
    }

    void cleanupExpiredPaymentProofs().catch(() => {
      return null
    })
  })

  useEffect(() => {
    if (!isLiveMode) {
      setBootLoading(false)
      setAuthLoading(false)
      return
    }

    let mounted = true

    async function bootstrap() {
      try {
        setBootLoading(true)
        await refreshPublicData()

        const session = await getCurrentSession()
        if (!mounted) return

        await syncSessionContext(session)
      } catch (error) {
        if (!mounted) return

        setNotice({
          tone: 'warning',
          title: '系统初始化未完成',
          description: getErrorMessage(
            error,
            '请检查 Supabase 环境变量、数据库结构及访问策略是否已正确配置。',
          ),
        })
      } finally {
        if (mounted) {
          setBootLoading(false)
          setAuthLoading(false)
        }
      }
    }

    void bootstrap()

    const subscription = subscribeToAuthChanges((_, session) => {
      setAuthLoading(true)
      void syncSessionContext(session)
        .catch((error) => {
          setNotice({
            tone: 'warning',
            title: '账户状态同步失败',
            description: getErrorMessage(
              error,
              '请确认用户资料表、管理员名单及认证配置均已正确初始化。',
            ),
          })
        })
        .finally(() => {
          setAuthLoading(false)
        })
    })

    return () => {
      mounted = false
      subscription.data.subscription.unsubscribe()
    }
  }, [refreshPublicData])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current))
    }, notice.tone === 'success' ? 2800 : 4200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [notice])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView)
  }, [activeView])

  const availableMeals = appState.menu.filter((meal) => meal.availableToday)
  const selectedMeals = availableMeals.filter((meal) => selectedMealIds.includes(meal.id))
  const draftTotal = selectedMeals.reduce((sum, meal) => sum + meal.todayPrice, 0)
  const selectedOrder =
    userOrders.find((order) => order.id === selectedOrderId) ??
    userOrders.find((order) => order.paymentStatus !== '\u5df2\u4ed8') ??
    null

  const todayOverview = useMemo(() => {
    if (isAdminAuthorized && adminOrders.length > 0) {
      return buildTodayOverview(
        {
          config: appState.config,
          menu: appState.menu,
          orders: adminOrders,
          payments,
        },
        todayKey,
      )
    }

    const todayStat = dailyStats.find((row) => row.date === todayKey)

    return {
      totalSold: todayStat?.totalSold ?? 0,
      totalCost: todayStat?.totalCost ?? 0,
      totalProfit: todayStat?.totalProfit ?? 0,
      totalOrders: userOrders.length,
      paidOrders: todayStat?.paidOrders ?? 0,
      unpaidOrders: userOrders.filter((order) => order.paymentStatus !== '\u5df2\u4ed8').length,
      summary: [],
    }
  }, [adminOrders, appState.config, appState.menu, dailyStats, isAdminAuthorized, payments, todayKey, userOrders])

  const adminHasPendingChanges = useMemo(() => {
    if (!adminConfigBaseline) return false

    const configChanged =
      JSON.stringify(appState.config) !== JSON.stringify(adminConfigBaseline)
    const menuChanged =
      JSON.stringify(normalizeMenu(appState.menu)) !== JSON.stringify(normalizeMenu(adminMenuBaseline))
    const usersChanged =
      JSON.stringify(normalizeManagedUsers(managedUsers)) !==
      JSON.stringify(normalizeManagedUsers(adminUsersBaseline))

    return (
      configChanged ||
      menuChanged ||
      usersChanged ||
      pendingAlipayQrUpload != null ||
      pendingWechatQrUpload != null
    )
  }, [
    adminConfigBaseline,
    adminMenuBaseline,
    adminUsersBaseline,
    appState.config,
    appState.menu,
    managedUsers,
    pendingAlipayQrUpload,
    pendingWechatQrUpload,
  ])

  const heroCopy = useMemo(() => {
    if (activeView === 'admin') {
      return {
        title: '管理后台',
        description: '集中处理订单、菜单、支付记录、用户资料及每日经营数据。',
      }
    }

    if (activeView === 'user-center') {
      return {
        title: '用户中心',
        description: '在这里维护个人资料、登录邮箱、联系电话及账户密码。',
      }
    }

    return {
      title: '在线订餐',
      description: '登录后可直接下单、提交付款凭证，并查看当日订单记录。',
    }
  }, [activeView])

  const shouldShowBootstrapGate = isLiveMode && bootLoading
  const isBusy = actionPending || bootLoading || authLoading || saveAllPending
  const isAuthView = activeView === 'home' || activeView === 'register' || activeView === 'admin-login'
  const showAppChrome =
    !shouldShowBootstrapGate && (activeView === 'user' || activeView === 'user-center' || activeView === 'admin')
  const canAccessUserPage = Boolean(currentUserProfile) && !isAdminAuthorized
  const canAccessAdminPage = isAdminAuthorized

  useEffect(() => {
    if (!currentUserProfile) return
    setProfileUsername(currentUserProfile.username)
    setProfileFullName(currentUserProfile.fullName)
    setProfileEmail(currentUserProfile.email)
    setProfilePhone(currentUserProfile.phone)
    setProfilePassword('')
  }, [currentUserProfile])

  function switchView(nextView: NavigationView) {
    setActiveView(nextView)
  }

  function openPublicView(nextView: 'home' | 'register' | 'admin-login') {
    setRequestedAuthView(null)
    switchView(nextView)
  }

  function ensureBackendReady(actionText: string) {
    if (isLiveMode) return true

    setNotice({
      tone: 'warning',
      title: '系统尚未完成后端配置',
      description: `当前尚未连接 Supabase，暂时无法执行“${actionText}”。请先完成环境变量配置并重新部署。`,
    })
    return false
  }

  async function refreshLiveSlices(scope?: RefreshScope) {
    if (!ensureBackendReady('刷新数据')) return

    const tasks: Array<Promise<unknown>> = []

    if (scope?.public ?? true) {
      tasks.push(refreshPublicData())
    }

    if ((scope?.user ?? Boolean(currentSession)) && currentSession) {
      tasks.push(refreshUserData())
    }

    if (scope?.admin ?? isAdminAuthorized) {
      tasks.push(refreshAdminData(true))
    }

    await Promise.all(tasks)
  }

  async function handleConfirmProceed() {
    if (!confirmPrompt) return

    const currentPrompt = confirmPrompt
    setConfirmPending(true)

    try {
      await currentPrompt.onConfirm()
    } finally {
      setConfirmPending(false)
      setConfirmPrompt(null)
    }
  }

  async function handleCreateOrder() {
    if (!ensureBackendReady('创建订单')) return

    if (!currentUserProfile) {
      setNotice({
        tone: 'warning',
        title: '请先登录账户',
        description: '订单将自动绑定当前登录账户，无需重复填写姓名。',
      })
      return
    }

    if (selectedMeals.length === 0) {
      setNotice({
        tone: 'warning',
        title: '请选择餐品',
        description: '请至少选择一份今日菜单后再提交订单。',
      })
      return
    }

    if (isPastDeadline(appState.config.orderDeadlineHour)) {
      setNotice({
        tone: 'warning',
        title: '当前已超过下单截止时间',
        description: `系统当前设置的截止时间为 ${appState.config.orderDeadlineHour}:00。`,
      })
      return
    }

    try {
      setActionPending(true)
      const result = await createLiveOrder(selectedMeals.map((meal) => meal.id))
      setSelectedOrderId(result.order_id)
      setSelectedMealIds([])
      setPaymentFileName('')
      setPaymentFile(null)
      setPaymentNote('')
      await refreshLiveSlices({ public: false, user: true, admin: isAdminAuthorized })
      setNotice({
        tone: 'success',
        title: '订单提交成功',
        description: `订单号 ${result.order_no} 已生成，请继续上传付款凭证。`,
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '订单提交失败',
        description: getErrorMessage(error, '请检查订单创建函数及数据库权限配置。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleSubmitPayment() {
    if (!ensureBackendReady('上传付款截图')) return

    if (!selectedOrder) {
      setNotice({
        tone: 'warning',
        title: '当前没有待支付订单',
        description: '请先提交订单，或在“我的订单”中选择一笔订单继续付款。',
      })
      return
    }

    if (!paymentFileName || !paymentFile) {
      setNotice({
        tone: 'warning',
        title: '请先上传付款凭证',
        description: '请选择付款截图后再提交。',
      })
      return
    }

    try {
      setActionPending(true)
      await uploadPaymentProof({
        file: paymentFile,
        orderNo: selectedOrder.orderNo,
        channel: paymentChannel,
        note: paymentNote,
      })
      void cleanupExpiredPaymentProofs().catch(() => {
        return null
      })
      await refreshLiveSlices({ public: true, user: true, admin: isAdminAuthorized })
      setPaymentFile(null)
      setPaymentFileName('')
      setNotice({
        tone: 'success',
        title: '付款凭证提交成功',
        description: '付款状态已同步更新，请留意订单状态变化。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '付款凭证提交失败',
        description: getErrorMessage(error, '请检查 payment-proofs 存储桶及付款登记函数配置。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  function handleUseOrderForPayment(orderId: string) {
    setSelectedOrderId(orderId)
    setPaymentFileName('')
    setPaymentFile(null)
    switchView('user')
  }

  async function handleDeleteOrder(orderId: string) {
    if (!ensureBackendReady('删除订单')) return

    try {
      setActionPending(true)
      await deleteLiveOrder(orderId)
      if (selectedOrderId === orderId) {
        setSelectedOrderId(null)
      }
      await refreshLiveSlices({ public: false, user: false, admin: true })
      setNotice({
        tone: 'success',
        title: '订单已删除',
        description: '相关订单数据及统计结果已同步更新。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '删除订单失败',
        description: getErrorMessage(error, '请确认当前管理员账户已获得正确授权。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleUpdateOrderStatus(orderId: string, status: OrderStatus) {
    if (!ensureBackendReady('更新订单状态')) return

    try {
      setActionPending(true)
      await updateLiveOrderStatus(orderId, status)
      await refreshLiveSlices({ public: false, user: false, admin: true })
      setNotice({
        tone: 'success',
        title: '订单状态已更新',
        description: '订单状态及每日统计数据已完成同步。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '更新订单状态失败',
        description: getErrorMessage(error, '请确认当前管理员账户已获得正确授权。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  function handleUpdateManagedUserField(
    userId: string,
    field: 'username' | 'fullName' | 'email' | 'phone',
    value: string,
  ) {
    setManagedUsers((current) =>
      current.map((user) => (user.userId === userId ? { ...user, [field]: value } : user)),
    )
  }

  function handleAddMeal() {
    const nextIndex = appState.menu.length + 1

    setAppState((current) => ({
      ...current,
      menu: [
        ...current.menu,
        {
          id: crypto.randomUUID(),
          name: `新菜品 ${nextIndex}`,
          category: '自定义',
          flavor: '常规',
          basePrice: 0,
          todayPrice: 0,
          cost: 0,
          availableToday: true,
        },
      ],
    }))

    setNotice({
      tone: 'success',
      title: '已新增菜品草稿',
      description: '请补充菜品名称、分类、口味及价格后，再保存后台修改。',
    })
  }

  async function handleQrFilePick(channel: PaymentChannel, file: File | null) {
    if (!file) {
      if (channel === '支付宝') {
        setPendingAlipayQrUpload(null)
      } else {
        setPendingWechatQrUpload(null)
      }
      return
    }

    try {
      const previewUrl = await readFileAsDataUrl(file)
      const payload = {
        file,
        fileName: file.name,
        previewUrl,
      }

      if (channel === '支付宝') {
        setPendingAlipayQrUpload(payload)
      } else {
        setPendingWechatQrUpload(payload)
      }

      setNotice({
        tone: 'success',
        title: `${channel}收款码已选择`,
        description: '请点击顶部的“保存全部修改”，新二维码才会正式生效。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '二维码读取失败',
        description: getErrorMessage(error, '请重新选择一张可用的图片文件。'),
      })
    }
  }

  async function handleDownloadPaymentQr(channel: PaymentChannel, qrUrl: string) {
    try {
      const response = await fetch(qrUrl)
      if (!response.ok) {
        throw new Error('下载二维码失败')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `${channel}-收款码.${blob.type.includes('png') ? 'png' : 'jpg'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(qrUrl, '_blank', 'noopener,noreferrer')
    }
  }

  async function handleResetManagedUserPassword(
    userId: string,
    payload: { username: string; fullName: string; email: string; phone: string },
  ) {
    if (!ensureBackendReady('\u91cd\u7f6e\u4e34\u65f6\u5bc6\u7801')) return

    if (!payload.username.trim() || !payload.fullName.trim()) {
      setNotice({
        tone: 'warning',
        title: '用户资料不完整',
        description: '请先补全用户名和真实姓名，再执行临时密码重置。',
      })
      return
    }

    try {
      setResettingUserId(userId)
      const result = await resetManagedUserTemporaryPassword(userId, payload)
      const updatedProfile = result?.profile
        ? {
            userId: result.profile.user_id,
            username: result.profile.username,
            fullName: result.profile.full_name,
            email: result.profile.email,
            phone: result.profile.phone,
            createdAt: result.profile.created_at ?? '',
            updatedAt: result.profile.updated_at ?? '',
          }
        : undefined

      if (updatedProfile) {
        setManagedUsers((current) =>
          current.map((user) => (user.userId === userId ? updatedProfile : user)),
        )
        setAdminUsersBaseline((current) =>
          current.map((user) => (user.userId === userId ? updatedProfile : user)),
        )
      }

      if (!result.temporaryPassword) {
        throw new Error('系统未返回新的临时密码，请重新尝试。')
      }

      setPasswordResetCopied(false)
      setPasswordResetResult({
        targetName: updatedProfile?.fullName || payload.fullName,
        targetEmail: updatedProfile?.email || payload.email,
        temporaryPassword: result.temporaryPassword,
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '临时密码重置失败',
        description: getErrorMessage(error, '请确认管理员权限及相关 Edge Function 已正确部署。'),
      })
    } finally {
      setResettingUserId(null)
    }
  }

  async function handleSaveAdminChanges() {
    if (!ensureBackendReady('\u4fdd\u5b58\u540e\u53f0\u4fee\u6539')) return

    if (!adminHasPendingChanges) {
      setNotice({
        tone: 'warning',
        title: '当前没有待保存的修改',
        description: '请先调整后台内容，再点击“保存全部修改”。',
      })
      return
    }

    const invalidUser = managedUsers.find((user) => !user.username.trim() || !user.fullName.trim())
    const invalidMeal = appState.menu.find((meal) => !meal.name.trim())

    if (invalidUser) {
      setNotice({
        tone: 'warning',
        title: '用户资料未填写完整',
        description:
          '请先补全 ' +
          (invalidUser.fullName || invalidUser.username || '该用户') +
          ' 的用户名和真实姓名。',
      })
      return
    }

    if (invalidMeal) {
      setNotice({
        tone: 'warning',
        title: '菜品信息未填写完整',
        description: '请先补全所有菜品名称，再保存后台修改。',
      })
      return
    }

    const menuChanged =
      JSON.stringify(normalizeMenu(appState.menu)) !== JSON.stringify(normalizeMenu(adminMenuBaseline))
    const changedUsers = managedUsers.filter((user) => {
      const baseline = adminUsersBaseline.find((item) => item.userId === user.userId)
      return !baseline || JSON.stringify(user) !== JSON.stringify(baseline)
    })

    try {
      setSaveAllPending(true)
      const nextConfig = cloneConfig(appState.config)

      if (pendingAlipayQrUpload) {
        const uploadResult = await uploadAdminPaymentQr('支付宝', pendingAlipayQrUpload.file)
        nextConfig.alipayQrUrl = uploadResult.publicUrl
      }

      if (pendingWechatQrUpload) {
        const uploadResult = await uploadAdminPaymentQr('微信', pendingWechatQrUpload.file)
        nextConfig.wechatQrUrl = uploadResult.publicUrl
      }

      const nextConfigChanged =
        adminConfigBaseline != null && JSON.stringify(nextConfig) !== JSON.stringify(adminConfigBaseline)

      const tasks: Array<Promise<unknown>> = []

      if (nextConfigChanged || pendingAlipayQrUpload || pendingWechatQrUpload) {
        tasks.push(saveLiveConfig(nextConfig))
      }

      if (menuChanged) {
        tasks.push(saveLiveMenu(appState.menu))
      }

      if (changedUsers.length) {
        tasks.push(
          Promise.all(
            changedUsers.map((user) =>
              updateManagedUserProfile(user.userId, {
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
              }),
            ),
          ),
        )
      }

      await Promise.all(tasks)

      setAppState((current) => ({ ...current, config: nextConfig }))
      setPendingAlipayQrUpload(null)
      setPendingWechatQrUpload(null)
      await refreshAdminData(true)
      setNotice({
        tone: 'success',
        title: '后台内容已保存',
        description: '系统配置、收款码、菜单设置和用户资料均已同步到数据库。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '后台保存失败',
        description: getErrorMessage(
          error,
          '请检查 app_config、menu_master、daily_menu、user_profiles、payment-qrs 存储桶及管理员权限策略。',
        ),
      })
    } finally {
      setSaveAllPending(false)
    }
  }

  async function handleRefreshExchangeRate() {
    if (!ensureBackendReady('立即同步汇率')) return

    try {
      setExchangeRatePending(true)
      const liveRate = await syncLiveExchangeRate()
      await refreshLiveSlices({ public: true, user: false, admin: isAdminAuthorized })
      setNotice({
        tone: 'success',
        title: '参考汇率已更新',
        description: `系统已从 ${liveRate.source} 获取最新参考汇率并写入数据库。`,
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '参考汇率更新失败',
        description: getErrorMessage(error, '请稍后重试，或检查汇率同步函数是否已正确部署。'),
      })
    } finally {
      setExchangeRatePending(false)
    }
  }

  async function handleViewPaymentProof(proofPath: string, uploadedAt: string) {
    const uploadedTime = new Date(uploadedAt).getTime()
    if (!Number.isNaN(uploadedTime) && Date.now() - uploadedTime > 7 * 24 * 60 * 60 * 1000) {
      setNotice({
        tone: 'warning',
        title: '支付截图已过期',
        description: '支付截图仅保留 7 天，当前截图已超过保留时限。',
      })
      return
    }

    try {
      setOpeningProofPath(proofPath)
      const signedUrl = await createPaymentProofSignedUrl(proofPath)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '支付截图打开失败',
        description: getErrorMessage(error, '请确认截图仍在保留期内，并且 payment-proofs 存储桶权限配置正确。'),
      })
    } finally {
      setOpeningProofPath(null)
    }
  }

  async function handleViewOrderProof(order: OrderRecord) {
    if (!order.paymentProofName) {
      setNotice({
        tone: 'warning',
        title: '当前订单暂无付款凭证',
        description: '该订单尚未上传支付截图，暂时无法查看付款凭证。',
      })
      return
    }

    await handleViewPaymentProof(order.paymentProofName, order.callbackTime ?? order.createdAt)
  }

  async function handleAdminSignIn() {
    if (!ensureBackendReady('登录管理员后台')) return

    if (!adminLoginName.trim() || !adminPassword) {
      setNotice({
        tone: 'warning',
        title: '请完善登录信息',
        description: '请输入管理员邮箱和密码。',
      })
      return
    }

    try {
      setActionPending(true)
      if (currentSession) {
        await signOutCurrentUser()
      }
      setRequestedAuthView('admin')
      await signInAdmin(adminLoginName.trim(), adminPassword)
      setAdminPassword('')
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '管理员登录失败',
        description: getErrorMessage(error, '请确认管理员账户和密码输入正确。'),
      })
      setRequestedAuthView(null)
    } finally {
      setActionPending(false)
    }
  }

  async function performAdminSignOut() {
    if (!ensureBackendReady('退出管理员账号')) return

    try {
      setActionPending(true)
      setRequestedAuthView(null)
      await signOutAdmin()
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '退出失败',
        description: getErrorMessage(error, '请稍后再试。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  function handleAdminSignOut() {
    setConfirmPrompt({
      title: '确认退出管理员账户？',
      description: '退出后将返回首页，如需继续使用后台，请重新登录。',
      confirmLabel: '确认退出',
      onConfirm: performAdminSignOut,
    })
  }

  async function handleUserSignIn() {
    if (!ensureBackendReady('登录用户账号')) return

    if (!userLoginName.trim() || !userLoginPassword) {
      setNotice({
        tone: 'warning',
        title: '请完善登录信息',
        description: '请输入登录邮箱和密码后再登录。',
      })
      return
    }

    try {
      setActionPending(true)
      if (currentSession) {
        await signOutCurrentUser()
      }
      setRequestedAuthView('user')
      await signInUser(userLoginName.trim(), userLoginPassword)
      setUserLoginPassword('')
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '登录失败',
        description: getErrorMessage(error, '请确认登录邮箱和密码输入正确。'),
      })
      setRequestedAuthView(null)
    } finally {
      setActionPending(false)
    }
  }

  async function handleUserSignUp() {
    if (!ensureBackendReady('注册用户账号')) return

    const profileEmail = registerEmail.trim()

    if (
      !registerUsername.trim() ||
      !registerFullName.trim() ||
      !profileEmail ||
      !registerPhone.trim() ||
      !registerPassword
    ) {
      setNotice({
        tone: 'warning',
        title: '注册信息未填写完整',
        description: '请填写用户名、真实姓名、登录邮箱、联系电话和登录密码。',
      })
      return
    }

    try {
      setActionPending(true)
      if (currentSession) {
        await signOutCurrentUser()
      }
      setRequestedAuthView('user')
      const result = await signUpUser({
        username: registerUsername.trim(),
        fullName: registerFullName.trim(),
        email: profileEmail,
        phone: registerPhone.trim(),
        password: registerPassword,
      })

      setRegisterUsername('')
      setRegisterFullName('')
      setRegisterPhone('')
      setRegisterEmail('')
      setRegisterPassword('')

      if (result.needsEmailConfirmation) {
        setRequestedAuthView(null)
        switchView('home')
        setNotice({
          tone: 'success',
          title: '注册成功',
          description: '账户已创建，请先完成邮箱验证，再返回登录页使用邮箱和密码登录。',
        })
      }
    } catch (error) {
      const message = getErrorMessage(error, '请检查用户名或登录邮箱是否已存在。')
      setNotice({
        tone: 'warning',
        title: '用户注册失败',
        description: message,
      })
      setRequestedAuthView(null)
    } finally {
      setActionPending(false)
    }
  }

  async function performUserSignOut() {
    if (!ensureBackendReady('退出当前账号')) return

    try {
      setActionPending(true)
      setRequestedAuthView(null)
      await signOutCurrentUser()
      setNotice({
        tone: 'success',
        title: '已安全退出',
        description: '如需继续使用系统，请重新登录。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '退出失败',
        description: getErrorMessage(error, '请稍后再试。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  function handleUserSignOut() {
    setConfirmPrompt({
      title: '确认退出当前账户？',
      description: '退出后需重新登录，方可继续下单和提交付款凭证。',
      confirmLabel: '退出登录',
      onConfirm: performUserSignOut,
    })
  }

  async function handleUpdateCurrentUserSettings() {
    if (!ensureBackendReady('保存个人信息')) return

    if (!profileUsername.trim() || !profileFullName.trim() || !profileEmail.trim()) {
      setNotice({
        tone: 'warning',
        title: '个人信息未填写完整',
        description: '用户名、真实姓名和登录邮箱不能为空。',
      })
      return
    }

    try {
      setActionPending(true)
      const nextProfile = await updateCurrentUserSettings({
        username: profileUsername,
        fullName: profileFullName,
        email: profileEmail,
        phone: profilePhone,
        password: profilePassword,
      })
      setCurrentUserProfile(nextProfile)
      setProfilePassword('')
      setNotice({
        tone: 'success',
        title: '个人信息已更新',
        description: '个人资料及密码设置已成功保存。',
      })
    } catch (error) {
      setNotice({
        tone: 'warning',
        title: '个人信息保存失败',
        description: getErrorMessage(error, '请检查用户名或登录邮箱是否重复，或确认当前登录状态仍然有效。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div className={isAuthView ? 'shell auth-shell' : 'shell'}>
      {showAppChrome ? (
        <>
          <HeroHeader
            description={heroCopy.description}
            exchangeRateLabel={`参考汇率 1 RM ≈ ${appState.config.exchangeRate.toFixed(4)} CNY`}
            modeLabel={isLiveMode ? '正式后端已连接' : '等待后端配置'}
            orderDeadlineLabel={`今日 ${appState.config.orderDeadlineHour}:00 截止`}
            title={heroCopy.title}
          />

          <TopNav
            activeView={activeView}
            canAccessAdminPage={canAccessAdminPage}
            canAccessUserPage={canAccessUserPage}
            onRefresh={() => {
              if (!ensureBackendReady('刷新数据')) return

              void (async () => {
                try {
                  await refreshLiveSlices(getRefreshScopeForView(activeView))
                  setNotice({
                    tone: 'success',
                    title: '数据已更新',
                    description: '当前页面所需数据已重新同步。',
                  })
                } catch (error) {
                  setNotice({
                    tone: 'warning',
                    title: '刷新数据失败',
                    description: getErrorMessage(error, '请稍后重试，或检查数据库连接是否正常。'),
                  })
                }
              })()
            }}
            onSwitch={switchView}
          />
        </>
      ) : null}

      {notice ? (
        <NoticeBanner
          description={notice.description}
          onClose={() => setNotice(null)}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      {confirmPrompt ? (
        <ConfirmPrompt
          confirmLabel={confirmPrompt.confirmLabel}
          description={confirmPrompt.description}
          isBusy={confirmPending || actionPending}
          onCancel={() => setConfirmPrompt(null)}
          onConfirm={() => void handleConfirmProceed()}
          title={confirmPrompt.title}
        />
      ) : null}

      {passwordResetResult ? (
        <PasswordResetDialog
          copied={passwordResetCopied}
          onClose={() => {
            setPasswordResetResult(null)
            setPasswordResetCopied(false)
          }}
          onCopy={() => {
            void (async () => {
              try {
                await navigator.clipboard.writeText(passwordResetResult.temporaryPassword)
                setPasswordResetCopied(true)
              } catch {
                setNotice({
                  tone: 'warning',
                  title: '复制失败',
                  description: '当前浏览器未能完成复制，请手动记录临时密码。',
                })
              }
            })()
          }}
          targetEmail={passwordResetResult.targetEmail}
          targetName={passwordResetResult.targetName}
          temporaryPassword={passwordResetResult.temporaryPassword}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'home' ? (
        <HomeView
          isBusy={isBusy}
          loginName={userLoginName}
          onGoAdminLogin={() => void openPublicView('admin-login')}
          onGoRegister={() => void openPublicView('register')}
          onLoginNameChange={setUserLoginName}
          onPasswordChange={setUserLoginPassword}
          onSignIn={() => void handleUserSignIn()}
          password={userLoginPassword}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'register' ? (
        <UserRegisterView
          email={registerEmail}
          fullName={registerFullName}
          isBusy={isBusy}
          onEmailChange={setRegisterEmail}
          onFullNameChange={setRegisterFullName}
          onGoLogin={() => void openPublicView('home')}
          onPasswordChange={setRegisterPassword}
          onPhoneChange={setRegisterPhone}
          onSubmit={() => void handleUserSignUp()}
          onUsernameChange={setRegisterUsername}
          password={registerPassword}
          phone={registerPhone}
          username={registerUsername}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'admin-login' ? (
        <AdminLoginView
          isBusy={isBusy}
          loginName={adminLoginName}
          onGoBack={() => void openPublicView('home')}
          onLoginNameChange={setAdminLoginName}
          onPasswordChange={setAdminPassword}
          onSubmit={() => void handleAdminSignIn()}
          password={adminPassword}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'user' ? (
        <UserView
          alipayQrUrl={appState.config.alipayQrUrl}
          autoMarkPaid={appState.config.autoMarkPaid}
          availableMeals={availableMeals}
          currentProfile={currentUserProfile}
          currentSessionEmail={currentSession?.user.email ?? currentUserProfile?.email ?? null}
          draftTotal={draftTotal}
          exchangeRate={appState.config.exchangeRate}
          isBusy={isBusy}
          isOrdersLoading={ordersLoading}
          myOrders={userOrders}
          onCreateOrder={() => void handleCreateOrder()}
          onDownloadPaymentQr={(channel, qrUrl) => void handleDownloadPaymentQr(channel, qrUrl)}
          onGoHome={() => void openPublicView('home')}
          onGoUserCenter={() => switchView('user-center')}
          onMealToggle={(mealId) =>
            setSelectedMealIds((current) =>
              current.includes(mealId) ? current.filter((id) => id !== mealId) : [...current, mealId],
            )
          }
          onPaymentChannelChange={setPaymentChannel}
          onPaymentNoteChange={setPaymentNote}
          onProofPick={(event) => {
            const file = event.target.files?.[0] ?? null
            setPaymentFile(file)
            setPaymentFileName(file?.name ?? '')
          }}
          onSubmitPayment={() => void handleSubmitPayment()}
          onUseOrderForPayment={handleUseOrderForPayment}
          onUserSignOut={() => void handleUserSignOut()}
          onViewOrderProof={(order) => void handleViewOrderProof(order)}
          openingProofPath={openingProofPath}
          orderDeadlineHour={appState.config.orderDeadlineHour}
          paymentChannel={paymentChannel}
          paymentFileName={paymentFileName}
          paymentNote={paymentNote}
          qrNote={appState.config.qrNote}
          selectedMealIds={selectedMealIds}
          selectedOrder={selectedOrder}
          wechatQrUrl={appState.config.wechatQrUrl}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'user-center' ? (
        <UserCenterView
          currentProfile={currentUserProfile}
          email={profileEmail}
          fullName={profileFullName}
          isBusy={isBusy}
          onBackToUserPage={() => switchView('user')}
          onEmailChange={setProfileEmail}
          onFullNameChange={setProfileFullName}
          onPasswordChange={setProfilePassword}
          onPhoneChange={setProfilePhone}
          onSubmit={() => void handleUpdateCurrentUserSettings()}
          onUsernameChange={setProfileUsername}
          password={profilePassword}
          phone={profilePhone}
          username={profileUsername}
        />
      ) : null}

      {!shouldShowBootstrapGate && activeView === 'admin' ? (
        <AdminView
          alipayQrFileName={pendingAlipayQrUpload?.fileName ?? ''}
          alipayQrPreviewUrl={pendingAlipayQrUpload?.previewUrl || appState.config.alipayQrUrl}
          adminSearch={adminSearch}
          adminSessionEmail={currentSession?.user.email ?? null}
          authLoading={authLoading}
          autoMarkPaid={appState.config.autoMarkPaid}
          dailyStats={dailyStats}
          exchangeRate={appState.config.exchangeRate}
          exchangeRatePending={exchangeRatePending}
          saveAllPending={saveAllPending}
          exchangeRatePublishedOn={exchangeRateMeta?.publishedOn ?? null}
          exchangeRateSource={exchangeRateMeta?.source ?? null}
          isAdminAuthorized={isAdminAuthorized}
          isBusy={isBusy}
          isLiveMode={isLiveMode}
          isSwitching={false}
          managedUsers={managedUsers}
          menu={appState.menu}
          onAdminSearchChange={setAdminSearch}
          onAdminSignOut={() => void handleAdminSignOut()}
          onDeleteOrder={(orderId) => void handleDeleteOrder(orderId)}
          onGoHome={() => void openPublicView('home')}
          onQrFilePick={(channel, file) => void handleQrFilePick(channel, file)}
          onRefreshExchangeRate={() => void handleRefreshExchangeRate()}
          onResetManagedUserPassword={(userId, payload) =>
            void handleResetManagedUserPassword(userId, payload)
          }
          onViewPaymentProof={(proofPath, uploadedAt) => void handleViewPaymentProof(proofPath, uploadedAt)}
          onToggleAutoMarkPaid={(value) =>
            setAppState((current) => ({ ...current, config: { ...current.config, autoMarkPaid: value } }))
          }
          onToggleMealAvailability={(mealId) =>
            setAppState((current) => ({
              ...current,
              menu: current.menu.map((meal) =>
                meal.id === mealId ? { ...meal, availableToday: !meal.availableToday } : meal,
              ),
            }))
          }
            onUpdateDeadline={(value) =>
              setAppState((current) => ({
                ...current,
                config: { ...current.config, orderDeadlineHour: value },
              }))
            }
            onUpdateExchangeRate={(value) =>
              setAppState((current) => ({
                ...current,
                config: { ...current.config, exchangeRate: value },
              }))
            }
            onUpdateQrNote={(value) =>
              setAppState((current) => ({
                ...current,
              config: { ...current.config, qrNote: value },
            }))
          }
          hasPendingChanges={adminHasPendingChanges}
          onSaveAll={() => void handleSaveAdminChanges()}
          onAddMeal={handleAddMeal}
          onUpdateManagedUserField={(userId, field, value) =>
            handleUpdateManagedUserField(userId, field, value)
          }
          onUpdateMealTextField={(mealId, field, value) =>
            setAppState((current) => ({
              ...current,
              menu: current.menu.map((meal) => (meal.id === mealId ? { ...meal, [field]: value } : meal)),
            }))
          }
          onUpdateMealField={(mealId, field, value) =>
            setAppState((current) => ({
              ...current,
              menu: current.menu.map((meal) => (meal.id === mealId ? { ...meal, [field]: value } : meal)),
            }))
          }
          onUpdateOrderStatus={(orderId, status) => void handleUpdateOrderStatus(orderId, status)}
          orderDeadlineHour={appState.config.orderDeadlineHour}
          orders={adminOrders}
          payments={payments}
          openingProofPath={openingProofPath}
          qrNote={appState.config.qrNote}
          resettingUserId={resettingUserId}
          todayOverview={todayOverview}
          wechatQrFileName={pendingWechatQrUpload?.fileName ?? ''}
          wechatQrPreviewUrl={pendingWechatQrUpload?.previewUrl || appState.config.wechatQrUrl}
        />
      ) : null}
    </div>
  )
}

export default App
