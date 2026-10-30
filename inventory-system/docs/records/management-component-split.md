# 经营管理页面组件拆分

- 日期：2026-10-22
- 关联需求：REQ-011（经营管理部分）、REQ-008 阶段 2
- 性质：代码结构调整，界面、接口、数据与业务规则均不变

## 1. 拆分前

`apps/admin-web/src/management/ManagementDashboard.vue` 单文件 1,800 行（约 294 KB），包含全部状态与数据加载逻辑、8 个页面的模板和约 130 KB 的组件私有样式。任一页面的改动都需要在同一文件中定位，手机适配只能继续叠加覆盖样式。

## 2. 拆分后结构

| 文件 | 内容 |
| --- | --- |
| `management/ManagementDashboard.vue` | 外壳：侧边导航、页头、本页说明、弹窗与提示（Teleport）、错误与加载提示、底部导航、“更多”面板；原有三段样式保持原位、原样 |
| `management/useManagementDashboard.ts` | 原脚本的全部状态、计算属性、监听、生命周期与接口调用，逐行平移；通过 `provide/inject` 共享给页面组件 |
| `management/pages/OverviewPage.vue` | 经营总览 |
| `management/pages/SalesPage.vue` | 销售分析 |
| `management/pages/ProductsPage.vue` | 商品分析 |
| `management/pages/InventoryPage.vue` | 库存经营 |
| `management/pages/ProcurementPage.vue` | 本周进货 |
| `management/pages/CustomersPage.vue` | 分类与标签 |
| `management/pages/StoresPage.vue` | 门店对比 |
| `management/pages/SystemPage.vue` | 数据中心 |

页面组件只从共享状态中取用自身模板需要的变量，模板内容从原文件逐字移动。

## 3. 样式作用域设计

原样式为组件私有样式（scoped），只作用于声明它的组件渲染的元素。为保证拆分后样式效果完全一致：

- `vite.config.ts` 通过 `@vitejs/plugin-vue` 的 `features.componentIdGenerator`，让 `src/management/` 下所有 `.vue` 组件使用同一个作用域标识，原样式无需修改即作用于各页面组件与弹窗；其他组件仍使用插件默认规则。
- 每个页面组件保留一个 `<style scoped>` 块（目前只有说明注释），这是编译器为组件加作用域标识的前提，也是后续页面专属样式（REQ-008 阶段 3–4）的存放位置。
- 共用标识会使开发服务器的热更新记录冲突，因此 `vite.config.ts` 中的 `management-full-reload` 插件在编辑这些组件时改为整页刷新。正式构建不受影响。

未采用的方案：

| 方案 | 不采用原因 |
| --- | --- |
| 运行时为页面组件指定作用域标识 | Vue 编译时会把大段静态 HTML 预先生成字符串，作用域标识在编译阶段写入，运行时指定无法覆盖这部分元素 |
| 每个页面组件各自引入一份样式 | 打包后 CSS 约增至 8 倍，与 REQ-008 加载速度目标冲突 |
| 改为全局样式并加外层前缀 | 弹窗通过 Teleport 渲染在页面最外层，不在前缀容器内，会失去样式；且会改变选择器优先级 |

## 4. 验证

| 项目 | 结果 |
| --- | --- |
| 渲染结构比对 | 拆分前后，经营管理 8 个页面在 4 种尺寸/主题组合下共 32 份 DOM 快照逐字一致（作用域标识值统一替换后比较） |
| 截图像素比对 | 差异最多 0.74% 像素，集中在入场动画与浮动装饰；同一版本连续截图两次的差异为同一量级（最多 0.97%），判定为动画时序，与拆分无关 |
| 类型检查 | `corepack pnpm --filter @sunshine/inventory-admin-web typecheck` 通过（新增 `preview/` 纳入检查） |
| 自动测试 | admin-web 3 个测试文件、43 项测试全部通过 |
| 构建 | 通过；CSS 289.20 kB 不变；经营管理所在 JS 包 312.96 → 323.04 kB（gzip 95.7 → 100.2 kB），为页面组件注入与变量声明的开销；预览页面不进入构建产物 |

## 5. 回滚

本次改动仅涉及前端源码与 `vite.config.ts`、`tsconfig.json`，无数据库和接口变化。回滚时 `git revert` 对应提交即可。
