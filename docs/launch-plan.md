# UTM-KS Launch 上线方案

## 目标

把当前项目直接作为正式版订餐系统上线，覆盖：

- 用户注册 / 登录
- 用户选餐下单
- 静态码支付
- 上传付款截图
- 管理员查看订单和付款记录
- 自动统计每日销量、成本、利润

## 推荐技术组合

- 前端：Cloudflare Pages / Vercel / Netlify
- 数据：Supabase Postgres
- 图片：Supabase Storage
- 登录：Supabase Auth

这套组合适合低成本上线，不需要自建服务器。

## 初始化步骤

### 1. 创建 Supabase 项目

- 新建一个 Supabase 项目
- 打开 SQL Editor
- 执行 [schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)

### 2. 创建内部管理员账号

- 在 Authentication 里创建邮箱密码账号
- 推荐直接创建：
  - 邮箱：`admin@example.com`
  - 密码：`abc123`

### 3. 管理员白名单

- `schema.sql` 会自动预置 `admin@example.com` 到 `admin_users`
- 只要 Authentication 中创建的是同一个邮箱，触发器会自动关联

如果后续还要增加内部管理员：

```sql
insert into public.admin_users (email)
values ('manager@example.com')
on conflict (email) do nothing;
```

然后再去 Authentication 里创建同邮箱账号。

### 4. 配置前端环境变量

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. 部署前端

- Cloudflare Pages
- Vercel
- Netlify

把上面的两个 `VITE_` 环境变量填到部署平台即可。

## 数据表设计

### `user_profiles`

普通用户资料表：

- 用户 ID
- 真实姓名
- 邮箱
- 电话

### `admin_users`

内部管理员白名单：

- 邮箱
- 认证用户 ID
- 创建时间

### `menu_master`

完整菜单主数据：

- 名称
- 基础售价
- 成本
- 分类
- 是否默认启用

### `daily_menu`

当天实际可售菜单：

- 日期
- 餐点
- 今日售价
- 是否上架

### `orders`

一笔订单一条记录：

- 用户 ID
- 订单号
- 用户姓名
- 下单时间
- 支付方式
- 支付状态
- 支付截图文件路径
- 支付备注
- 支付回调时间

### `order_items`

一笔订单可以有多个餐点：

- 订单 ID
- 餐点 ID
- 餐点名称
- 下单时售价
- 下单时成本

### `payments`

付款截图记录：

- 订单号
- 姓名
- 支付方式
- 文件路径
- 上传时间
- 状态

### `daily_stats`

按天存日报：

- 日期
- 总售出
- 总成本
- 总利润
- 已付订单数
- 备注

## 页面规划

### 用户端

- 注册 / 登录
- 首页下单
- 支付页
- 我的订单

### 管理员端

- 今日订单台
- 今日菜单设置
- 付款截图记录
- 每日统计看板

## 当前正式版已具备的内容

- 用户注册后自动写入 `user_profiles`
- 用户登录后直接下单，不再输入姓名
- 我的订单自动读取当前账号当日订单
- 付款截图上传到 Supabase Storage
- 管理员通过内部白名单登录后台
- 管理员读取订单、付款记录、菜单和日报
- 管理员修改支付状态、保存菜单、保存系统配置
- DailyStats 自动汇总

## 上线建议

- 如果你追求极简运营，可以保留 `未付 / 已付`
- 如果你更在意核验流程，可以保留 `未付 / 待核验 / 已付`
- 当前代码已支持这两种模式，通过 `AUTO_MARK_PAID` 控制
