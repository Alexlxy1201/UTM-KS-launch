# UTM-KS Launch

一个面向正式部署的中文订餐系统，包含用户端和管理员端，覆盖用户注册登录、选餐下单、静态码支付、付款截图上传、管理员订单管理和每日统计。

这个仓库现在默认按“上线版”组织：

- 不再依赖浏览器本地假数据作为回退
- 没有配置 Supabase 时，页面只提示缺少配置，不会继续跑测试流程
- 用户通过前台自行注册账号
- 管理员只能在后台内部创建并授权

## 运行方式

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

## 必要环境变量

复制 [.env.example](/C:/project/UTM&KS launch/.env.example) 为 `.env`，然后填写：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 初始化正式后端

1. 在 Supabase SQL Editor 执行 [schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)
2. 在 Authentication 里内部创建管理员账号
3. 推荐管理员账号：
   - 邮箱：`admin@example.com`
   - 密码：`abc123`
4. `schema.sql` 会自动预置 `admin@example.com` 到 `admin_users`
5. 普通用户通过前台自行注册，资料会自动写入 `user_profiles`

如果你要追加新的内部管理员，可以执行：

```sql
insert into public.admin_users (email)
values ('manager@example.com')
on conflict (email) do nothing;
```

然后再去 Authentication 创建同邮箱账号。

## 当前系统能力

- 用户注册：真实姓名、邮箱、电话、密码
- 用户登录后直接下单，不再手填姓名
- 我的订单自动读取当前登录账号的当日订单
- 支付页展示 RM 与折算 CNY
- 付款截图上传到 Supabase Storage
- 管理员登录后查看订单、付款记录、菜单和日报
- 管理员修改订单状态、菜单、系统配置
- DailyStats 自动汇总

## 目录说明

- [src/App.tsx](/C:/project/UTM&KS launch/src/App.tsx)：主界面和核心状态管理
- [src/views/UserView.tsx](/C:/project/UTM&KS launch/src/views/UserView.tsx)：用户端视图
- [src/views/AdminView.tsx](/C:/project/UTM&KS launch/src/views/AdminView.tsx)：管理员端视图
- [src/views/LaunchView.tsx](/C:/project/UTM&KS launch/src/views/LaunchView.tsx)：上线方案页面
- [src/lib/liveApi.ts](/C:/project/UTM&KS launch/src/lib/liveApi.ts)：Supabase 读写接口
- [supabase/schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)：数据库结构、RLS、RPC 和存储策略
- [docs/launch-plan.md](/C:/project/UTM&KS launch/docs/launch-plan.md)：部署落地说明

## 部署建议

- 前端：Cloudflare Pages / Vercel / Netlify
- 数据库：Supabase Postgres
- 文件存储：Supabase Storage
- 认证：Supabase Auth

部署时把 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 配到平台环境变量即可。
