# 集成清单（Integration Checklist）

## 1. 环境 & 域名
- Node 版本：vXX
- MySQL 版本：8.x
- 后端 `.env` 已配置：
  - `JWT_SECRET=***`
  - `WECHAT_APPID=***`
  - `WECHAT_SECRET=***`
  - `WECHAT_MOCK=false`
- 公网域名可 200：`https://<你的域名>/health`
- 微信小程序后台 → 开发管理 → 服务器域名 已添加：
  - request 合法域名：`https://<你的域名>`

## 2. 数据库
- 已执行初始化 SQL / 迁移：
  - `users`（含 `wechat_openid`、`nickname`、`avatar_url`、`gender/country/province/city`）
  - `products`、`orders`、`order_items`、`cart`
- 本地可连接并有基础数据（3 个商品起步）

## 3. 启动命令
- 后端：`npm install && npm run start`
- 前端（uni-app）：HBuilderX 运行到 **微信小程序**；真机请用 **预览/真机调试**。

## 4. 前端域名切换（重要）
- `utils/request.js`
  - 开发者工具（PC）：使用内网 `http://192.168.x.x:3000`
  - 真机：使用公网 `https://<你的域名>`
- 统一通过 `api.setBaseURL()` 设置，**不要**在页面里写死 URL。

## 5. 小程序 pages.json 路由
- 已包含页面：
  - `pages/home/index`
  - `pages/home/product-list`
  - `pages/home/product-detail`
  - `pages/home/shopping-cart`
  - `pages/home/my-orders`
  - `pages/home/checkout`（非 tabBar，仅普通页面）
- `checkout` **不放在 tabBar**；跳转用：`uni.navigateTo({ url: '/pages/home/checkout' })`

## 6. 登录链路（微信）
- 前端：`uni.login` →（可选）`uni.getUserProfile` → `POST /api/users/wechat/login`
- 后端：`/wechat/login` 调用 `jscode2session`，用 `openid` 查/建用户
- 登录成功本地存储：
  - `token`、`userInfo`

## 7. 核心功能联调用例（勾选）
- [ ] 首页推荐商品 OK
- [ ] 商品列表分页 OK
- [ ] 商品详情 OK
- [ ] 加入购物车 OK
- [ ] 结账页显示/提交订单 OK
- [ ] 我的订单分页/筛选 OK
- [ ] 个人中心显示登录用户 OK

## 8. Loading/Toast 规范
- 统一封装 `request.js` 的 `showLoading/hideLoading`（计数配对）
- 页面不要重复 `hideLoading`（避免 `toast can't be found`）

## 9. 常见问题速查
- **真机报 -109 / ERR_ADDRESS_UNREACHABLE**：公网域名不可达或未加到微信「服务器域名」白名单
- **navigateTo: page not found**：检查 `pages.json` 是否包含该路径；用**绝对路径**跳转
- **微信登录一直新建用户**：确认 `WECHAT_MOCK=false`，后台确实向微信 `jscode2session` 发请求；打印 openid

## 10. 冒烟测试（提交前最后一遍）
登录 → 首页 → 详情 → 加入购物车 → 结账 → 下单 → 我的订单能看到新订单。
