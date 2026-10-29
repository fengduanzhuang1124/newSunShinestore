# 待上线清单（2026-10-27 整理，未提交、未推送）

开发工作区：`newSunShinestore-pos-realtime`，开发分支（基于 2208100）。客户要求暂不推送，次日再确认。

## 1. 本次上线内容

| 编号 | 内容 | 业务影响 |
| --- | --- | --- |
| CR-008 F4 | 商品存放位置：每个商品在本店一个主要仓位 | 扫码入库、库存查询、临期预警显示仓位，员工和管理员可直接修改 |
| CR-008 F5 | 按品牌批量放置仓位 | 仓位管理按品牌、关键词、当前仓位筛选，一次放置或清除；写审计 |
| CR-008 F2 | 库存盘点、经营管理库存经营页直接“合并同款”（管理员） | 同一商品的多个名称档案可在盘点时直接合并 |
| CR-008 F7 | 公网访问地址白名单 | 修正 Windows 公网地址 `node.tail10ff0a.ts.net` 无法登录、保存的问题（**紧急**） |
| 记录 | Windows 迁移操作记录 | `docs/records/windows-migration-runbook.md` |

## 2. 文件

- 数据库：`packages/database/prisma/schema.prisma`；迁移 `202610270001_product_locations`（只新增 `product_locations` 表；回滚 `DROP TABLE product_locations`）
- 接口：`http-app.ts`、`inventory.controller.ts`、`inventory-query.service.ts`、`warehouse-location.service.ts`、`warehouse-location.dto.ts`、`product-merge.ts`、`shared/product-brand.ts`
- 测试：`http-app.spec.ts`、`warehouse-location.service.spec.ts`、`inventory.service.spec.ts`、`stock-count.service.spec.ts`、`admin-web/src/locations/ProductLocation.spec.ts`
- 管理端：`App.vue`、`App.spec.ts`、`management/pages/InventoryPage.vue`、`styles.css`、`admin-web/src/locations/ProductLocationChip.vue`、`ProductLocationBulk.vue`
- 文档：CR-008、`requirements-register.md`、本清单
- 仓库规范：`.gitignore` 新增本地文件规则；`inventory-system/.finesse/log.json`（界面设计工具记录，10 月初误纳入版本库）改为不跟踪（`git rm --cached`，本机文件保留）
- **不提交**（已加入 `.gitignore`）：
  - `apps/api/reports/`（店铺经营数据）
  - `Untitled`（空白临时文件）
  - `.finesse/`（本机工具记录）
  - `*.code-workspace`（本机编辑器配置）
  - `docs/records/*HANDOFF*.md`（本机开发交接笔记）

## 3. 检查结果

API 230 项、管理端 67 项通过，vue-tsc 无错误；开发库 `sunshine_dev_20261027` 实测批量放置、扫码、搜索、库存台账、临期预警、审计。

## 4. 上线步骤（客户确认后）

1. 提交到开发分支，合并到运行分支，推送。
2. Windows：停服务 → 备份正式库 → `git pull` → `prisma migrate deploy` → 构建数据库包 → 重启 → 公网链接登录测试。
3. 在仓位管理中建立仓位，再按品牌放置。

## 5. 不在本次范围

CR-008 F1–F3、F6 待客户确认；开发库中的测试仓位 A-01、B-02 只在开发库，不影响正式库。
