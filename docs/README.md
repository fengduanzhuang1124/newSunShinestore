# 项目文档

此目录保存 SunShineNewStore 的长期项目文档。业务实现发生变化时，应同步更新相关文档，避免计划、页面和 API 状态不一致。

## 当前文档

- [01 — 外挂库存业务需求](01-Business-Requirement.md)
- [02 — 外挂库存技术设计](02-Technical-Design.md)
- [03 — 外挂库存数据库设计](03-Database-Design.md)
- [04 — 外挂库存 API 设计](04-API-Documentation.md)
- [05 — 开发日志](05-Development-Log.md)
- [06 — 测试报告](06-Testing-Report.md)
- [开发规范](development-standards.md)
- [项目现状与路线](project-status-and-roadmap.md)
- [交互指南](interaction-guide-v1.md)
- [集成检查清单](integration-checklist.md)
- [截图存档说明](10-Screenshots/README.md)

## 记录模板

- [开发日志模板](templates/development-log-template.md)
- [测试报告模板](templates/test-report-template.md)
- [部署记录模板](templates/deployment-record-template.md)
- [每周总结模板](templates/weekly-summary-template.md)

## 使用方法

1. 从 `docs/templates/` 复制对应模板。
2. 将记录保存到本地 `docs/records/<类型>/`。
3. 文件名使用 `YYYY-MM-DD-主题.md`。
4. 默认情况下 `docs/records/` 不进入 Git；需要作为正式项目证据存档时，应经过评审后使用 `git add -f` 明确添加。
5. 用户手册、API 文档、数据库字典等长期文档直接保存在 `docs/` 下并正常纳入版本控制。

根目录 `CHANGELOG.md` 是唯一权威变更日志，`docs/` 中不维护第二份副本。

## 文档维护规则

- “已完成”必须有代码、测试结果或部署记录支撑。
- 规划功能必须标记为“计划中”，不能写成当前能力。
- 命令和环境变量不得包含真实密码或密钥。
- 部署记录不得保存完整 token、用户隐私或数据库内容。
- 重要架构、权限和数据模型变更应同时更新 README、CHANGELOG 和相关文档。
