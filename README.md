# 晨味订餐台

一个面向中文场景的低成本订餐网页原型，包含用户端和管理员端，参考你提供的 Apps Script 订餐流程做了网页化设计：

- 用户端：首页下单、支付页、截图上传、我的订单
- 管理员端：今日订单、付款记录、今日菜单、经营统计、每日汇总
- 上线方案：Cloudflare Pages + Supabase + 对象存储

当前仓库默认运行在“演示模式”，数据保存在浏览器 `localStorage`，方便先确认页面和流程。正式上线时，把数据层切换到 Supabase 即可。

## 现在支持两种运行模式

- 演示模式：未配置 Supabase 环境变量时自动启用，本地 `localStorage` 保存数据
- 实时模式：配置 Supabase 后自动启用，订单、菜单、截图和后台登录都走真实后端

## 本地启动

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

## 开启实时模式

1. 复制 [.env.example](/C:/project/UTM&KS launch/.env.example) 为 `.env`
2. 填入你自己的 Supabase 项目地址和匿名 Key
3. 在 Supabase SQL Editor 执行 [schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)
4. 重新运行 `npm run dev`

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 当前已实现的页面能力

- 用户端下单：输入姓名、勾选今日菜单、生成订单
- 支付面板：展示 RM 与折算 CNY，选择支付宝 / 微信，上传付款截图文件名
- 我的订单：按姓名查看今天的订单并继续支付
- 管理员订单台：搜索订单、修改支付状态、删除订单
- 菜单设置：控制今日上架、基础售价、今日售价、成本
- 汇总统计：按“已付”订单自动生成总售出、总成本、总利润和 summary
- DailyStats：按日期聚合每日快照

## 推荐上线架构

### 前端

- 部署平台：Cloudflare Pages / Netlify / Vercel
- 技术栈：React + Vite
- 成本：静态站点一般可长期保持低成本甚至免费

### 后端

- 数据库：Supabase Postgres
- 文件存储：Supabase Storage
- 管理员登录：Supabase Auth
- 订单统计：可先前端聚合，后续改成 SQL 视图或 Edge Function
- 当前代码已内置 Supabase 客户端和对象存储上传逻辑

### 支付

- 最省成本方案：继续使用支付宝 / 微信静态收款码
- 用户付款后上传截图
- 简化版：上传即自动标记“已付”
- 更稳妥版：上传后先标记“待核验”，管理员确认后再变“已付”

## 目录说明

- [src/App.tsx](/C:/project/UTM&KS launch/src/App.tsx)：主界面和核心状态管理
- [src/views/UserView.tsx](/C:/project/UTM&KS launch/src/views/UserView.tsx)：用户端视图
- [src/views/AdminView.tsx](/C:/project/UTM&KS launch/src/views/AdminView.tsx)：管理员端视图
- [src/views/LaunchView.tsx](/C:/project/UTM&KS launch/src/views/LaunchView.tsx)：上线方案页面
- [src/demoData.ts](/C:/project/UTM&KS launch/src/demoData.ts)：演示数据和统计逻辑
- [supabase/schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)：推荐的数据库结构
- [docs/launch-plan.md](/C:/project/UTM&KS launch/docs/launch-plan.md)：上线落地说明

## 下一步怎么接成真实系统

1. 先在 Supabase 执行 [schema.sql](/C:/project/UTM&KS launch/supabase/schema.sql)。
2. 在 Auth 里创建一个管理员账号。
3. 执行下面这条 SQL，把这个账号加入管理员名单。
4. 配置 `.env` 后部署前端到 Cloudflare Pages / Vercel / Netlify。

```sql
insert into public.admin_users (user_id, email)
select id, email
from auth.users
where email = '你的管理员邮箱'
on conflict (user_id) do nothing;
```

## 说明

当前版本已经具备“直接上线的前端 + Supabase 后端接入能力”。如果你要，我下一步还可以继续帮你补：

- Firebase 版
- 纯静态 + Google Sheets 轻量版
- 可部署到国内服务器的 Node.js 版
- 订单导出 Excel / CSV
- 企业微信或 Telegram 自动通知
