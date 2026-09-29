# POS 同步数据库层

## 当前范围

本阶段仅保存 Moni POS 商品映射、订单、订单明细、同步游标、同步运行记录和退款审核记录。
不会创建 `stock_movements`，不会修改 `inventory_balances`，也不会向 Moni 写入数据。

## 表

- `pos_product_mappings`：门店内的 Moni 商品 ID、Barcode 与本地商品 ID 映射。已解析映射必须有 Barcode。
- `pos_orders`：POS 订单头、源状态、金额、退款金额、来源指纹和模拟库存状态。
- `pos_order_items`：POS 原始明细。数量使用 `DECIMAL(14,4)` 保存称重/小数源数据，与整数库存流水隔离。
- `pos_sync_cursors`：每个门店、供应商和数据流的增量同步游标，并保留五分钟重叠窗口。
- `pos_sync_runs`：每次同步的开始/完成状态、处理计数和脱敏错误摘要。
- `pos_refund_reviews`：无法从 Moni 确认具体退货商品时的人工审核任务。

## 幂等和安全约束

- 一个门店内 `external_order_no` 唯一，重复轮询不会创建重复订单。
- 一个订单内 `line_key` 唯一，重复轮询不会创建重复明细。
- 一个门店、供应商和数据流只有一个同步游标。
- POS 明细不直接关联或创建库存流水；正式扣减必须在后续独立事务中实现。
- 无 Barcode、`food_id=0`、运费和手续费保留为订单明细，但不得建立库存商品映射。

## 迁移

迁移文件：`202608220001_pos_sync_observation/migration.sql`。

应用前必须备份目标数据库，并先在名称以 `_test` 结尾的测试数据库验证。当前开发环境尚未应用该迁移。

## 回滚

本阶段没有业务数据时，可按以下顺序删除：

1. `pos_refund_reviews`
2. `pos_sync_cursors`
3. `pos_order_items`
4. `pos_orders`
5. `pos_sync_runs`
6. `pos_product_mappings`

存在同步数据后不得直接删除，应先导出订单和审核记录，再执行经审批的回滚脚本。

## 2026-08-20 模拟导入结果

隔离测试库 `sunshine_inventory_test` 已应用迁移并完成两次相同数据导入：

- Moni商品：3647；建立有Barcode映射：3521；跳过无Barcode：126。
- POS订单：51；订单明细：199。
- 库存候选明细：181；MISC、运费和手续费等非库存明细：18。
- 未映射明细：0；小数/负向待审核明细：0。
- 第二次导入后仍为51笔订单、199条明细，幂等约束有效。
- 导入前后 `stock_movements` 和 `inventory_balances` 均为0，没有修改真实库存。

## 2026-08-21 至 2026-08-23 模拟导入结果

- 8月21日：47笔订单、96条明细；库存候选82条，非库存14条。
- 8月22日：53笔订单、205条明细；库存候选192条，非库存13条。
- 8月23日：截至导入时间47笔订单、153条明细；库存候选138条，非库存15条。当天尚未结束，需在日结后补拉。
- 三天均为0条未映射、0条小数/负向待审核明细。
- 连同8月20日，测试库累计198笔订单、653条明细，其中库存候选593条、非库存60条。
- 导入前后 `stock_movements` 和 `inventory_balances` 仍均为0。

## 自动模拟同步

模拟进程被强制限制为仅连接名称以 `_test` 结尾的 `TEST_DATABASE_URL`，不会连接正式数据库：

```bash
corepack pnpm --filter @sunshine/inventory-api pos:simulate
```

- 长驻进程启动时刷新一次有 Barcode 的商品映射；`--once` 单轮检查默认跳过这一步。
- 默认每60秒查询当天订单；已保存且状态、退款金额未变化的订单不会重复拉取详情。
- 新订单以及状态或退款金额变化的订单会更新本地 POS 观察表。
- POS 刚读取时状态为 `OBSERVED`；只有模拟计算成功后才变为 `SIMULATED`。
- 全量核对时，来源中已经消失的旧明细保留为历史，但标记 `INACTIVE`，不再参与计算。
- 新西兰时间每天00:15后，对前一天执行一次完整核对。
- 同一环境只启动一个模拟进程；按 `Ctrl+C` 可安全停止。
- 全程不会写入 `stock_movements` 或 `inventory_balances`。

只执行一轮增量测试：

```bash
corepack pnpm --filter @sunshine/inventory-api pos:simulate -- --once
```

单轮检查同时刷新商品映射时，追加 `--refresh-products`。

手动完整核对指定日期：

```bash
corepack pnpm --filter @sunshine/inventory-api pos:simulate -- --reconcile=2026-08-22
```

## 自动同步验证结果

- 2026-08-23 增量检查观察到47笔订单，全部判定为未变化，跳过47次订单详情处理。
- 2026-08-22 全量核对重新处理53笔订单、205条明细，结果仍为192条库存候选、13条非库存明细。
- 两次检查后的 `stock_movements` 和 `inventory_balances` 均为0。

## 模拟库存扣减

模拟扣减读取已保存的 POS 订单，只处理 `pos_order_items.disposition = INVENTORY` 的整数数量：

- `pos_inventory_simulations`：每张 POS 订单一条模拟结果，状态为可扣减、库存不足或待审核。
- `pos_inventory_simulation_items`：保存每条商品明细的销售数量、扣减前数量和预计结存。
- 同一 POS 订单、同一 POS 明细都有数据库唯一约束，重复运行只更新原记录。
- 库存基数为该门店所有仓库 `inventory_balances` 的合计。
- 使用 `POS_SIMULATION_BASELINE_DATE` 指定库存基准日，从基准日到目标日按订单时间连续重算；测试数据默认基准日为2026-08-20。
- 只有 `ACTIVE + INVENTORY` 明细参与计算；预计结存可以为负数，但只存在模拟表中。
- 退款、取消、Void、非 Paid 订单或原订单已标记异常时，只生成待审核结果，不参与模拟扣减。
- 该功能不创建 `stock_movements`，不修改 `inventory_balances`。

测试指定日期：

```bash
corepack pnpm --filter @sunshine/inventory-api pos:simulate:inventory:test -- 2026-08-20
```

连续计算多个日期：

```bash
corepack pnpm --filter @sunshine/inventory-api pos:simulate:inventory:test -- 2026-08-23 --baseline=2026-08-20
```

2026-08-20 实际验证结果：

- 观察51笔订单，生成51条订单模拟和181条商品模拟明细，共487件。
- 因测试库尚未录入初始库存，50笔订单显示库存不足；1笔订单没有库存商品明细，因此状态为可通过。
- 相同日期重复运行后仍为51条订单模拟和181条明细，幂等有效。
- 两次运行前后 `stock_movements = 0`、`inventory_balances = 0`。

对应迁移：`202608230002_pos_inventory_simulation/migration.sql`。回滚仅允许用于可丢弃的模拟数据，并按“先明细、后订单模拟”的顺序删除两张表。

## 2026-08-24 逻辑修正验证

- 新迁移 `202608240001_pos_order_item_status` 已应用到 `_test` 测试库。
- 8月20日全量只读核对仍为51笔订单、199条源明细，不影响 POS。
- 从8月20日连续模拟至8月23日，共198笔订单、593条库存明细、1424件。
- 197笔订单完成模拟，1笔退款或异常订单进入 `REVIEW_REQUIRED`。
- 当前653条源明细均为 `ACTIVE`；以后来源中消失的明细会标记 `INACTIVE`。
- 重复运行后仍为198条订单模拟和593条模拟明细。
- 验证前后 `stock_movements = 0`、`inventory_balances = 0`。

## CRMEB 管理端 POS 查询 API

基础路径为 `/api/v1`，全部接口必须携带库存中心签发的 JWT，并且当前用户必须具有目标 `storeId` 的门店角色。所有接口均为本地数据库只读查询，不会请求或写入 POS：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/pos/sync-status?storeId=...` | 最近同步运行、游标和异常数量 |
| GET | `/pos/orders?storeId=...` | POS 订单分页列表 |
| GET | `/pos/orders/:orderId?storeId=...` | 订单及有效/失效明细 |
| GET | `/pos/product-mappings?storeId=...` | POS 商品与本地商品映射 |
| GET | `/pos/simulations?storeId=...` | 模拟库存结果列表 |
| GET | `/pos/simulations/:simulationId?storeId=...` | 模拟扣减明细及预计结存 |
| GET | `/pos/reviews?storeId=...` | 退款、取消和异常审核列表 |
| POST | `/pos/milk-products/import?storeId=...` | 只读拉取POS商品并更新奶粉待审核池 |
| GET | `/pos/milk-products?storeId=...` | 查询奶粉品牌、包装、翻译待审核候选 |
| GET | `/pos/milk-products/:candidateId?storeId=...` | 查询一条奶粉候选详情 |
| PATCH | `/pos/milk-products/:candidateId/review?storeId=...` | 管理员批准或忽略奶粉候选，并记录审计日志 |

分页接口统一使用 `page`、`pageSize`，其中 `pageSize` 最大100。订单支持 `from`、`to` 和 `inventoryStatus`；商品映射支持 `q` 和 `status`；模拟及审核支持各自的 `status`。

这些接口不返回 `MONI_API_KEY`、`MONI_REQUEST_DEVICE`、账号、密码或 `login_token`。退款审核目前仅提供查询，处理动作将在审核工作流和审计要求确认后另行开放。

## 奶粉商品治理试点

迁移 `202609070001_pos_milk_catalog` 新增 `pos_milk_product_candidates`。该表与正式商品、库存流水和库存余额隔离，用于保存：

- POS商品ID、SKU、Barcode、来源名称、售价和来源状态；
- 根据名称得到的候选品牌；
- `*3`、`3 tins`、`*6`、`6 tins` 等包装数量建议；
- 是否命中业务确认的成箱价格；
- 中英文名称及翻译审核状态；
- 商品审核状态 `PENDING / APPROVED / IGNORED`。
- 建议库存策略 `LOCAL_STOCK / EXTERNAL_WAREHOUSE / REVIEW_REQUIRED`。

导入只调用 Moni 只读商品列表接口并更新本地候选表。它不会修改 Moni 商品，不会自动批准商品，不会创建库存流水，也不会修改库存余额。名称未写包装数量的商品保持 `suggested_pack_quantity = NULL`，必须人工确认，避免把段数误认为箱规。

奶粉名称包含 `tin/tins`、`6 bag/6 bags`、`stage`、`*3` 或 `*6` 时，候选策略直接设为 `EXTERNAL_WAREHOUSE`：订单金额和成交数量进入数据大屏，但本地门店库存扣减必须为零。能从名称识别3或6时同时保存箱规；只有 `stage`、没有明确数量时箱规可为空。仅价格命中成箱价格、名称也没有上述外仓关键词时标为 `REVIEW_REQUIRED`，不能仅凭售价猜测。其他单罐候选为 `LOCAL_STOCK`，仍须人工审核并完成商品映射后，才允许后续库存同步使用。

审核接口仅允许门店管理员调用，并要求UUID格式的 `idempotencyKey` 和审核原因。批准时必须明确选择 `LOCAL_STOCK` 或 `EXTERNAL_WAREHOUSE`；外仓商品允许箱规为空，但不能参与折算罐数统计。相同幂等键重试返回原审核结果，不重复写审计日志。
