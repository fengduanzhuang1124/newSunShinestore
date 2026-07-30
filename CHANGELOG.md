# Changelog

本文件记录 SunShineNewStore 的重要变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号建议遵循语义化版本。

## [Unreleased]

### Added

- 建立仓库级开发规范 `AGENTS.md`。
- 建立文档索引、开发规范和项目现状说明。
- 增加开发日志、测试报告、部署记录和每周总结模板。
- 建立外挂进销存系统01–06号需求、技术、数据库、API、开发日志和测试基线文档。
- 建立多门店、多仓库、多条码、多到期日期、权限和库存流水设计。
- 记录 Mac 开发环境检查结果。

### Changed

- 更新 README，使项目目标、当前完成度和后续路线相互区分。
- 完善根目录 `.gitignore`，覆盖依赖、构建产物、环境文件和本地记录。
- 将当前开发主线调整为先完成独立外挂库存 MVP，再整合电商、POS、物流和 AI。

### Security

- 文档明确禁止公共管理员注册、默认密钥、模拟生产登录和敏感日志。

## Repository milestone 26eeff6 - 2025-07-17

### Added

- 建立 Node.js、Express、MySQL 后端基础结构。
- 建立 uni-app 微信小程序页面和请求封装。
- 实现用户、商品、购物车和订单基础功能。
- 实现 JWT 认证和基础角色区分。

## Repository milestone 2933f17 - 2025-09-29

### Added

- 增加 Vue 3 管理后台页面。
- 增加品牌、运费、优惠券、仪表板和统计模块。
- 增加微信登录、结算和用户订单页面。

### Known Issues

- 部分管理页面仍使用模拟数据或浏览器本地存储。
- 运费控制器与 MySQL 驱动存在兼容问题。
- 认证权限、订单事务、测试和部署流程仍需完善。

[Unreleased]: https://github.com/fengduanzhuang1124/newSunShinestore/compare/main...HEAD
