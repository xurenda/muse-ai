---
name: git
description: Git 提交、分支与 PR 工作流规范
---

# Git 工作流

## 提交前

1. 查看 `git status` 与 `git diff`，确认变更范围
2. 不要提交 `.env`、密钥或无关格式化噪音
3. 提交信息聚焦「为什么」，1–2 句完整句子

## 分支

- 功能分支从 main 拉取，命名如 `feat/xxx`、`fix/xxx`
- 合并前确保本地测试通过

## Pull Request

- 摘要说明动机与测试方式
- 大改动拆成可 review 的小 PR
