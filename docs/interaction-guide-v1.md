# 交互指南 v1

## 1. 页面与跳转
- tabBar：`首页 / 商品 / 购物车 / 我的`
- 非 tabBar：`商品详情`、`结账`、`我的订单`
- 跳转规则：
  - tabBar：`uni.switchTab({ url: '/pages/home/index' })`
  - 普通页：`uni.navigateTo({ url: '/pages/home/checkout' })`
  - 绝对路径，路径需在 `pages.json` 已注册

## 2. 登录与存储
- 登录成功本地存储：
  - `token`（Bearer 放到请求头）
  - `userInfo`
- `ensureLogin()`：无 `token` → `uni.switchTab('/pages/account/profile')`
- 401 统一重定向到“个人中心”并显示“请先登录”

## 3. 加载与错误
- 列表页：首次加载显示“加载中…”，失败显示“加载失败”，空数据显示“暂无数据”
- 全局请求 Loading 由 `request.js` 统一控制；不要在页面里手动 `hideLoading()` 两次
- 错误 Toast 简短明确：如“网络错误，请重试”“请完整填写收货信息”

## 4. 列表与分页
- 商品列表、订单列表：`page + pageSize`，底部“加载更多”按钮
- `hasMore=false` 隐藏按钮

## 5. 金额/格式
- 价格统一 `toFixed(2)`，展示 `¥ 12.90`

## 6. 结账流程
- 入口：详情页“立即购买”或购物车“去结算”
- 校验：收货人 / 手机 / 地址必填
- 请求：`POST /api/orders`（items[{ product_id, quantity }], address, phone, receiver_name）
- 成功：清除 `checkout_items`，Toast“下单成功”，跳转“我的订单”

## 7. 微信登录流程
- `uni.login` 拿 `code`
- （可选）`uni.getUserProfile` 拿昵称/头像
- 发送 `{ code, nickname, avatarUrl, ... }` → `/api/users/wechat/login`
- 后端用 `openid` 查/建用户并返回 `token`、`user`

## 8. 本地缓存 Key
- `token`、`userInfo`、`checkout_items`（结账临时数据）

## 9. 命名与组织
- 页面路径：`/pages/home/*`、`/pages/account/*`、`/pages/management/*`
- 组件/方法命名：见现有代码风格；接口全部走 `this.$api.*`

## 10. 小贴士
- 导航失败优先查 `pages.json` 是否注册；其次检查跳转是否用绝对路径
- 真机与开发者工具的 BaseURL 可能不同，记得看控制台“当前 BaseURL”
