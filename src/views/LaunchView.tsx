export function LaunchView() {
  return (
    <main className="launch-layout">
      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">低成本上线建议</span>
            <h2>推荐技术架构</h2>
          </div>
        </div>
        <div className="launch-grid">
          <article className="launch-card">
            <strong>前端</strong>
            <p>React + Vite 静态站点，直接部署到 Cloudflare Pages、Netlify 或 Vercel。</p>
          </article>
          <article className="launch-card">
            <strong>数据层</strong>
            <p>Supabase Postgres 负责 Orders、Payments、MenuMaster、DailyStats；对象存储保存截图。</p>
          </article>
          <article className="launch-card">
            <strong>权限</strong>
            <p>用户端匿名下单；管理员端使用邮箱登录并限制到 admin 角色访问后台。</p>
          </article>
          <article className="launch-card">
            <strong>支付方案</strong>
            <p>沿用静态支付宝/微信收款码，最省成本；只要保存截图文件和订单号就能核对。</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">与参考脚本对齐</span>
            <h2>功能映射</h2>
          </div>
        </div>
        <ul className="feature-list">
          <li>首页下单：按当日菜单选餐点，校验截单时间。</li>
          <li>支付页：同时展示 RM 和折算 CNY，支持上传付款截图。</li>
          <li>Orders / Payments：订单状态和付款记录拆分管理。</li>
          <li>profit / summary：后台按“已付”订单自动聚合销量、成本和利润。</li>
          <li>DailyStats：每日只保留一条聚合快照，适合做日报和看板。</li>
          <li>菜单与配置：管理员可调整汇率、截单时间、今日菜单和售价。</li>
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="section-tag">上线步骤</span>
            <h2>一周内落地路线</h2>
          </div>
        </div>
        <ol className="step-list">
          <li>把当前前端部署到测试域名，先给业务确认页面流程和中文文案。</li>
          <li>在 Supabase 建表并执行 `supabase/schema.sql` 导入数据结构。</li>
          <li>把本地演示数据替换成真实 API 或 Supabase 客户端读写。</li>
          <li>给管理员页加登录权限和操作日志，再接正式域名上线。</li>
        </ol>
      </section>

      <section className="panel full-span">
        <div className="panel-head">
          <div>
            <span className="section-tag">为什么便宜</span>
            <h2>成本控制思路</h2>
          </div>
        </div>
        <div className="cost-grid">
          <article className="cost-card">
            <strong>不接复杂支付网关</strong>
            <p>沿用静态码支付，不需要支付平台开户、回调签名和额外服务费。</p>
          </article>
          <article className="cost-card">
            <strong>不自建服务器</strong>
            <p>前端静态托管，后端数据库和文件存储都走 Serverless 免费额度。</p>
          </article>
          <article className="cost-card">
            <strong>统计直接读订单</strong>
            <p>日报和 summary 优先由订单表聚合生成，避免后台系统过重。</p>
          </article>
          <article className="cost-card">
            <strong>按需升级</strong>
            <p>后期再补通知、自动催单、企业微信机器人，不影响当前上线版本。</p>
          </article>
        </div>
      </section>
    </main>
  )
}
