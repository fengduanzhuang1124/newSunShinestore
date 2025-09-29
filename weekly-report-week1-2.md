Student's Name: skylar  
Supervisor's Name: Shaoqun Wu

## Week 1 : From 28-07-2025 to 01-08-2025

| Date | Activity | Thoughts/Opinions/Reflections | Supervisor's Comments |
| --- | --- | --- | --- |
| 28-07-2025 | 项目初始化：确定技术栈（Node.js + Express + MySQL + uni-app + Vue.js）；创建项目目录结构；熟悉前后端分离架构开发流程 | 技术选型考虑跨平台开发需求，uni-app能同时支持微信小程序和H5；前后端分离架构提高了开发效率和系统可维护性 |  |
| 29-07-2025 | 数据库设计与表创建：设计users、products、orders、order_items、cart表结构；学习MySQL外键约束和ENUM类型使用；考虑微信登录字段扩展 | 数据库设计要考虑业务扩展性，外键约束保证数据完整性，ENUM类型提高数据规范性 |  |
| 30-07-2025 | 后端RESTful API路由设计：创建controllers、routes、middleware目录结构；设计用户、产品、订单相关API接口 | RESTful设计原则让API更规范，便于前端调用和后期维护 |  |
| 31-07-2025 | JWT认证系统实现：集成jsonwebtoken库，实现JWT token生成和验证；学习bcryptjs密码加密技术 | JWT无状态认证适合分布式系统，bcryptjs加密保证密码安全 |  |
| 01-08-2025 | 基于角色的访问控制中间件：实现auth.js中间件，区分admin和customer角色权限；保护需要认证的API接口 | 角色权限控制是系统安全的重要环节，中间件模式便于统一管理 |  |

## Week 2 : From 04-08-2025 to 08-08-2025

| Date | Activity | Thoughts/Opinions/Reflections | Supervisor's Comments |
| --- | --- | --- | --- |
| 04-08-2025 | 用户注册登录功能：实现用户注册API（密码加密存储）、登录API（JWT token返回）；编写用户控制器逻辑 | 用户认证是系统基础功能，密码加密和token机制保证安全性 |  |
| 05-08-2025 | 微信小程序登录集成：初步集成微信登录流程，学习第三方API调试和集成方法；编写数据库初始化脚本 | 第三方API集成需要仔细处理错误和异常情况，调试过程很有价值 |  |
| 06-08-2025 | uni-app框架学习：学习uni-app跨平台开发，掌握Vue.js组件化开发模式；创建前端项目结构 | uni-app一套代码多端运行特性很好，Vue.js组件化开发提高代码复用性 |  |
| 07-08-2025 | 前端页面路由设计：设计pages.json页面路由结构，配置tabBar导航；创建基础页面框架 | 页面路由设计要符合用户使用习惯，tabBar导航提升用户体验 |  |
| 08-08-2025 | 工具类封装开发：编写request.js统一API请求处理，实现router.js导航管理工具类 | 工具类封装显著提高代码复用性和可维护性，统一请求处理便于错误处理 |  |

---

### 主要成果

**技术架构搭建完成**
- 后端：Node.js + Express + MySQL，MVC架构
- 前端：uni-app + Vue.js，支持微信小程序跨平台开发
- 数据库：完整的电商业务表结构设计（外键约束、ENUM类型）
- 认证：JWT + bcryptjs安全认证体系，基于角色的访问控制

**核心功能模块**
- 用户管理系统（注册/登录/认证/角色权限）
- 产品管理系统（CRUD/分页/分类/状态管理）
- 订单管理系统（状态流转/购物车/订单明细）
- 前端页面框架（多页面/路由/导航/tabBar）

**开发工具链与集成**
- 数据库初始化脚本（initDatabase.js）
- API请求封装工具（request.js）
- 路由管理工具（router.js）
- 微信小程序开发环境配置
- 前后端集成测试与CORS问题解决
- 微信域名验证配置

**学习收获**
- 掌握前后端分离架构开发流程
- 熟悉MySQL数据库设计、外键约束和ENUM类型使用
- 实践JWT认证和bcryptjs密码加密技术
- 学习uni-app跨平台开发和Vue.js组件化开发
- 解决CORS跨域和微信域名验证等集成问题
- 理解MVC架构重构对代码组织性的提升

### 导出为 PDF（任一方式）

1) VS Code 扩展（推荐）
- 安装扩展：Markdown PDF  
- 右键本文件 → "Markdown PDF: Export (pdf)"

2) 命令行（Pandoc）
```
pandoc weekly-report-week1-2.md -o weekly-report-week1-2.pdf
```

3) 浏览器打印为 PDF
- 在 VS Code 里预览本文件（Ctrl+Shift+V）→ Ctrl+P → 打印为 PDF
