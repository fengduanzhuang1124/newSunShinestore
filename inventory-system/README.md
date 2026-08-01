# Sunshine Inventory Management System

独立于第三方 POS 的外挂库存系统。第一阶段支持一个门店试运行，同时从数据结构上支持多门店、多仓库、多条码和多到期日期。

## 当前范围

- NestJS API 基础骨架和健康检查；
- Vue 3 管理端基础骨架；
- Prisma 7 + MySQL 数据模型；
- 公司、门店、门店商品配置、仓库、商品、条码和到期批次；
- 用户、角色、权限和仓库范围；
- 库存流水、库存余额、调拨、临期设置和审计日志。
- 员工账号登录与JWT；
- 点货入库、出库上货架、库存查询和记录报表四分类工作台；
- 商品关键词/条码搜索、多条码聚合和各日期库存。
- 入库单、当天入库明细、总库存表和CSV导出；
- 按已过期、2个月、3个月、6个月分级的临期库存预警、查询和CSV导出。
- 当前仓库最近库存流水查询，以及按到期日期进行盘盈/盘亏调整。

当前已完成扫码入库、上货架手工出库、库存查询、入库/库存报表、临期预警、盘点和库存流水查询。调拨和批量导入将在后续小批次实现。

## 目录

```text
inventory-system/
├── apps/
│   ├── api/
│   └── admin-web/
├── packages/
│   └── database/
├── .env.example
└── docker-compose.yml
```

## 本地命令

需要 Node.js 24、npm/Corepack 和 Docker Desktop：

```bash
cp .env.example .env
npm install
npm run db:validate
npm test
npm run test:integration
npm run build
docker compose up -d mysql
```

启动本地页面：

```bash
cd /Users/jingjingdemac/Documents/Codex/newSunShinestore/inventory-system
npm run dev
```

`npm run dev` 会通过 Corepack 调用项目指定的 pnpm 11.9.0，同时启动 API `http://127.0.0.1:3100` 和管理页面 `http://127.0.0.1:5174`。也可以运行 `corepack pnpm dev`。只启动管理页面会导致查询和入库显示“无法连接库存 API”。

`.env` 只供本机使用，不得提交 Git。Docker Compose 中的默认密码只适用于绑定到 `127.0.0.1` 的本地开发数据库。

数据库集成测试必须使用 `TEST_DATABASE_URL`，且数据库名必须以 `_test` 结尾。测试会清理该测试库内的业务表，绝不能把开发库或生产库地址填入此变量。
