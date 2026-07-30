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
