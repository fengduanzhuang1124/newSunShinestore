# 05 — Development Log

本日志从外挂库存系统正式规划阶段开始持续记录。过去没有证据的工作不补造为已执行。

## 2026-07-30 — 需求与设计基线

### 任务

- 确认外挂库存系统第一阶段业务规则；
- 建立正式业务需求、技术设计、数据库设计和 API 初稿；
- 建立权限矩阵和库存流水类型；
- 检查 Mac 开发环境；
- 不创建库存系统代码，不修改现有业务代码。

### 确认内容

- 长期支持多门店，第一阶段启用一个门店；
- 每家门店可有多个仓库，第一阶段启用一个仓库；
- 第一阶段忽略货架；
- 商品按件计数；
- 一个商品可以有多个条码；
- 一个商品可以有多个到期日期；
- 不要求生产日期和供应商批次号；
- 同商品、同到期日期合并当前数量，但保留每次流水；
- 临期使用7个月、6个月和3个月三档；
- 普通库存员工按授权可直接入库和手工出库；
- 管理员维护商品、条码、库存调整和权限；
- 第一阶段不连接第三方 POS。
- 第一阶段货架不纳入库存位置，仓库到货架记为非销售的手工出库，仓库库存与全门店库存需明确区分。

### 解决方案

- 使用 TypeScript、NestJS、Vue 3、MySQL 8.4 和 Prisma；
- 库存流水作为事实来源，库存汇总用于查询；
- 内部批次 ID 代替员工必填批次号；
- 使用企业、门店和仓库范围约束权限；
- 使用幂等键、数据库事务和审计日志保证库存一致性；
- 初始库存支持手工、Excel 草稿导入及边扫码边建立。

### 修改文件

- `docs/01-Business-Requirement.md`
- `docs/02-Technical-Design.md`
- `docs/03-Database-Design.md`
- `docs/04-API-Documentation.md`
- `docs/05-Development-Log.md`
- `docs/06-Testing-Report.md`
- `docs/README.md`
- `docs/project-status-and-roadmap.md`
- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`

### 环境检查

- macOS 26.5，Apple Silicon `arm64`；
- Git 2.50.1 可用；
- Cursor 和 Chrome 已安装；
- Node.js、npm、Docker 和 MySQL CLI 未找到；
- 可用磁盘约364 GiB。

### 测试与构建

- 必需文档存在性检查：通过；
- 文档索引和本地链接检查：通过；
- `git diff --check`：通过；
- 修改范围敏感信息扫描：通过，仅发现明确的占位符；
- 客户数据扫描：通过，未发现真实客户数据；
- 业务代码变更检查：通过，本次没有修改业务代码；
- 业务应用测试：未执行，本次无业务代码变更；
- 应用构建：无法执行，Node.js/npm 尚未安装；
- 数据库 migration：未创建，无法执行。

### 截图

本次没有 UI、页面或运行系统变化，Before/After 截图不适用。首次建立扫码页面时必须保存对应截图到 `docs/10-Screenshots/`。

### Git

- Commit：待用户确认；
- Push：未执行；
- 建议 Commit message：本次结束时提供。

### 用时

由实际工作记录补充，不自动估算。

### 下一步

1. 用户确认业务需求和待确认项；
2. 安装 Node.js、Docker 和开发辅助工具；
3. 创建 `inventory-system/` 项目骨架；
4. 创建 Prisma Schema 和首个 migration；
5. 编写数据库约束及事务测试；
6. 再开发扫码查询页面。

## 2026-07-31 — 外挂库存系统地基代码

### 任务

- 创建独立 `inventory-system/` 工作区；
- 建立 NestJS API、Vue 3 管理端和 Prisma 7 数据库包；
- 建立初始 migration 和自动测试；
- 不开发扫码业务页面，不修改原有电商业务代码。

### 实现

- 使用 pnpm workspace 管理 API、管理端和数据库包；
- 实现 `GET /api/v1/health`；
- 创建管理端地基状态页；
- 创建企业、门店、`store_products`、仓库、商品、多条码、多日期、用户、角色、权限、库存流水、库存余额、调拨、临期设置和审计模型；
- 商品主档属于企业，门店通过 `store_products` 保存启用状态、可选售价和最低库存；
- 生成 `202607310001_inventory_foundation` 初始 migration；
- migration 增加非零流水、非负库存、正数调拨数量和临期阈值顺序 CHECK；
- 调拨来源仓库与目标仓库不同由后端服务校验，避免 MySQL 外键列 CHECK 限制。

### 验证

- Prisma format：通过；
- Prisma validate：通过；
- Prisma Client generate：通过；
- TypeScript/Vue typecheck：通过；
- 自动测试：16项通过；
- NestJS API build：通过；
- Vue production build：通过；
- Prisma Client build：通过；
- `git diff --check`：通过；
- 修改范围密钥/私钥扫描：通过；
- 客户数据候选扫描：通过；
- 依赖、构建产物和 Prisma 生成文件忽略检查：通过；
- MySQL migration 实库执行：最终通过，过程见下方环境与数据库补充。

### 环境与数据库补充

- 安装 Node.js 24.18.1 和 npm 11.16.0；
- 安装并验证 Docker Desktop 29.6.2；
- 使用官方 `hello-world` ARM64 容器验证 Docker Engine；
- 启动 MySQL 8.4.11，端口只绑定 `127.0.0.1:3307`；
- 创建本地、被 Git 忽略的 `.env`；
- 首次 migration 发现 MySQL 外键列 CHECK 限制；
- 删除无业务数据的失败开发数据卷，移除该 CHECK 并从空库重建；
- 初始 migration 最终成功；
- 验证20张表、migration 完成状态和7个关键 CHECK 约束。

### 截图

- Before：本阶段开始前没有 `inventory-system` 页面，不适用；
- After：`docs/10-Screenshots/2026-07-31-inventory-foundation-after.png`。

### Git

- Commit：未执行；
- Push：未执行；
- 建议 Commit message：`feat(inventory): scaffold system foundation and database schema`。

### 下一步

1. 为 Cursor 安装长期 Node.js 和 Docker Desktop；
2. 在 MySQL 8.4 执行 migration 与回滚演练；
3. 建立 Prisma/NestJS 数据库服务；
4. 实现登录、角色和仓库权限；
5. 实现库存事务服务后再开发扫码页面。

## 2026-07-31 — Prisma 连接与数据库集成测试

### 任务

- 建立 NestJS 到 Prisma/MySQL 的正式连接服务；
- 建立独立测试数据库和安全测试数据夹具；
- 验证 migration、关键约束及事务回滚；
- 不开发扫码页面，不修改原有电商业务代码。

### 实现

- 新增 `@sunshine/database` 共享 Client 创建与连接 URL 校验；
- 新增全局 `DatabaseModule` 和 `PrismaService`，处理 NestJS 启停生命周期；
- 增加 `TEST_DATABASE_URL` 示例和测试库名称 `_test` 安全保护；
- 创建完全虚构的企业、门店、仓库、员工、商品、条码和日期测试夹具；
- 增加5项真实 MySQL 集成测试及2项连接配置单元测试；
- API 调整为 ESM 运行与测试配置，保证共享数据库包可被构建和加载。

### 验证

- 测试库 migration：通过；
- 数据库集成测试：5/5通过；
- 数据库包测试：20/20通过；
- Vue 测试：1/1通过；
- NestJS 单元/API 测试：2/2通过；
- 全项目 typecheck：通过；
- 全项目 build：通过。

首次集成测试因连接池内 `FOREIGN_KEY_CHECKS` 只对单个连接生效而失败。测试清理方式已改为按外键依赖顺序执行 `DELETE`，不关闭外键保护，重跑通过。该问题只存在于测试清理器，没有改动 migration 或业务数据。

### 截图

本批次没有页面和视觉变化，新的 Before/After 截图不适用。继续保留上一批管理端地基截图：`docs/10-Screenshots/2026-07-31-inventory-foundation-after.png`。

### Git

- Commit：未执行；
- Push：未执行；
- 建议 Commit message：`test(inventory): add Prisma integration test foundation`。

### 下一步

1. 实现登录、密码哈希和 JWT；
2. 实现门店角色与仓库权限守卫；
3. 实现带幂等、审计和库存汇总更新的库存事务服务；
4. 再开发扫码查询与入库页面。

## 2026-07-31 — 员工登录与扫码入库首轮联调

### 实现

- 创建管理员员工初始化命令并生成随机临时密码；
- 创建 `wf66 / 员工1`，关联第一门店、主仓库和管理员权限；
- 增加 bcrypt 密码哈希、8小时JWT登录和仓库权限验证；
- 增加登录页面、自动聚焦扫码框和扫码入库表单；
- 增加条码查询与扫码入库API；
- 入库事务同步写入商品、条码、门店启用、到期日期、库存余额、`RECEIPT`流水和审计日志；
- 增加 `must_change_password` migration；
- Prisma Client 改用 `prisma-client-js`，修复构建通过但ESM产物无法直接启动的问题。

### 浏览器模拟扫码

- 账号登录：通过；
- 模拟扫码枪逐字符输入条码并发送 Enter：通过；
- 未知条码提示建立商品：通过；
- 填写虚构商品、到期日期和6件数量：通过；
- 页面显示该日期库存6件：通过；
- 数据库商品、条码、库存余额和入库流水核对：通过。

### 截图

- Before：`docs/10-Screenshots/2026-07-31-login-before.png`；
- After：`docs/10-Screenshots/2026-07-31-scan-receive-after.png`。

### 限制

- 当前只实现扫码入库；
- 临时密码修改页面尚未实现；
- 暂未实现手工出库、盘点、调拨和临期列表；
- 本次使用的是浏览器模拟扫码，实体扫码枪仍需员工在店内测试。

### Git

- Commit：未执行；
- Push：未执行；
- 建议 Commit message：`feat(inventory): add employee login and barcode receiving`。

## 2026-07-31 — 修复扫码页面 Failed to fetch

### 原因

管理页面5174端口仍在运行，但NestJS API的3100端口已经停止。浏览器无法建立HTTP连接，因此查询已存在条码和提交新条码都会显示原生 `Failed to fetch`；这不是数据库或条码判断错误。

### 修改

- 增加根目录 `pnpm dev`，并行启动API与管理页面；
- API包增加统一的 `dev` 命令；
- 页面将网络异常转换为“无法连接库存 API，请先在 Cursor 终端运行 pnpm dev”；
- README和技术设计增加本地启动说明。

### 回归验证

- `GET /api/v1/health`：200；
- 查询测试条码 `0942999999001`：成功，返回2027-07-31、6件；
- 查询新条码 `9421907983356`：正确显示新商品编辑状态；
- 按用户截图内容填写 `bepur镁`、2026-11-01、10件并确认入库：成功；
- 数据库库存余额：10件；
- 最新流水：`RECEIPT +10 / BARCODE_RECEIPT`。

### 截图

- Before：用户提供的 `Failed to fetch` 截图；
- After：`docs/10-Screenshots/2026-07-31-failed-fetch-fixed.png`。

### 启动命令兼容修正

Cursor的普通zsh可以找到系统Node/npm/Corepack，但没有系统级`pnpm`快捷命令。根目录脚本原先在Corepack启动后再次调用裸`pnpm`，导致第二层出现`sh: pnpm: command not found`。现已改为脚本内部显式调用`corepack pnpm`，用户可直接运行`npm run dev`。

## 2026-07-31 — 三分类库存工作台

### 实现

- 页面拆分为“点货入库、出库上货架、库存查询”；
- 搜索支持商品关键词、完整条码和部分条码；
- 查询按商品主档聚合多条码，显示各日期数量和总数量；
- 未知条码可创建新品，或经员工确认绑定已有商品；
- 增加按到期日期出库事务、库存不足保护、负数流水和审计日志；
- 所有根目录npm脚本改为通过Corepack调用pnpm，兼容Cursor普通zsh。

### 浏览器与数据库联调

- 关键词 `bepur` 查询：通过；
- 第二条码 `9421907983357` 绑定到已有 `bepur镁`：通过；
- 两条码查询均归入同一商品：通过；
- 日期库存合计：通过；
- 2026-11-01批次上货架出库3件：通过，10件降为7件；
- 出库流水：两次操作分别为 `-2`、`-1`，类型均为 `MANUAL_ISSUE / SHELF_REPLENISHMENT`。

### 截图

- 查询：`docs/10-Screenshots/2026-07-31-three-mode-inventory-query.png`；
- 出库：`docs/10-Screenshots/2026-07-31-manual-issue-after.png`。

### 限制

- 货架库存没有单独建账，上货架后只减少仓库库存；
- 尚未连接POS，不能自动记录真实销售；
- 商品同名不会自动合并，必须由员工确认绑定；
- 暂未实现修改密码、盘点、调拨和临期列表。

## 2026-07-31 — 入库后库存查询反馈修正

### 诊断

- 数据库确认新品 `纽乐植物酵素60粒` 已保存：条码 `94005810038224`、到期日 `2027-03-01`、余额 `250` 件；
- 浏览器手工输入该条码后，库存查询正确返回 `250` 件；
- 根因是入库成功后表单清空，切换“库存查询”时没有保留刚入库条码，用户看到空查询页后误以为数据没有保存。

### 修改

- 页面记住当前会话最后一次成功入库的条码；
- 切换到“库存查询”时自动按该条码查询并显示最新日期库存和总库存；
- 入库成功提示明确说明可以切换到库存查询核对；
- 增加前端自动化回归测试，确认自动带入条码及显示最新余额。

### 截图

- 数据库已有记录并可查询：`docs/10-Screenshots/2026-07-31-new-receipt-query-verified.png`。

## 2026-07-31 — 查询日期信息强化

- 库存查询和出库结果不再只显示裸日期数字；
- 每个库存批次明确显示“到期日期”和“库存数量”；
- 商品卡片继续显示多个日期的总库存，便于员工直接回答客户关于有效期的问题；
- 增加页面测试断言，防止日期标签后续被误删。
- After 截图：`docs/10-Screenshots/2026-07-31-inventory-expiry-date-query.png`。

## 2026-07-31 — 入库关键词查询与月份精度

### 实现

- 点货入库查询框统一为“查询条码 / 商品名称”；
- 商品名称支持部分关键词，不要求输入全称，结果由员工明确选择；
- 新商品仍必须登记条码，已有商品的新条码不会因为同名自动合并；
- 到期信息拆为必填“到期年月”和选填“具体日”；
- 新增 `expiry_precision`，区分月份精度 `MONTH` 与完整日期 `DATE`；
- 月份精度内部用月末日期计算临期，但页面和 API 只显示 `YYYY-MM`，不伪造具体日。

### Migration 联调

- 第一次试跑发现 MySQL 使用旧唯一索引支撑企业外键，直接删除被拒绝；修正为先创建专用企业外键索引；
- 第二次试跑发现自动组合的唯一索引名超过 MySQL 64字符限制；改为短名称 `product_batches_org_product_expiry_precision_key`；
- 两次失败均发生在结构变更阶段，没有删除商品、库存或流水；开发库和测试库恢复到 migration 前结构后重新执行成功；
- 开发库和独立测试库均已应用 `202607310003_expiry_precision`，migration status 为 up to date。

### 截图

- After：`docs/10-Screenshots/2026-07-31-receive-keyword-month-expiry.png`。

## 2026-07-31 — 旧 API 报错修复与页面精简

### 报错原因与处理

- 浏览器已发送新版 `expiryMonth`，3100端口仍运行修改前的 `dist/main`，旧 DTO 只接受 `expiryDate`；
- 旧 API 因白名单校验拒绝请求，未创建入库流水，截图中的130件没有写入库存；
- 停止旧 API 进程，使用最新 build 重新启动，健康路由和库存路由加载成功；
- 页面增加中文日期校验提示，不再直接展示 class-validator 英文属性名。

### 页面精简

- 标题改为“库存管理”；
- 三个导航缩短为“点货入库、出库、查询”；
- 删除重复说明、重复选中商品卡片和额外同名搜索入口；
- 表单缩短为“条码、商品名、到期年月、日（可空）、数量”；
- 缩小页面留白、标题和区块间距，保留员工完成任务所需字段。

### 截图

- After：`docs/10-Screenshots/2026-07-31-simple-inventory-workbench.png`。

## 2026-07-31 — 到期日期输入视觉合并

- 原生完整日期控件无法表达“年月必填、日可空”，因此继续保留年月与日两个数据值；
- 页面将两个输入放进同一个“到期日期”区域，左侧选择年月、右侧填写可选日；
- 员工不再看到两个独立日期字段，后端仍能区分月份精度和完整日期精度。
- After：`docs/10-Screenshots/2026-07-31-combined-expiry-input.png`。

## 2026-07-31 — 入库字段单行布局

- 桌面端将条码、商品名、到期日期、数量四组字段放在同一行；
- 确认入库按钮单独占下一行，避免压缩日期控件；
- 720px以下继续使用单列布局，兼容平板和手机窄屏。
- After：`docs/10-Screenshots/2026-07-31-receive-fields-one-row.png`。

## 2026-07-31 — 同名商品主档合并

### 数据修正

- 确认 `bepur镁` 存在商品ID 2和8两条重复主档；
- 在单一数据库事务中把商品8合并到商品2；
- 保留三个条码 `9421907983356`、`9421907983357`、`94222222222`；
- 保留三个日期库存：5件、220件、200件，总库存425件；
- 库存流水、库存余额和日期批次全部改为指向商品2，未删除流水；
- 删除重复商品8，并写入 `product.merge` 审计记录。

### 防止再次发生

- 未知新条码入库时，若商品名称与现有主档完全相同，后端自动复用最早的有效商品主档；
- 部分关键词仍只用于搜索，命中不同商品名时由员工选择；
- 查询结果继续按商品主档汇总条码、日期和总数量。

### 截图

- Before：`docs/10-Screenshots/2026-07-31-product-merge-before.png`；
- After：`docs/10-Screenshots/2026-07-31-product-merge-after.png`。

## 2026-07-31 — 门店身份、入库时间与品牌视觉

### 业务与账号

- 入库流水继续由数据库自动写入 `created_at`，API新增 `receivedAt` 返回值；
- 明确该时间可用于仓库周转速度，POS未接入前不等同真实销售速度；
- 本机开发库将 `wf66` 所属门店显示名更新为 `sunshine1`；
- 按用户要求更新本地测试密码，数据库只保存bcrypt哈希，明文未写入项目文件；
- 登录DTO允许既有6位测试密码进入真实密码核对，新建正式密码的强度规则仍由创建/改密流程负责；
- 管理员初始化工具支持传入门店代码和名称，员工创建后同时建立门店角色和仓库权限。

### 页面

- 将用户提供的阳光特产Logo优化为240px静态资源并放在左上角；
- 页面增加健康绿色渐变、低对比科技网格、门店胶囊标识和轻量卡片阴影；
- 入库、出库、查询切换增加约200ms淡入/位移动画；
- 增加减少动画系统偏好兼容；
- 浏览器重新登录验证 `wf66` 显示 `sunshine1 · 员工1`。

### 截图

- After：`docs/10-Screenshots/2026-07-31-health-tech-store-workbench.png`。

## 2026-07-31 — USB扫码就绪体验

- 确认普通USB扫码枪采用HID键盘模式时可直接使用，无需扫码枪API、ID或序列号；
- 登录后和模式切换后自动聚焦搜索输入框；
- 输入框聚焦时显示绿色“扫码输入就绪”和轻量脉冲，失焦时提示点击输入框；
- 状态文案只表示网页焦点就绪，不虚假声称已识别具体硬件；
- 动画继续遵循减少动画系统偏好。
- After：`docs/10-Screenshots/2026-07-31-usb-scanner-ready-workbench.png`。

## 2026-07-31 — 健康科技视觉强化与悬浮工具设计

- 背景科技网格对比度增强，加入健康绿径向光晕；
- 工作台增加品牌能量线、右上角科技圆环和Logo外圈光效；
- 输入聚焦、扫码区域和商品卡片增加克制的绿色光影；
- 活动页签增加低频扫光动画，并继续支持减少动画偏好；
- 规划先PWA独立小窗口、后Tauri桌面壳的路线；
- Tauri方案复用当前Vue与NestJS，只增加窗口置顶、托盘和快捷键，不复制数据库。
- After：`docs/10-Screenshots/2026-07-31-health-tech-enhanced-workbench.png`。
