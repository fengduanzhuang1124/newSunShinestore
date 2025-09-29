# 新阳光商城 - 网页版管理后台

## 概述

这是新阳光商城的独立网页版管理后台，提供完整的管理功能，包括用户管理、商品管理、订单管理和数据统计。

## 功能特性

### 📊 仪表板
- 系统统计数据概览
- 用户总数、商品总数、订单总数、总销售额
- 热卖商品排行榜
- 订单趋势图表

### 👥 用户管理
- 查看所有用户列表
- 创建新用户（普通用户/管理员）
- 删除用户
- 用户角色管理

### 📦 商品管理
- 查看所有商品列表
- 商品信息管理
- 商品状态管理（上架/下架）
- 删除商品

### 🛒 订单管理
- 查看所有订单
- 按状态筛选订单
- 更新订单状态
- 订单详情查看

### 📈 数据统计
- 销售统计
- 今日/本月/总销售额
- 数据可视化

## 访问方式

### 1. 启动后端服务
```bash
cd backend
npm install
npm start
```

### 2. 访问管理后台
在浏览器中打开：
```
http://localhost:3000/admin
```

### 3. 登录
- 使用管理员账户登录
- 默认管理员账户需要先通过后端脚本创建

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (ES6+)
- **样式**: 响应式设计，支持移动端
- **图标**: Font Awesome 6.0
- **后端API**: Node.js + Express
- **认证**: JWT Token

## 文件结构

```
frontend/admin/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # JavaScript功能
└── README.md           # 说明文档
```

## API接口

管理后台使用以下API接口：

### 认证
- `POST /api/users/login` - 管理员登录

### 用户管理
- `GET /api/admin/users` - 获取所有用户
- `POST /api/admin/users` - 创建新用户
- `DELETE /api/admin/users/:id` - 删除用户

### 商品管理
- `GET /api/admin/products/all` - 获取所有商品
- `DELETE /api/admin/products/:id` - 删除商品

### 订单管理
- `GET /api/admin/orders` - 获取所有订单
- `PUT /api/admin/orders/:id/status` - 更新订单状态

### 统计数据
- `GET /api/admin/stats` - 获取系统统计
- `GET /api/statistics/hot-products` - 获取热卖商品
- `GET /api/statistics/order-trends` - 获取订单趋势

## 权限控制

- 所有管理功能都需要管理员权限
- 使用JWT Token进行身份验证
- 自动检查用户角色，只有admin角色可以访问

## 响应式设计

- 支持桌面端和移动端访问
- 自适应布局
- 触摸友好的交互设计

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 开发说明

### 本地开发
1. 确保后端服务正在运行
2. 修改 `script.js` 中的 `API_BASE_URL` 为正确的后端地址
3. 直接在浏览器中打开 `index.html`

### 生产部署
1. 将 `frontend/admin` 目录部署到Web服务器
2. 配置正确的API地址
3. 确保HTTPS安全连接

## 安全注意事项

- 管理后台仅限管理员访问
- 建议在生产环境中使用HTTPS
- 定期更新管理员密码
- 监控管理员操作日志

## 故障排除

### 常见问题

1. **无法登录**
   - 检查用户名和密码是否正确
   - 确认用户具有admin角色
   - 检查后端服务是否正常运行

2. **API请求失败**
   - 检查网络连接
   - 确认API地址配置正确
   - 查看浏览器控制台错误信息

3. **页面显示异常**
   - 清除浏览器缓存
   - 检查CSS文件是否正确加载
   - 确认浏览器兼容性

### 调试模式
在浏览器控制台中可以看到详细的错误信息和API请求日志。

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本发布
- 基础管理功能
- 响应式设计
- JWT认证集成
