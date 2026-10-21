# 2026-10-20 库存基准重建

状态：**已于 2026-10-20 23:01 NZDT 在正式库执行。**

- run `BASELINE-REBUILD-20261020`，requestId `c57d5dd5-7287-410a-be73-50fb17b667eb`，执行人 user 2。
- 执行前备份：`backups/sunshine_homi_integration_20261012_before_baseline_rebuild_20261020_2301.sql`。
- POS 销量同步至 2026-10-20，最后一笔 17:19 NZDT；销量截止 `2026-10-20T10:01:47Z`。
- 673 条 `BASELINE_REBUILD` 流水；流水净额 = 余额 = 35,680 件（执行前 47,772）；1,061 种有库存商品；负库存 15 行待核查。
- 23 行 / 335 件重复点货按“保留后一天”处理。
- `.env` 的 `POS_INVENTORY_BASELINE_AT` 已改为 `2026-10-20T10:01:47.000Z`，API 已重启（23:07）。此后的 POS 订单走正常扣库流程。

## 背景

- 10-12 05:15:22Z 导入 Homi 初始库存，并按 10-08～10-12 销量手工扣减（`POS_RECONCILIATION`）。该时刻即当前 `POS_INVENTORY_BASELINE_AT`。
- 10-16 05:26Z 第一批 `SALE_OUT`；07:07Z 按“2026-10-15 CSV 总表”校准（`BASELINE_RECON`）；07:10Z 清理负库存（`NEGATIVE_CLEAR`）。
- 10-16 07:11Z 第二批 `SALE_OUT` 在校准之后执行，包含 136 张早于基准时间的订单，早于 CSV 盘点时刻的销量被再次扣减。
- 用户确认：**10-15 CSV 总表存在重复计数，以入库单录入为准**（例：EZZ 聪明丸实物 7 个，总表为 206）。

## 规则（用户确认）

1. 基准 = 10-08～10-11 四张入库单（RK-20261008-B7A83A、RK-20261009-191292、RK-20261010-A87893、RK-20261011-B980B1，577 行，含未完成单据行）+ RK-20261013-650D5A（13 行，406 件）。四张单来自另一套录入导出，本库无这些单据；按商品 ID + 有效条码双重校验后使用，到期日对应到已有批次。
2. 每个商品只扣**首次录入日之后**（组织时区 Pacific/Auckland 的日历日）的销量：`Paid`、`refund_amount = 0`、明细 `ACTIVE` + `INVENTORY`、非冲减行。
3. 批次内按到期日先到先扣（FEFO）；同一商品内负数批次先由其他批次抵扣，只有商品总量不足时才保留负数，作为待核查项。
4. 基准外商品：**保留当前数量**，扣除 10-16 04:17:29Z（最后一张已正式扣库订单）之后的销量，标记 `UNLISTED_REVIEW`。这些数量同样来自 10-15 CSV，可能偏高，需逐步盘点。
5. 从未有过任何批次的商品无法记录负数，不扣销量，标记 `NO_BATCH_SALES_SKIPPED` 并单列。
6. 重复点货：同一商品、同一到期日，后一天录入数量 ≥ 前一天时只保留后一天的数（`RECOUNT_KEPT_LATER`）；不同到期日相加并按到期日分别展示。2026-10-20 预演中 23 行 / 335 件被替代（如 sanderson 3000mg 鱼油 20+481 → 481、红印美白玫瑰牙膏 55+111 → 111）。
7. 用户确认数量（来源 `CONFIRMED-20261020`，按 10-08 基准扣 10-09 起销量）：HAAB 绵羊油霜 150g 762、sanderson 鱼油 3000 150 粒 500、Lano garden 绵羊油 240。
8. 10-16 07:11:20.410Z 之后员工产生的流水（如 RK-20261020-2D31D5 今日入库 125 行 5,289 件）原样保留，叠加在目标数之上。

## 脚本

| 文件 | 作用 |
|---|---|
| `apps/api/scripts/lib/baseline-reconciliation.ts` | 纯计算：商品目标数、批次分配（含单元测试） |
| `apps/api/scripts/lib/baseline-reconciliation-source.ts` | 读取数据库与入库明细，生成计划；预演与执行共用 |
| `apps/api/scripts/preview-baseline-reconciliation.ts` | 只读预演，输出商品级与批次级 CSV |
| `apps/api/scripts/rebuild-baseline-inventory.ts` | 正式执行，需 `--execute` 与已存在的 `--backup` |

执行保护：
- 同一 `--run` 只能执行一次（幂等键 `<run>:<商品>:<批次>`，并在开始前检查）。
- 单一事务；先 `SELECT … FOR UPDATE` 锁定该仓库全部余额行，与计划时的数量和版本逐行比对，有任何变化即整体放弃。
- 每条调整写 `STOCKTAKE_GAIN/LOSS`（`reference_type = BASELINE_REBUILD`，流水号 `RB<yymmdd><序号>`），每条一条 `inventory.baseline_rebuild` 审计，另加一条 `INVENTORY_BASELINE_REBUILT` 汇总审计。
- 不删除、不改写任何历史流水。

入库明细 CSV 列：`product_id,entry_date,quantity,source,barcode,expiry_date`。业务数据放在 `outputs/`（已 gitignore），不提交。

## 预演结果（截至 2026-10-20 18:14 NZDT，POS 已同步至 12:45）

| 项目 | 数值 |
|---|---|
| 基准内商品 / 基准件数 / 扣减销量 | 502 / 20,225 / 1,951 |
| 基准外保留商品 | 625（含 58 种无批次、未扣销量 198 件） |
| 全店当前合计 → 目标合计 | 47,772 → 36,427 |
| 调整流水 | 624 条（增 208 件，减 11,553 件） |
| 负库存待核查 | 10 种 / -64 件 |

## 演练（非生产库）

- 用执行前备份 `backups/sunshine_homi_integration_20261012_before_baseline_rebuild_20261020_1813.sql` 恢复到 `sunshine_rebuild_rehearsal_20261020`：流水 4,790 条、净额 47,772，与正式库一致（同时完成一次恢复演练）。
- 执行：624 条流水，约 2 秒；流水净额 = 余额 = 36,427；负余额 10 行。
- 逐商品核对 1,127 个商品余额与预演目标全部一致；审计 624 + 1 条；幂等键 624 个唯一。
- 重复执行被拒绝；缺少 `--execute` 被拒绝。
- 演练中发现并修复：基准外商品在“员工操作批次当前余额为 0”时会重复叠加（已由批次合计校验拦截，未写错数据）。

## 正式执行步骤

1. 通知员工停止录入约 1 分钟；在“数据中心”不要点击正式扣库。
2. 只读同步 POS 至当天，重新生成备份。
3. 运行预演，确认数字后立即执行：

```bash
cd inventory-system/apps/api
npx tsx scripts/rebuild-baseline-inventory.ts \
  --store=1 --entries=<入库明细CSV> --receipt=RK-20261013-650D5A \
  --to=<执行时刻ISO> --preserve-after=2026-10-16T07:11:20.410Z \
  --unlisted-sales-after=2026-10-16T04:17:29Z --unlisted=keep \
  --user=2 --run=BASELINE-REBUILD-20261020 --backup=<新备份> --execute --out=<流水清单CSV>
```

4. 立即把 `.env` 的 `POS_INVENTORY_BASELINE_AT` 改为输出中的 `nextPosInventoryBaselineAt`，并**重启 API**。API 在启动时读取该值；不重启会按旧基准把已计入的订单再次扣减。
5. 核对 `SUM(stock_movements.quantity_delta) = SUM(inventory_balances.quantity)`，导出负库存与 `UNLISTED_REVIEW` 清单。

## 回滚

- 整体回滚：恢复执行前备份（先停止 API，恢复后把 `POS_INVENTORY_BASELINE_AT` 改回 `2026-10-12T05:15:22.401Z` 再启动）。
- 单项修正：通过新的盘点流水冲正，不删除历史流水。

## 执行后修正：sanderson 重复商品档案（2026-10-20 23:15）

- 1538「sanderson 鱼油 3000 150粒」（条码 9421902551420，POS 中不存在）与 1934「sanderson3000mg鱼油」（条码 9421902551703，POS 商品 108348「sanderson fish oil 3000 150capsules」）是同一商品；POS 销量只记到 1934，导致 1538 的 500 件永不减少，且与 1934 的 434 件重复。
- 按用户确认实物 500 件，扣 10-09～10-20 POS 销量 48 件，合并为 1934 = 452 件；1538 → 0 并停用；条码 9421902551420 改挂 1934（非主条码）。
- 流水 `MG261020000001`（-500）、`MG261020000002`（+18），`reference_type = PRODUCT_MERGE`，审计 `inventory.product_merge` ×2 + `PRODUCT_MERGED`。备份 `backups/sunshine_homi_integration_20261012_before_sanderson_merge_20261020_2315.sql`。
- 全店 35,680 → 35,198 件，流水净额 = 余额。
- 回滚：反向盘点流水恢复数量，条码改回 1538 并设为主条码，1538 状态改回 ACTIVE。

## 执行后修正：今日点货叠加 CSV 旧数（2026-10-21 08:42）

- 21 种商品不在 10-08～10-13 入库单内，库存 = 10-15 CSV 旧数（未核实）+ 10-20 点货。例：红印蜂胶牙膏 CSV 144/48 + 今日 144/48 = 384。
- 今日点货 ≥ CSV 旧数的 15 种：视为重新点货，只保留今日点货数，扣点货后的 POS 销量（仅 bioisland 成人乳钙 3 件）。18 条 `RECOUNT_TODAY` 流水（`RC261021…`），净 -636 件。备份 `…_before_recount_today_20261021_0842.sql`。
- 今日点货 < CSV 旧数的 6 种按规则相加保留：康维他蜂胶喷雾 UMF10+（453）、康维他蜂胶 Tincture PFL15（454）、高之源奶蓟草 50000（640）、纽乐蔓越莓 50000（1239）、EAORON 爽肤水（521）、GoodHealth 骨胶原 30（672）。

## 执行后修正：条码仅差前导 0 的重复档案（2026-10-21 08:48）

- 新脚本 `apps/api/scripts/merge-duplicate-products.ts`：把未映射档案的库存按批次并入 POS 映射档案，补扣此前无批次可扣的销量，条码改挂为副条码，旧档案停用；无 `--execute` 时只预演并回滚。
- 22 对 heorshe 商品（本地条码 `0735940…` 与 POS `735940…` 相同）合并：153 件并入 POS 档案，补扣 1 件销量，43 条流水，run `PRODUCT-MERGE-HEORSHE-20261021`。备份 `…_before_heorshe_merge_20261021_0848.sql`。
- 合并后全店 34,561 件，流水净额 = 余额。
- 仅名称相似、条码不同的商品（Macadamia 口味、纽乐辅酶 300/150mg、bio-oil 60/200ml 等）是不同商品，不合并。

同类问题：111 种有库存商品没有 ACTIVE POS 映射（3,093 件），其中 42 种在 POS 中有名称相近的同款档案，清单见 `outputs/20261020-baseline-reconciliation/POS未映射库存审查_20261020.xlsx`，待用户逐项确认后合并。

## 未完成

- 10-20 新到货清单（65 行）未纳入本次重建：与 RK-20261013 疑似重复 3 项、8 个低把握匹配、7 种需新建商品，待用户确认；或由员工通过系统入库录入。
- 基准外 625 种商品的数量需逐步盘点核实。
- 演练库 `sunshine_rebuild_rehearsal_20261020` 保留供核对，确认后可删除。
