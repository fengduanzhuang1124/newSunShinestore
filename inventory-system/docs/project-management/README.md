# 项目管理与需求流程

本目录记录甲方（店主）需求从提出到上线的全过程，供验收、交接和追溯使用。技术细节记录仍放在 `docs/records/`。

## 流程

| 阶段 | 产出 | 位置 | 模板 |
| --- | --- | --- | --- |
| 1. 受理需求 | 需求登记（编号 REQ-XXX） | `requirements-register.md` | — |
| 2. 需求分析 | 需求说明书：来源（渠道与摘要）、范围、规则、验收标准、影响评估 | `requirements/REQ-XXX-*.md` | `docs/templates/requirement-spec-template.md` |
| 3. 甲方确认 | 在需求说明书“审批与变更记录”登记确认 | 同上 | — |
| 4. 需求变更 | 需求变更单（编号 CR-XXX），记录变更前后与影响 | `change-requests/CR-XXX-*.md` | `docs/templates/change-request-template.md` |
| 5. 迭代 | 迭代计划与总结 | `iterations/ITER-YYYYMMDD.md` | `docs/templates/iteration-plan-template.md` |
| 6. 每日 | 开发日志：完成事项、问题、决策、下一步 | `daily-logs/YYYY-MM-DD.md` | `docs/templates/development-log-template.md` |
| 7. 交付 | 测试报告、部署记录 | `docs/records/` | `docs/templates/test-report-template.md`、`deployment-record-template.md` |

## 规则

- 功能、界面、数据规则、数据修正类改动走完整流程（阶段 1–7）；小修复只记入开发日志。
- 编码前完成需求说明书；实施中规则有变化时补变更单，不直接改原需求的已确认内容。
- git 提交、合并上线前须经甲方同意（提交说明附测试结果）。
- 写正式数据库前先备份，先在非生产库或预演中验证。
