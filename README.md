# SunShineNewStore

SunShineNewStore 是一个面向微信小程序和 Web 管理员的电商系统，后端采用 Node.js、Express 和 MySQL。项目目标包括商品、库存、购物车、订单、客户、运营管理，以及后续的支付和 AI 能力。

当前仓库已经形成主要页面和 API 骨架，但仍处于“核心链路整合和质量治理”阶段，不应视为生产就绪系统。具体状态见 [项目现状与开发路线](docs/project-status-and-roadmap.md)。

当前第一优先级已经调整为独立开发 Sunshine Inventory Management System 外挂进销存系统。该系统第一阶段不修改、不替换和不连接第三方 POS，先实现多门店基础、扫码、到期日期、库存流水和临期提醒。

截至2026-07-31，`inventory-system/` 独立工作区、NestJS API、Vue 3 管理端、Prisma 7 Schema 和首个 MySQL migration 已建立。当前只实现基础健康检查和地基展示页，登录、库存事务和扫码页面尚未实现。

## 当前状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 用户注册、登录、JWT | 已有基础 | 权限和安全默认值需要整改 |
| 微信登录 | 已有基础 | 支持 mock 和真实微信流程 |
| 商品、品牌 | 部分完成 | 后端 API 已有，管理端仍有本地数据 |
| 购物车 | 已有基础 | 支持增删改查 |
| 库存和订单 | 部分完成 | 事务、并发和状态机需要完善 |
| 客户管理 | 部分完成 | 管理端尚未完整接通 |
| 运费和优惠券 | 部分完成 | 运费 SQL 兼容性、优惠券结算待修复 |
| 自动测试、CI/CD | 未完成 | 当前没有项目级测试体系 |
| AI 推荐、智能客服 | 规划中 | 核心交易闭环稳定后开发 |

“已有基础”表示仓库中存在主要实现，不表示已经通过完整联调、安全或生产验收。

## 技术栈

- 后端：Node.js、Express 5、MySQL、`mysql2/promise`
- 认证：JWT、bcryptjs
- 小程序：uni-app、Vue
- 管理后台：Vue 3、Vite、Element Plus、Axios
- 旧管理后台：原生 HTML/CSS/JavaScript，仅保留兼容维护

## 项目结构

```text
newSunShinestore/
├── AGENTS.md                         # 仓库开发和代理规范
├── CHANGELOG.md                      # 版本变更记录
├── backend/
│   ├── controllers/                  # 当前业务与数据库访问逻辑
│   ├── middleware/                   # 认证和参数验证
│   ├── routes/                       # REST API 路由
│   └── sql/                          # 数据库初始化脚本
├── frontend/
│   ├── admin-vue/                    # 主 Web 管理后台
│   ├── admin/                        # 旧版静态管理后台
│   └── newSunShineFrontend/          # uni-app 微信小程序
├── inventory-system/                 # 新外挂库存系统（当前主线）
│   ├── apps/api/                     # NestJS API
│   ├── apps/admin-web/               # Vue 3 管理端
│   └── packages/database/            # Prisma Schema 和 migration
└── docs/
    ├── README.md                     # 文档索引
    ├── development-standards.md      # 开发流程与质量规范
    ├── project-status-and-roadmap.md # 当前状态和阶段路线
    └── templates/                    # 项目记录模板
```

## 本地运行

### 前置条件

- Node.js：建议使用当前维护中的 LTS 版本
- MySQL 8.x
- HBuilderX 和微信开发者工具（运行小程序时）

### 后端

1. 在 `backend/` 中创建本地 `.env`，至少配置：

```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=replace_me
DB_NAME=newstore
JWT_SECRET=replace_with_a_long_random_secret
WECHAT_APPID=
WECHAT_SECRET=
WECHAT_MOCK=true
PORT=3000
```

2. 安装依赖并初始化本地数据库：

```bash
cd backend
npm install
npm run init-db
npm start
```

健康检查：

```text
GET http://localhost:3000/health
```

警告：初始化脚本会创建示例账号和商品，只适用于本地开发。使用生产环境前必须建立正式 migration 和安全 seed 流程。

### Vue 管理后台

```bash
cd frontend/admin-vue
npm install
npm run dev
```

当前管理端仍有 API 地址、token 键、模拟数据和本地存储等待整合的问题。不要使用 mock 登录作为生产认证。

### 微信小程序

使用 HBuilderX 打开 `frontend/newSunShineFrontend`，运行到微信小程序。API 地址统一通过 `utils/request.js` 的 BaseURL 配置，不要在页面中增加硬编码地址。

## 核心业务范围

当前优先交付：

1. 安全的用户认证和管理员权限；
2. 商品、品牌和分类管理；
3. 购物车；
4. 可靠的库存扣减与订单事务；
5. 客户、订单、运费和发货管理；
6. 测试、部署、监控和备份基线。

后续增强：

- 微信支付、退款、售后和物流追踪；
- 客户标签、通知和高级运营报表；
- AI 推荐、FAQ 和智能客服；
- 多语言、预测分析和营销自动化。

## 开发路线

| 阶段 | 目标 |
| --- | --- |
| 0. 需求与环境 | 确认门店流程、数据库/API 设计并准备 Node.js 和 Docker |
| 1. 库存数据与 API | 多门店、仓库、商品、多条码、多日期、流水、权限和审计 |
| 2. 扫码库存 MVP | 扫码、初始库存、入库、手工出库、调拨、盘点和临期提醒 |
| 3. 门店试运行 | 局域网部署、备份恢复、员工培训并发布 v0.1.0 |
| 4. 统一销售管理 | 订单、物流、英文网页、小程序和人工微信订单 |
| 5. 外部整合与 AI | POS 对账、销售分析和 AI 员工辅助客服 |

## 开发和贡献

开始修改前请阅读：

- [AGENTS.md](AGENTS.md)
- [外挂库存业务需求](docs/01-Business-Requirement.md)
- [外挂库存技术设计](docs/02-Technical-Design.md)
- [外挂库存数据库设计](docs/03-Database-Design.md)
- [外挂库存 API 设计](docs/04-API-Documentation.md)
- [开发日志](docs/05-Development-Log.md)
- [测试报告](docs/06-Testing-Report.md)
- [开发规范](docs/development-standards.md)
- [集成检查清单](docs/integration-checklist.md)
- [交互指南](docs/interaction-guide-v1.md)
- [CHANGELOG.md](CHANGELOG.md)

项目记录模板：

- [开发日志](docs/templates/development-log-template.md)
- [测试报告](docs/templates/test-report-template.md)
- [部署记录](docs/templates/deployment-record-template.md)
- [每周总结](docs/templates/weekly-summary-template.md)

## 安全要求

- 不提交 `.env`、密码、token、微信密钥或数据库备份。
- 公共注册接口不得创建管理员。
- 管理接口必须同时验证身份和管理员角色。
- 订单和库存必须在同一数据库连接的事务中处理。
- 禁止将 mock token、默认 JWT secret 或硬编码管理密码用于生产。
- 发现安全问题时先记录为 P0 Issue，再进行最小范围修复和回归测试。

## 原始项目计划

项目最初按 10 周规划：

1. 环境、需求和数据库设计；
2. API、认证和基础 CRUD；
3. 前端、微信登录和前后端集成；
4. 订单、购物车、管理后台和权限；
5. AI 推荐和行为分析；
6. 智能客服和 FAQ；
7. 性能、安全和错误处理；
8. 全面测试、验收和文档；
9. 生产环境、监控和备份；
10. 最终测试、培训和交付。

当前应从安全与核心交易闭环重新建立可验证基线，再继续第 5–10 周的高级功能。
