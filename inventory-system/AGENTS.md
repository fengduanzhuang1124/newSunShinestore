# Inventory System Development Rules

本目录是独立的 Sunshine Inventory Management System。除仓库根目录 `AGENTS.md` 外，开发本目录时还必须遵守以下规则：

- 第一阶段不连接、监听或替换第三方 POS。
- 商品主档属于企业；门店商品配置使用 `store_products`，不得复制商品主档。
- 库存事实来源是不可变的 `stock_movements`，`inventory_balances` 仅作查询汇总。
- 所有库存写入必须使用事务、幂等键、权限范围和审计日志。
- 数量按件记录且必须为整数；正常出库不得造成负库存。
- 条码按字符串处理，不得转换为数字。
- 业务代码、测试、数据库 migration 和文档必须同步变更。
- 第一阶段先完成数据库和后端基础能力，再开发扫码页面。
