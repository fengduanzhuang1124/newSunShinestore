# 经营总览提示遮挡修复

- 问题：固定高度容器中的第二条网格行使用 `minmax(0, 1fr)`，库存更新时间提示被压缩，与 KPI 卡片重叠。
- 修复：仅经营总览使用内容高度网格行；提示清除默认段落外边距并允许窄屏换行。保留库存来源提示和条件显示的 POS 同步入口。
- 范围：只修改模板样式类和 CSS；未修改 API、数据库、库存计算或 POS 同步逻辑。
- 验证：`corepack pnpm --filter @sunshine/inventory-admin-web build` 通过（含 `vue-tsc -b`）。尚未完成浏览器实屏复验。
