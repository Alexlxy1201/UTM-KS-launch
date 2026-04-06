import type { Session } from '@supabase/supabase-js'
import { useCallback, useDeferredValue, useEffect, useState, useTransition } from 'react'
import './App.css'
import {
  buildDailyStats,
  buildTodayOverview,
  createEmptyState,
  getCustomerOrders,
  getDateKey,
  getLatestPayableOrder,
  isPastDeadline,
  loadInitialState,
} from './demoData'
import { HeroHeader } from './components/HeroHeader'
import { NoticeBanner } from './components/NoticeBanner'
import { TopNav } from './components/TopNav'
import {
  checkIsAdmin,
  createLiveOrder,
  deleteLiveOrder,
  fetchAdminDashboard,
  fetchOrdersByName,
  fetchPublicBootstrap,
  getCurrentSession,
  saveLiveConfig,
  saveLiveMenu,
  signInAdmin,
  signOutAdmin,
  subscribeToAuthChanges,
  updateLiveOrderStatus,
  uploadPaymentProof,
} from './lib/liveApi'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { AdminView } from './views/AdminView'
import { LaunchView } from './views/LaunchView'
import { UserView } from './views/UserView'
import type {
  AppState,
  DailyStatsRow,
  NavigationView,
  OrderRecord,
  OrderStatus,
  PaymentChannel,
  PaymentRecord,
} from './types'

type Notice = {
  tone: 'success' | 'warning'
  title: string
  description: string
}

const isLiveMode = isSupabaseConfigured

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

function App() {
  const [appState, setAppState] = useState<AppState>(() =>
    isLiveMode ? createEmptyState() : loadInitialState(),
  )
  const [activeView, setActiveView] = useState<NavigationView>('user')
  const [isSwitching, startTransition] = useTransition()
  const [customerName, setCustomerName] = useState('林晓')
  const [selectedMealIds, setSelectedMealIds] = useState<string[]>([])
  const [lookupName, setLookupName] = useState('林晓')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('支付宝')
  const [paymentFileName, setPaymentFileName] = useState('')
  const [paymentFile, setPaymentFile] = useState<File | null>(null)
  const [paymentNote, setPaymentNote] = useState('')
  const [adminSearch, setAdminSearch] = useState('')
  const [userOrders, setUserOrders] = useState<OrderRecord[]>([])
  const [adminOrders, setAdminOrders] = useState<OrderRecord[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStatsRow[]>([])
  const [bootLoading, setBootLoading] = useState(isLiveMode)
  const [actionPending, setActionPending] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(isLiveMode)
  const [adminSession, setAdminSession] = useState<Session | null>(null)
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(!isLiveMode)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [notice, setNotice] = useState<Notice | null>({
    tone: 'warning',
    title: isLiveMode ? '实时模式准备中' : '演示模式已开启',
    description: isLiveMode
      ? '检测到 Supabase 环境变量，页面会优先读取真实数据库和对象存储。'
      : '当前版本使用浏览器本地数据完成完整流程演示；配置 Supabase 后会自动切换到真实后端。',
  })

  const deferredLookupName = useDeferredValue(lookupName.trim())
  const deferredAdminSearch = useDeferredValue(adminSearch.trim())
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
  }, [])

  const refreshAdminData = useCallback(
    async (force = false) => {
      if (!isLiveMode || (!force && !isAdminAuthorized)) return
      const data = await fetchAdminDashboard()
      setAppState((current) => ({
        ...current,
        config: data.config,
        menu: data.menu,
      }))
      setAdminOrders(data.orders)
      setPayments(data.payments)
      setDailyStats(data.dailyStats)
    },
    [isAdminAuthorized],
  )

  useEffect(() => {
    if (!isLiveMode) {
      window.localStorage.setItem('meal-ordering-launch-demo', JSON.stringify(appState))
    }
  }, [appState])

  useEffect(() => {
    if (!isLiveMode) return

    let mounted = true

    async function bootstrap() {
      try {
        setBootLoading(true)
        await refreshPublicData()

        const session = await getCurrentSession()
        if (!mounted) return
        setAdminSession(session)

        if (session) {
          const admin = await checkIsAdmin()
          if (!mounted) return
          setIsAdminAuthorized(admin)
          if (admin) {
            await refreshAdminData(true)
          } else {
            setNotice({
              tone: 'warning',
              title: '账号已登录但没有后台权限',
              description: '请把这个账号加入 Supabase 的 admin_users 表后再进入管理员端。',
            })
          }
        } else {
          setIsAdminAuthorized(false)
        }
      } catch (error) {
        if (!mounted) return
        setNotice({
          tone: 'warning',
          title: '实时数据初始化失败',
          description: getErrorMessage(error, '请检查 Supabase 环境变量、表结构和 RLS 配置。'),
        })
      } finally {
        if (mounted) {
          setBootLoading(false)
          setAuthLoading(false)
        }
      }
    }

    void bootstrap()

    const subscription = subscribeToAuthChanges(async (_event, session) => {
      setAdminSession(session)
      setAuthLoading(true)

      if (!session) {
        setIsAdminAuthorized(false)
        setAdminOrders([])
        setPayments([])
        setAuthLoading(false)
        return
      }

      try {
        const admin = await checkIsAdmin()
        setIsAdminAuthorized(admin)
        if (admin) {
          await refreshAdminData(true)
        } else {
          setNotice({
            tone: 'warning',
            title: '登录成功，但还不是管理员',
            description: '请在 admin_users 表中授权该账号后再试。',
          })
        }
      } catch (error) {
        setNotice({
          tone: 'warning',
          title: '管理员权限检查失败',
          description: getErrorMessage(error, '请确认 admin_users 表和 is_admin 函数已经初始化。'),
        })
      } finally {
        setAuthLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.data.subscription.unsubscribe()
    }
  }, [refreshAdminData, refreshPublicData])

  useEffect(() => {
    if (!isLiveMode) return
    if (!deferredLookupName) {
      setUserOrders([])
      return
    }

    let active = true
    setOrdersLoading(true)

    fetchOrdersByName(deferredLookupName)
      .then((rows) => {
        if (active) setUserOrders(rows)
      })
      .catch((error) => {
        if (active) {
          setNotice({
            tone: 'warning',
            title: '读取订单失败',
            description: getErrorMessage(error, '请检查 get_orders_by_name 函数是否已创建。'),
          })
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false)
      })

    return () => {
      active = false
    }
  }, [deferredLookupName])

  const demoUserOrders = getCustomerOrders(appState, deferredLookupName)
  const currentUserOrders = isLiveMode ? userOrders : demoUserOrders
  const currentAdminOrders = isLiveMode ? adminOrders : appState.orders
  const currentPayments = isLiveMode ? payments : appState.payments
  const currentDailyStats = isLiveMode ? dailyStats : buildDailyStats(appState)

  const filteredAdminOrders = currentAdminOrders.filter((order) => {
    if (!deferredAdminSearch) return true
    const keyword = deferredAdminSearch.toLowerCase()
    return (
      order.customerName.toLowerCase().includes(keyword) ||
      order.orderNo.toLowerCase().includes(keyword) ||
      order.items.some((item) => item.mealName.toLowerCase().includes(keyword))
    )
  })

  const availableMeals = appState.menu.filter((meal) => meal.availableToday)
  const selectedMeals = availableMeals.filter((meal) => selectedMealIds.includes(meal.id))
  const draftTotal = selectedMeals.reduce((sum, meal) => sum + meal.todayPrice, 0)
  const selectedOrder =
    currentUserOrders.find((order) => order.id === selectedOrderId) ??
    getLatestPayableOrder(
      {
        config: appState.config,
        menu: appState.menu,
        orders: currentUserOrders,
        payments: currentPayments,
      },
      customerName.trim(),
    )

  const todayOverview = buildOverview()
  const isBusy = actionPending || bootLoading || authLoading

  function buildOverview() {
    if (!isLiveMode || (isAdminAuthorized && currentAdminOrders.length > 0)) {
      return buildTodayOverview(
        {
          config: appState.config,
          menu: appState.menu,
          orders: currentAdminOrders,
          payments: currentPayments,
        },
        todayKey,
      )
    }

    const todayStat = currentDailyStats.find((row) => row.date === todayKey)
    return {
      totalSold: todayStat?.totalSold ?? 0,
      totalCost: todayStat?.totalCost ?? 0,
      totalProfit: todayStat?.totalProfit ?? 0,
      totalOrders: currentUserOrders.length,
      paidOrders: todayStat?.paidOrders ?? 0,
      unpaidOrders: currentUserOrders.filter((order) => order.paymentStatus !== '已付').length,
      summary: [],
    }
  }

  function switchView(nextView: NavigationView) {
    startTransition(() => setActiveView(nextView))
  }

  function createNotice(nextNotice: Notice) {
    setNotice(nextNotice)
  }

  async function handleCreateOrder() {
    const normalizedName = customerName.trim()
    if (!normalizedName || selectedMeals.length === 0) {
      createNotice({
        tone: 'warning',
        title: '下单信息不完整',
        description: '请输入姓名并至少选择一份今日菜单。',
      })
      return
    }

    if (isPastDeadline(appState.config.orderDeadlineHour)) {
      createNotice({
        tone: 'warning',
        title: '当前已经过了截单时间',
        description: `系统当前设置为 ${appState.config.orderDeadlineHour}:00 截止下单。`,
      })
      return
    }

    if (!isLiveMode) {
      const now = new Date().toISOString()
      const nextOrder: OrderRecord = {
        id: crypto.randomUUID(),
        orderNo: `M${getDateKey(now).replaceAll('-', '')}${String(Math.floor(100 + Math.random() * 900))}`,
        customerName: normalizedName,
        createdAt: now,
        orderDate: getDateKey(now),
        paymentStatus: '未付',
        items: selectedMeals.map((meal) => ({
          mealId: meal.id,
          mealName: meal.name,
          unitPrice: meal.todayPrice,
          cost: meal.cost,
        })),
      }

      setAppState((current) => ({ ...current, orders: [nextOrder, ...current.orders] }))
      setSelectedOrderId(nextOrder.id)
      setSelectedMealIds([])
      setLookupName(normalizedName)
      setPaymentFileName('')
      setPaymentFile(null)
      setPaymentNote('')
      createNotice({
        tone: 'success',
        title: '订单已创建',
        description: `订单号 ${nextOrder.orderNo} 已生成，继续上传付款截图即可。`,
      })
      return
    }

    try {
      setActionPending(true)
      const result = await createLiveOrder(
        normalizedName,
        selectedMeals.map((meal) => meal.id),
      )
      setSelectedOrderId(result.order_id)
      setSelectedMealIds([])
      setLookupName(normalizedName)
      setPaymentFileName('')
      setPaymentFile(null)
      setPaymentNote('')
      await refreshPublicData()
      setUserOrders(await fetchOrdersByName(normalizedName))
      if (isAdminAuthorized) {
            await refreshAdminData(true)
      }
      createNotice({
        tone: 'success',
        title: '订单已创建',
        description: `订单号 ${result.order_no} 已写入真实数据库。`,
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '创建订单失败',
        description: getErrorMessage(error, '请检查 create_order_with_items 函数和数据库权限。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleSubmitPayment() {
    if (!selectedOrder) {
      createNotice({
        tone: 'warning',
        title: '没有可支付的订单',
        description: '先创建订单，或者在“我的订单”里继续支付。',
      })
      return
    }

    if (!paymentFileName || (!paymentFile && isLiveMode)) {
      createNotice({
        tone: 'warning',
        title: '还没有上传截图',
        description: '请先选择一张付款截图后再提交。',
      })
      return
    }

    if (!isLiveMode) {
      const paymentTime = new Date().toISOString()
      const nextStatus: OrderStatus = appState.config.autoMarkPaid ? '已付' : '待核验'
      setAppState((current) => ({
        ...current,
        orders: current.orders.map((order) =>
          order.id === selectedOrder.id
            ? {
                ...order,
                paymentStatus: nextStatus,
                paymentChannel,
                paymentProofName: paymentFileName,
                paymentNote: paymentNote.trim(),
                callbackTime: paymentTime,
              }
            : order,
        ),
        payments: [
          {
            id: crypto.randomUUID(),
            orderNo: selectedOrder.orderNo,
            customerName: selectedOrder.customerName,
            channel: paymentChannel,
            proofName: paymentFileName,
            uploadedAt: paymentTime,
            status: nextStatus,
          },
          ...current.payments,
        ],
      }))
      setPaymentFile(null)
      createNotice({
        tone: 'success',
        title: '付款截图已登记',
        description: nextStatus === '已付' ? '这笔订单已经进入统计。' : '这笔订单已进入待核验队列。',
      })
      return
    }

    try {
      setActionPending(true)
      await uploadPaymentProof({
        file: paymentFile!,
        orderNo: selectedOrder.orderNo,
        customerName: selectedOrder.customerName,
        channel: paymentChannel,
        note: paymentNote,
      })
      await refreshPublicData()
      setUserOrders(await fetchOrdersByName(selectedOrder.customerName))
      if (isAdminAuthorized) {
          await refreshAdminData(true)
      }
      setPaymentFile(null)
      setPaymentFileName('')
      createNotice({
        tone: 'success',
        title: '付款截图已上传',
        description: '订单状态已经根据系统配置自动更新。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '上传付款截图失败',
        description: getErrorMessage(error, '请检查 payment-proofs 存储桶和 register_payment 函数。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  function handleUseOrderForPayment(orderId: string) {
    const targetOrder =
      currentUserOrders.find((order) => order.id === orderId) ??
      currentAdminOrders.find((order) => order.id === orderId)

    if (targetOrder) {
      setCustomerName(targetOrder.customerName)
      setLookupName(targetOrder.customerName)
      if (targetOrder.paymentChannel) {
        setPaymentChannel(targetOrder.paymentChannel)
      }
    }

    setSelectedOrderId(orderId)
    setPaymentFileName('')
    setPaymentFile(null)
    switchView('user')
  }

  async function handleDeleteOrder(orderId: string) {
    if (!isLiveMode) {
      setAppState((current) => {
        const target = current.orders.find((order) => order.id === orderId)
        return {
          ...current,
          orders: current.orders.filter((order) => order.id !== orderId),
          payments: current.payments.filter((payment) => payment.orderNo !== target?.orderNo),
        }
      })
      return
    }

    try {
      setActionPending(true)
      await deleteLiveOrder(orderId)
      await refreshPublicData()
      if (lookupName.trim()) {
        setUserOrders(await fetchOrdersByName(lookupName.trim()))
      }
      await refreshAdminData()
      createNotice({
        tone: 'success',
        title: '订单已删除',
        description: '后台数据和日报汇总已经同步刷新。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '删除订单失败',
        description: getErrorMessage(error, '请确认管理员账号已正确授权。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleUpdateOrderStatus(orderId: string, status: OrderStatus) {
    if (!isLiveMode) {
      setAppState((current) => ({
        ...current,
        orders: current.orders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                paymentStatus: status,
                callbackTime: status === '已付' ? new Date().toISOString() : order.callbackTime,
              }
            : order,
        ),
        payments: current.payments.map((payment) =>
          payment.orderNo === current.orders.find((order) => order.id === orderId)?.orderNo
            ? { ...payment, status }
            : payment,
        ),
      }))
      return
    }

    try {
      setActionPending(true)
      await updateLiveOrderStatus(orderId, status)
      await refreshPublicData()
      await refreshAdminData()
      if (lookupName.trim()) {
        setUserOrders(await fetchOrdersByName(lookupName.trim()))
      }
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '更新订单状态失败',
        description: getErrorMessage(error, '请确认管理员账号已正确授权。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleSaveConfig() {
    if (!isLiveMode) {
      createNotice({
        tone: 'success',
        title: '演示模式无需保存',
        description: '当前配置只保存在浏览器本地；接入 Supabase 后这里会写入 app_config 表。',
      })
      return
    }

    try {
      setActionPending(true)
      await saveLiveConfig(appState.config)
      await refreshPublicData()
      await refreshAdminData()
      createNotice({
        tone: 'success',
        title: '系统配置已保存',
        description: '新的截单时间、汇率和支付状态规则已经写入数据库。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '保存系统配置失败',
        description: getErrorMessage(error, '请检查 app_config 表和管理员权限策略。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleSaveMenu() {
    if (!isLiveMode) {
      createNotice({
        tone: 'success',
        title: '演示模式无需保存',
        description: '当前菜单只保存在浏览器本地；接入 Supabase 后这里会写入 menu_master 和 daily_menu。',
      })
      return
    }

    try {
      setActionPending(true)
      await saveLiveMenu(appState.menu)
      await refreshPublicData()
      await refreshAdminData()
      createNotice({
        tone: 'success',
        title: '今日菜单已保存',
        description: '菜单主数据和今日上架状态都已经更新到数据库。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '保存菜单失败',
        description: getErrorMessage(error, '请检查 menu_master、daily_menu 表和管理员权限。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleAdminSignIn() {
    if (!isLiveMode) return
    if (!adminEmail.trim() || !adminPassword) {
      createNotice({
        tone: 'warning',
        title: '管理员登录信息不完整',
        description: '请输入邮箱和密码。',
      })
      return
    }

    try {
      setActionPending(true)
      await signInAdmin(adminEmail.trim(), adminPassword)
      setAdminPassword('')
      createNotice({
        tone: 'success',
        title: '登录请求已发送',
        description: '如果账号已授权为管理员，后台数据会自动加载。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '管理员登录失败',
        description: getErrorMessage(error, '请检查邮箱密码是否正确。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  async function handleAdminSignOut() {
    if (!isLiveMode) return
    try {
      setActionPending(true)
      await signOutAdmin()
      createNotice({
        tone: 'success',
        title: '已退出管理员账号',
        description: '后台数据仍会保留在数据库中，重新登录即可继续管理。',
      })
    } catch (error) {
      createNotice({
        tone: 'warning',
        title: '退出登录失败',
        description: getErrorMessage(error, '请稍后再试。'),
      })
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div className="shell">
      <HeroHeader
        launchBudget={appState.config.launchBudget}
        modeLabel={isLiveMode ? '实时数据模式' : '浏览器演示模式'}
        paidOrders={todayOverview.paidOrders}
        totalSoldLabel={`RM ${todayOverview.totalSold.toFixed(2)}`}
      />

      <TopNav
        activeView={activeView}
        onReset={() => {
          if (isLiveMode) {
            void refreshPublicData()
            if (isAdminAuthorized) {
              void refreshAdminData()
            }
            if (lookupName.trim()) {
              void fetchOrdersByName(lookupName.trim()).then(setUserOrders)
            }
            createNotice({
              tone: 'success',
              title: '已刷新真实数据',
              description: '页面已从数据库重新拉取最新内容。',
            })
            return
          }

          setAppState(loadInitialState(true))
          createNotice({
            tone: 'success',
            title: '演示数据已重置',
            description: '你可以重新演示下单、支付和后台管理流程。',
          })
        }}
        onSwitch={switchView}
      />

      {notice ? (
        <NoticeBanner
          description={notice.description}
          onClose={() => setNotice(null)}
          title={notice.title}
          tone={notice.tone}
        />
      ) : null}

      {activeView === 'user' ? (
        <UserView
          autoMarkPaid={appState.config.autoMarkPaid}
          availableMeals={availableMeals}
          customerName={customerName}
          draftTotal={draftTotal}
          exchangeRate={appState.config.exchangeRate}
          isBusy={isBusy}
          isOrdersLoading={ordersLoading}
          lookupName={lookupName}
          myOrders={currentUserOrders}
          onCreateOrder={() => void handleCreateOrder()}
          onCustomerNameChange={setCustomerName}
          onLookupNameChange={setLookupName}
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
          onSyncLookupName={() => setLookupName(customerName)}
          onUseOrderForPayment={handleUseOrderForPayment}
          orderDeadlineHour={appState.config.orderDeadlineHour}
          paymentChannel={paymentChannel}
          paymentFileName={paymentFileName}
          paymentNote={paymentNote}
          selectedMealIds={selectedMealIds}
          selectedOrder={selectedOrder}
        />
      ) : null}

      {activeView === 'admin' ? (
        <AdminView
          adminEmail={adminEmail}
          adminPassword={adminPassword}
          adminSearch={adminSearch}
          adminSessionEmail={adminSession?.user.email ?? null}
          authLoading={authLoading}
          autoMarkPaid={appState.config.autoMarkPaid}
          dailyStats={currentDailyStats}
          exchangeRate={appState.config.exchangeRate}
          isAdminAuthorized={isAdminAuthorized}
          isBusy={isBusy}
          isLiveMode={isLiveMode}
          isSwitching={isSwitching}
          menu={appState.menu}
          onAdminEmailChange={setAdminEmail}
          onAdminPasswordChange={setAdminPassword}
          onAdminSearchChange={setAdminSearch}
          onAdminSignIn={() => void handleAdminSignIn()}
          onAdminSignOut={() => void handleAdminSignOut()}
          onDeleteOrder={(orderId) => void handleDeleteOrder(orderId)}
          onSaveConfig={() => void handleSaveConfig()}
          onSaveMenu={() => void handleSaveMenu()}
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
          onUpdateMealField={(mealId, field, value) =>
            setAppState((current) => ({
              ...current,
              menu: current.menu.map((meal) => (meal.id === mealId ? { ...meal, [field]: value } : meal)),
            }))
          }
          onUpdateOrderStatus={(orderId, status) => void handleUpdateOrderStatus(orderId, status)}
          onUseOrderForPayment={handleUseOrderForPayment}
          orderDeadlineHour={appState.config.orderDeadlineHour}
          orders={filteredAdminOrders}
          payments={currentPayments}
          todayOverview={todayOverview}
        />
      ) : null}

      {activeView === 'launch' ? <LaunchView /> : null}
    </div>
  )
}

export default App
