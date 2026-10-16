# Sunshine 一体化系统 POS 与奶粉验证证明

记录范围：2026-08-20 至 2026-09-08

## Moni POS 只读接入

已验证签名、登录、商户、门店、商品、订单、订单明细和退款/异常识别。接入为只读模式，不向收银机写入商品、订单、价格或库存。

## 数据验证结果

| 项目 | 结果 |
| --- | --- |
| POS商品读取 | 3,647 个 |
| 有Barcode商品 | 3,521 个 |
| 无Barcode商品 | 126 个 |
| 2026-08-20至08-23订单 | 198 笔 |
| 订单明细 | 653 条 |
| 库存候选明细 | 593 条 |
| 连续模拟数量 | 1,424 件 |
| 正式库存流水变化 | 0 |
| 正式库存余额变化 | 0 |

## 异常订单

退款、取消、Void和非Paid订单进入审核或不参与模拟扣减，不自动恢复库存，也不修改POS。

## 奶粉治理

奶粉候选表、库存策略和人工审核均保存在本地数据库。78个候选已完成审核，其中59个为 `EXTERNAL_WAREHOUSE`，19个为 `LOCAL_STOCK`。包含 tins、6 bags、stage、*3或*6等外仓特征的奶粉只统计营业额和数量，不扣门店库存。

## 对应位置

- `inventory-system/docs/pos-sync-database.md`
- `inventory-system/apps/api/src/pos/`
- `inventory-system/apps/api/scripts/`
- `inventory-system/packages/database/prisma/migrations/202608220001_pos_sync_observation/`
- `inventory-system/packages/database/prisma/migrations/202608230002_pos_inventory_simulation/`
- `inventory-system/packages/database/prisma/migrations/202609070001_pos_milk_catalog/`
- `inventory-system/packages/database/prisma/migrations/202609070002_milk_inventory_policy/`
- `inventory-system/packages/database/prisma/migrations/202609070003_milk_candidate_review/`

## 结论

POS接入、订单保存、模拟扣减和奶粉治理已经形成可复核的代码、数据库、脚本和运行结果链路，并保持收银机安全隔离。
