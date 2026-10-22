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

## 阶段 2（S1 实时同步、S4 映射刷新）

- `PosRealtimeSyncService`（API 进程内定时器）：每 `POS_REALTIME_SYNC_MINUTES` 分钟执行一轮，0 或未设置为关闭；只允许一个 API 实例开启。
  1. 每小时最多刷新一次商品映射（先于读取订单，使 POS 新上架商品先关联到本地商品）；
  2. 同步门店时区的当天订单，凌晨 1 点前同时补同步前一天；
  3. 从门店基准时间起按明细自动扣库。
- 门店有未超时（30 分钟内）的手动同步在运行时跳过本轮；上一轮未结束时不叠加。
- 扣库执行人取 `POS_REALTIME_SYNC_USERNAME`（必须是有效员工），审计可追溯；未配置时只记录错误，不扣库。
- 手动同步 `POST /management/pos-sync/run` 完成后在后台强制刷新映射。
- `GET /management/pos-sync/status` 增加 `realtime`（开启状态、间隔、上次运行、最近扣减、错误）；数据中心显示“实时同步”卡片，加载失败时显示“—”而非“未开启”。
- POS 接口仍只读。该运行方式是对 `inventory-system/AGENTS.md`“第一阶段不监听 POS”的例外，由店主于 2026-10-21 批准。

## 阶段 3（M1–M5 经营规则与销量口径）

- 缺货：零库存商品仅在近 180 天内有已付款、无退款的库存销售时计为缺货（原 120 天）；库存经营与商品分析一致。
- 低库存：只对核心品牌（好健康、高之源、纽乐、Swisse、澳佳宝、红印、Lifespace、挪威小鱼、Bio Island）与绵羊油品类使用默认最低库存 20；其他商品仅在单独设置最低库存后提醒。识别规则见 `management/core-replenishment.ts`（按中英文名称匹配，BM/NL 缩写按整词）。`minimumStockSource` 新增 `NONE`，页面显示“— 不提醒”。
- 销量口径：库存经营与商品/品牌分析统一为已付款、无退款（库存经营另限 `INVENTORY` 明细），与本周进货一致。
- 滞销：POS 未映射商品不判滞销，页面标记“POS未映射”。
- 已过期库存：库存经营返回 `expiredBatches` / `expiredUnits` 并在页面提示，处理入口为库存系统“临期提醒 · 已过期”。
- 本周进货：原逻辑只按近 28 天销量给建议，半年无销售商品本就不会出现，未改动。
- 正式库只读核对（2026-10-21）：低库存 586 → 102；库存经营缺货 347（窗口放宽至 180 天）；商品分析缺货 ≈2,683 → 420（与库存经营相差的 73 种为已忽略或直邮商品）；滞销 547 → 456；已过期 6 批次 / 80 件。

## 上线（2026-10-21 17:47 NZDT）

> 备份存放说明（2026-10-21）：除 `…_before_timestamp_fix_20261021_1845.sql` 与 `…_before_sales_backfill_20261021_1911.sql` 外，本文提到的备份均已压缩为同名 `.sql.gz`（已逐个校验）。恢复命令：`gunzip -c backups/<文件>.sql.gz | docker compose exec -T mysql mysql -u<用户> <库名>`。


- 正式库执行迁移，`stores.pos_inventory_baseline_at` 写入 `2026-10-20 10:01:47`（审计 `store.pos_inventory_baseline_set`），`.env` 设置 `POS_REALTIME_SYNC_MINUTES=5`、`POS_REALTIME_SYNC_USERNAME=wf1124`，重启开发服务。备份 `backups/…before_pos_realtime_20261021_1746.sql`。
- 首轮：当天 61 张订单全部按明细扣库，193 行足额扣减 452 件，31 行库存不足进入复核，未新增负库存。

## 全链路核查（2026-10-21 18:40）与修正

- 核查报告：`outputs/20261021-change-proposal/全链路核查与需求_20261021.docx`。模块联动正常，问题来自上游数据：CSV 旧数商品、MISC 杂项结账、POS 未映射库存、入库单临期数量与实际不符。
- 时间戳修正：3 次手写 SQL 使用 `NOW(3)`（容器为新西兰本地时间）写入，20 条流水与对应审计统一改回 UTC，数量不变（审计 `data.timestamp_correction`）。手写 SQL 须用 `UTC_TIMESTAMP(3)`。

### N1 补扣基准外商品 10-09～10-16 销量（店主确认，已执行）

- 脚本 `apps/api/scripts/backfill-product-sales.ts`（默认预演；`--execute` 需备份）。范围：重建时基准外保留的商品，排除已按 10-20 点货重设的 15 种。
- 窗口 `[2026-10-08T11:00Z, 2026-10-16T04:17:29Z)`；扣减量 = 窗口销量 − 10-16 07:07:23Z（CSV 校准）之后已写入的 SALE_OUT，避免重复扣。
- 执行 run `SALES-BACKFILL-UNLISTED-20261021`：182 种商品，扣 894 件，10 种扣不够共 105 件记负数待核查；全店 33,883 → 32,884。清单 `outputs/20261021-change-proposal/N1补扣清单_20261021.csv`。备份 `…before_sales_backfill_20261021_1911.sql`。

### N6 进货建议与入库联动

- 近 7 天有入库（未撤销）的商品不再出现在进货建议，列入“已到货”分组（显示近 7 天入库数量与日期）；汇总新增 `arrived`。

### N3 MISC 杂项销售

- 店主规则：临期清货在 POS 扫实际商品改价，不再使用 MISC；历史 MISC 行不补扣。
- 数据中心“数据检查”新增 `NO_MISC_SALES`：近 7 天有 MISC 行即提示。

### N2 临期实盘

- 库存系统“临期预警”每行新增“实盘”：填写实际数量（“已售完”一键填 0）与原因（默认“临期实盘”），调用 `POST /inventory/stocktake-adjustment` 写盘点流水与审计，只调整该到期日期批次；数量与系统一致时不提交。

### N5 复核明细重新扣减

- `GET /management/pos-inventory/review-lines`：列出已扣库订单中未扣足的明细、当前可映射商品与现有库存。
- `POST /management/pos-inventory/review-lines/reapply`（`confirm: true`，1–200 个明细）：只扣“还差的数量”，FEFO，不扣成负数；新幂等键 `posr:<明细>:<已扣数>:<仓库>:<批次>`，可安全重复。
- 实时同步每轮在扣库后自动补扣“当时未映射、现已映射”的明细；“库存不足”的明细只在人工确认后重扣（补货晚录入时才应补扣，系统少记时不应再扣）。
- 数据中心新增“复核明细”卡片（逐行“重扣”与“重扣全部可扣明细”）；预览中的问题列表改为按明细显示。

### N4 POS 未建档商品

- 只读拉取 POS 商品目录（3,764 个，126 个无条码）核对 88 种有库存但未映射的商品：按名称均无相近 POS 商品，属于 POS 尚未建档（新品、礼盒、口红色号等），不存在可手动映射的对象；重复档案（sanderson、heorshe）已在此前合并。
- `GET /management/pos-mapping/unlisted-stock` 与数据中心“POS 未建档商品”卡片（可导出 Excel，隐藏 LOCAL 内部条码）。POS 以相同条码建档后，实时同步每小时的映射刷新会按规范化条码自动关联。

### N7 入库条码与重复点货

- `POST /inventory/scan-receive` 与 `GET /inventory/barcode/:barcode` 先按规范化条码解析出库内实际存储的写法（`resolveStoredBarcode`），扫描 `735…` 能找到登记为 `0735…` 的商品，不再新建重复档案；多个商品共用规范化条码时返回冲突，要求按名称选择。
- 点货清单：加入时若同一到期日已有库存，该行必须选择“新到货（相加）”或“重新点货（以本次为准）”后才能确认整单；“重新点货”调用盘点接口把该批次设为本次数量（相同则不写），不走入库。
- 到期日年份 ≥ 2036 的批次在库存台账、点货清单、流水、出库/增加选择中显示“无到期日”（店主约定：无到期日商品故意选远期日期）。

### N8 库存台账“待核查”

- `GET /inventory/review-items`：负库存批次、已过期仍有库存的批次、有库存但本门店无 POS 映射的商品。
- 库存管理新增第 4 个页签“待核查”，负库存与过期批次可直接“实盘”（复用实盘弹窗，原因默认“负库存实盘”/“过期实盘”），盘点接口要求实际数量 ≥ 0，实盘后负库存即清除。

### 修复：重启中断的同步记录

- 19:55 部署时 API 重启打断了第 332 轮同步，记录停在 RUNNING，实时同步会因“有同步在运行”跳过门店至多 30 分钟。已手工将该记录标为 FAILED（INTERRUPTED）。
- `PosRealtimeSyncService` 启动时（仅开启实时同步的实例）把遗留的 RUNNING 记录标为 FAILED / INTERRUPTED 后再开始首轮。

## 待后续阶段

