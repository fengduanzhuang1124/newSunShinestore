# Sunshine 一体化系统个人开发工作流程与阶段成果证明

整理日期：2026-09-08
时区：Pacific/Auckland
整理依据：项目代码、开发文档、文件时间、Git 本地历史和 GitHub 远程提交记录。
说明：本报告以 Sunshine 一体化零售系统为唯一项目主体，统一整理两个代码仓库中的系统设计、开发成果、当前进度和 Git 存档。已提交内容与本地尚未提交内容分别标注，避免将计划功能写成已完成功能。

## 0. 项目与代码仓库关系

Sunshine 一体化零售系统是一个完整产品，目前根据技术职责分为两个代码仓库。两个仓库共同服务同一套商品、订单、库存和销售数据，不代表两个独立商业项目。

```text
Sunshine 一体化零售系统（一个产品）
│
├── newSunShinestore
│   ├── 统一库存中心
│   ├── Moni POS 只读同步
│   ├── 商品映射与数据统计
│   └── 库存作业工作台
│
└── newsunshine-3
    ├── CRMEB 商城服务
    ├── 商城管理端
    ├── H5/PC 网页商城
    └── 微信小程序
```

库存作业工作台用于扫码入库、出库、盘点、商品映射和异常处理；商城管理端用于商品运营、会员、线上订单和客户端配置。

## 1. 当前开发成果概述

当前完成度最高的是 NestJS 统一库存与 POS 集成部分。微信小程序、H5/PC 网页和 CRMEB 商城管理部分已有二开基础，但尚未与统一库存中心形成完整业务闭环。

按一体化系统最终目标估算，整体约完成 35%。如果只计算库存/POS 外挂 MVP，约完成 65%–75%；正式自动扣库存、门店部署、备份恢复和运营监控仍未完成。

| 模块 | 当前状态 | 进度说明 |
| --- | --- | --- |
| 项目架构与开发文档 | 基本完成 | 总体架构、数据库、API 和安全边界已有文档 |
| 独立库存管理端 | MVP 主体已完成 | 登录、入库、出库、查询、报表、临期、盘点和流水撤销已实现 |
| Moni POS 接口 | 只读接入已完成 | 签名、登录、门店、商品、订单及退款/异常识别已验证 |
| POS 自动扣库存 | 模拟完成，正式未开放 | 只写模拟结果，不修改正式库存，不影响收银机 |
| 商品映射 | 局部完成 | 已取得 POS 商品；奶粉先行，其他商品尚未治理 |
| 奶粉治理 | 首轮完成 | 78 个候选已审核；外仓奶粉不扣门店库存 |
| 销售数据大屏 | 数据基础部分完成 | 已有订单和奶粉统计数据，正式大屏页面未完成 |
| CRMEB 二开管理端 | 基础代码存在 | 尚未接入 NestJS 库存/POS API |
| 微信小程序 | 框架基础存在 | CRMEB uni-app 客户端基础存在，Sunshine 专属业务闭环尚未完成 |
| H5/PC 网页商城 | 正式业务二开尚未开始 | 有跨端框架基础，没有英文网页购买闭环 |
| 部署、备份、监控 | 未完成 | 当前仍是本地开发状态 |

## 2. 管理端结构

### 2.1 库存作业工作台

路径：`inventory-system/apps/admin-web/`

这是当前实际使用和持续开发的库存作业子系统，也是奶粉审核页面所在位置。它负责库存专业操作，不替代商城管理端。

### 2.2 CRMEB 商城管理端

路径：`../newsunshine-3/template/admin/`

它是 Sunshine 一体化系统的最终商城运营管理入口。目前已具备 CRMEB v6.0.0 基础，统一库存接口和 Sunshine 专属业务页面仍待开发。

因此，现在不能认定“一体化管理端已经完成”。准确状态是：库存作业工作台已较完整；CRMEB 商城管理端是后续正式运营入口；统一登录、菜单入口和接口整合尚未完成。

## 3. 微信小程序进度

微信小程序采用 `newsunshine-3/template/uni-app/` 作为客户端基础。当前尚未完成 Sunshine 专属页面、统一商品接口、库存状态、订单闭环和正式发布配置，因此应认定为“框架基础存在，正式业务二开尚未完成”。

## 4. H5/PC 网页进度

CRMEB uni-app 具有跨端基础，但“可以构建 H5”不等于英文网页客户端已经完成。目前尚未完成：

- 新西兰公众可访问的正式域名；
- 英文商品名称和内容、中英文切换；
- 响应式 PC 页面专项验收和 SEO；
- 游客浏览及手机号/邮箱登录；
- 新西兰支付、配送、运费和退款闭环；
- 与库存中心的预占、确认、释放和补偿流程；
- POS、商城和库存的统一商品 ID。

因此 H5/PC 当前应认定为“框架基础存在，正式业务二开尚未开始”。

## 5. 库存与 POS 已完成内容

库存系统从 2026-07-30 正式规划，技术栈为 NestJS、Vue 3、Prisma 和 MySQL。目前已有：

- 员工登录和 JWT；
- 多门店、多仓库数据结构；
- 商品、多条码、多有效期；
- 连续扫码点货、扫码入库、手工出库；
- 入库单、库存汇总、CSV 导出；
- 临期预警；
- 盘点、盘盈盘亏和库存流水；
- 管理员安全撤销错误流水；
- 权限和审计基础；
- Moni 签名、登录、门店、商品和订单读取；
- POS 商品映射、订单头、订单明细、同步游标和运行记录；
- 退款、取消和 Void 异常识别；
- 模拟库存扣减和差异结果；
- 管理端 POS 查询 API；
- 奶粉识别、审核和库存策略。

已经记录的 POS 验证结果：

- 读取 3,647 个 POS 商品；
- 3,521 个有条码商品，126 个无条码商品；
- 2026-08-20 至 2026-08-23 共保存 198 笔订单、653 条明细；
- 593 条库存候选明细；
- 连续模拟 1,424 件商品；
- 重复运行没有重复订单和明细；
- 验证期间正式库存流水和库存余额始终为零；
- 没有向 POS 写入数据。

## 6. 奶粉治理状态

- 78 个奶粉候选已经人工审核完成；
- 59 个判定为 `EXTERNAL_WAREHOUSE`；
- 19 个判定为 `LOCAL_STOCK`；
- 外仓识别关键词包括 `tins`、`6 bags`、`stage`、`*3` 和 `*6`；
- 外仓奶粉只统计营业额和数量，不扣门店库存；
- 审核不会向 POS 写回，不会自动生成正式库存流水；
- 审核具有幂等键和审计日志。

该最终审核结果目前尚未形成新的 GitHub 提交，现阶段由本地数据库审计日志、代码和工作记录共同证明。

## 7. 项目时间线

| 日期 | 事件 | 证据类型 |
| --- | --- | --- |
| 2026-07-30 | 库存系统需求和设计基线建立 | 开发日志、文档、Git 提交 |
| 2026-07-31 | NestJS、Vue 3、Prisma 库存系统地基完成 | GitHub 远程提交 |
| 2026-08-01 | 报表、盘点、临期和主题界面完成 | GitHub 远程提交 |
| 2026-08-02 | 流水撤销、连续扫码和多轮 UI 优化 | 本地日志、代码和截图，尚未提交 |
| 2026-08-19 | CRMEB 一体化工作区、开发计划和 Cursor 规则建立 | 本地文件时间，尚未提交 |
| 2026-08-20 至 08-24 | POS 订单保存、模拟同步和模拟库存扣减 | 本地迁移、代码、测试记录，尚未提交 |
| 2026-08-28 | 奶粉订单和整箱奶粉订单报表生成 | 本地报表和预览截图，尚未提交 |
| 2026-09-07 至 09-08 | 奶粉商品治理、审核规则和 78 个候选审核 | 本地代码、迁移、数据库审计，尚未提交 |

## 8. GitHub 提交日志

### 8.1 `newSunShinestore` 库存开发记录

GitHub 日志：https://github.com/fengduanzhuang1124/newSunShinestore/commits/codex/inventory-foundation/

2026 年 5 月以后的库存开发提交如下：

| 时间（新西兰） | Commit | 提交说明 | 主要内容 |
| --- | --- | --- | --- |
| 2026-07-31 09:28 | [`ff85621`](https://github.com/fengduanzhuang1124/newSunShinestore/commit/ff85621385c6a3c062c8604a2ac9368ce3418d0e) | `docs: add project standards and documentation` | AGENTS、业务需求、技术设计、数据库设计、API、日志、测试和路线图 |
| 2026-07-31 23:30 | [`fcd48bd`](https://github.com/fengduanzhuang1124/newSunShinestore/commit/fcd48bdd1a122cfb00a16c95bb3175c1cfa5ae6a) | `feat(inventory): build scanner-based inventory foundation` | NestJS、Vue 3、Prisma/MySQL、登录、扫码、入库、出库、多条码、多有效期、测试和截图 |
| 2026-08-01 23:18 | [`cbe7408`](https://github.com/fengduanzhuang1124/newSunShinestore/commit/cbe740822267bb7e1c4c695c9bbaa12248bdfd83) | `feat(inventory): add reports stocktake and themed workspace` | 入库报表、库存汇总、临期、盘点、流水、Light/Dark 主题和对应测试 |

截图：`docs/10-Screenshots/2026-09-08-github-inventory-foundation-commit-history.png`

![库存开发分支提交日志](10-Screenshots/2026-09-08-github-inventory-foundation-commit-history.png)

### 8.2 商城二开代码仓库

GitHub 仓库：https://github.com/fengduanzhuang1124/newsunshine-3
GitHub 日志：https://github.com/fengduanzhuang1124/newsunshine-3/commits/master/

`newsunshine-3` 是 Sunshine 一体化系统的商城二开代码仓库，保存 CRMEB 商城服务、商城管理端、H5/PC 网页商城和微信小程序基础。当前基线版本为 v6.0.0，Sunshine 专属业务整合仍处于准备阶段；后续二开提交将在该仓库持续存档。

## 9. 可用于证明开发过程的本地材料

- `docs/05-Development-Log.md`：按日期记录的开发日志；
- `docs/06-Testing-Report.md`：测试结果、回归过程和截图索引；
- `CHANGELOG.md`：功能变化记录；
- `docs/project-status-and-roadmap.md`：阶段状态和路线；
- `inventory-system/docs/pos-sync-database.md`：POS 数据库、模拟同步和数据结果；
- `docs/10-Screenshots/`：2026-07-31、08-01、08-02、09-08 的页面与 GitHub 证据截图；
- `inventory-system/outputs/20260828-milk-orders/`：奶粉订单统计表；
- `inventory-system/outputs/20260828-milk-cartons/`：整箱奶粉订单统计表；
- Prisma migration：数据库结构演进记录；
- 本地数据库审计日志：奶粉审核与库存操作记录。

文件时间只能作为辅助证据，因为文件可复制或修改。GitHub 远程提交、Pull Request、版本标签和服务器侧操作记录的证明力更强。

## 10. 当前工作存档状态

本次整理时，工作区中尚有以下开发内容等待正式提交存档：

- 20 个已跟踪但未提交的修改文件；
- 52 个未跟踪入口；
- 约 59 个未跟踪的 POS、奶粉、API、测试或 migration 源文件；
- 25 张尚未提交的 2026-08-02 页面截图；
- 多份 2026-08-28 奶粉统计产物。

所以现有 Sunshine 功能提交当前可以直接证明到 2026-08-01。2026-08-02 之后的界面、8 月下旬 POS 同步及 9 月奶粉治理，虽然有本地代码、迁移、日志、截图和数据库记录，但尚未由新的 GitHub 提交固定。

## 11. 建议的正式存档顺序

1. 扫描并排除 `.env`、POS key、密码、token 和顾客敏感信息；
2. 将库存 UI、POS 只读同步、模拟扣减、奶粉治理、文档和截图拆成独立提交；
3. 推送至远程功能分支；
4. 建立 Pull Request，获得 GitHub 服务器时间记录；
5. 对稳定里程碑打版本标签；
6. 后续每个完整功能或每个工作日至少形成一次可读提交；
7. 不补造或回填虚假的历史提交时间。

## 12. 相关链接索引

### GitHub

- `newSunShinestore`：https://github.com/fengduanzhuang1124/newSunShinestore
- 主分支提交：https://github.com/fengduanzhuang1124/newSunShinestore/commits/main/
- 库存分支提交：https://github.com/fengduanzhuang1124/newSunShinestore/commits/codex/inventory-foundation/
- `newsunshine-3`：https://github.com/fengduanzhuang1124/newsunshine-3
- CRMEB master 提交：https://github.com/fengduanzhuang1124/newsunshine-3/commits/master/

### 本地文档与代码

- `docs/05-Development-Log.md`
- `docs/06-Testing-Report.md`
- `docs/project-status-and-roadmap.md`
- `inventory-system/docs/pos-sync-database.md`
- `inventory-system/apps/admin-web/`
- `inventory-system/apps/api/`
- `../newsunshine-3/template/admin/`
- `../newsunshine-3/template/uni-app/`
