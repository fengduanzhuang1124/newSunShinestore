# POS 实时库存：按明细扣库、门店基准与条码规范化

方案来源：`outputs/20261021-change-proposal/库存与经营系统修改方案_20261021.docx`（2026-10-21 店主确认）。本记录随各阶段更新。

## 阶段 1（S2 / S3 / S4 条码部分）

### 按明细扣库（S2）

- `PosInventoryApplicationService` 不再因一行问题拦截整张订单。每条 `INVENTORY` 明细独立按 FEFO 扣减：
  - 已映射且库存足够：足额扣减；
  - 库存不足：扣到 0，缺口记 `INSUFFICIENT_INVENTORY`，**不产生负库存**；
  - 未映射 / 待审核 / 冲减行 / 非正整数数量：不扣，分别记 `UNMAPPED`、`REVIEW_REQUIRED`、`RETURN_LINE`、`INVALID_QUANTITY`；
  - `NON_INVENTORY` 行保持跳过。
- 订单处理后状态为 `APPLIED`；每行的实际扣减数与复核原因写入 `pos_order_items.inventory_applied_quantity` / `inventory_review_reason`，审计日志记录复核明细与缺口件数。
- 批次在事务中被他人改动时整单回滚（`CONCURRENT_CHANGE`），订单保持未扣状态，下次重试。
- 预览/执行结果新增 `reviewLines`、`shortfallUnits`；`blockedOrders` 仅表示整单回滚的订单。

### 门店扣库基准（S3）

- `stores.pos_inventory_baseline_at` 优先；为空时回退 `POS_INVENTORY_BASELINE_AT`。
- 部署后执行一次（店主/运维确认后）：`UPDATE stores SET pos_inventory_baseline_at = '2026-10-20 10:01:47.000' WHERE id = 1;`，之后修改基准不再需要重启 API。

### 条码规范化（S4 映射部分）

- `src/inventory/barcode-lookup.ts`：条码保持字符串；纯数字条码去掉前导 0 后比较（UPC-A / EAN-13 / GTIN-14 互认）。精确匹配优先；规范化后唯一命中则使用；命中多个商品视为冲突。
- POS 映射导入改用规范化匹配：命中已有商品时把 POS 条码作为副条码挂到该商品，不再新建重复商品；冲突时跳过并计入 `skippedAmbiguous`。heorshe 22 对重复档案即由旧逻辑产生。

### 数据库迁移 `202610210001_pos_realtime_inventory`

- 升级：仅新增可空列与索引，旧数据和行为不变。
- 回滚：见 migration.sql 注释；已写入的库存流水保留。
- 验证：在 `sunshine_rebuild_rehearsal_20261020`（10-21 08:48 备份恢复）执行 → 回滚 → 再执行均成功；测试库 `sunshine_inventory_test` 已执行。
- 演练：在演练库对 10-16～10-20 的 290 张订单按明细扣库，599 行足额扣减 1,301 件，187 行库存不足进入复核；流水净额 = 余额，未新增负库存。

### 检查

- `corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build` 通过（数据库 46、管理端 38、API 测试全部通过）。

## 待后续阶段

- S1 实时同步任务与手动同步刷新映射；M1–M5 经营规则；R1–R3 入库条码与重复点货；I1–I3 页面标记。
- 复核明细在映射补齐后的重新扣减入口。
