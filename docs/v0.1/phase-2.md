# 阶段 2：可组合 Agent

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`e4fee0c`  
**预估周期**：~1–2 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

Persona + Skills 可组装成 Agent，切换 agent 后 system prompt 与 skills 行为明显不同。

---

## 计划任务

- [x] Persona 格式：`persona.json` + `system.md`
- [x] Skill 格式：`SKILL.md`（兼容 pi/Cursor 惯例）
- [x] `MuseAgentRegistry`：加载、列出、实例化 Harness
- [x] 内置资产：通用助手、编程助手 + git/review 等 skills
- [x] CLI：`muse agent list/create/use`
- [x] CLI HTTP API：`/agents`、`/sessions` 真实数据

---

## 验收标准

- [x] 新建/切换 agent 后对话行为符合所选 Persona + Skills
- [x] `~/.muse/agents/`、`personas/`、`skills/` 目录结构稳定
- [x] Agent 可声明 `activeToolNames`（tools 实现见 [阶段 4](./phase-4.md)，本阶段可为空列表）

---

## 设计决策

| 项          | 决策                                                      |
| ----------- | --------------------------------------------------------- |
| 内置资产    | `packages/cli/assets/` 只读，不复制到 `~/.muse/`          |
| Skills 注入 | 仅 system prompt（pi `formatSkillsForSystemPrompt`）      |
| 默认 Agent  | `config.activeAgentId`；`POST /sessions` 可覆盖 `agentId` |
| 开发入口    | 根目录 `pnpm muse …` → `tsx src/cli.ts`                   |

---

## 完成记录

| 模块              | 路径                                                                |
| ----------------- | ------------------------------------------------------------------- |
| MuseAgentRegistry | `packages/core/src/agent-registry.ts`                               |
| 内置资产          | `packages/cli/assets/`（personas、skills、agents）                  |
| Agent CLI         | `packages/cli/src/commands/agent.ts`                                |
| 资产路径          | `packages/cli/src/assets-path.ts`                                   |
| 类型扩展          | `packages/shared/src/types/agent.ts`、`constants/builtin-agents.ts` |
| Daemon 接通       | `GET /agents`、默认 `agentId`、`ChatService` 占位 SSE 带 Agent 摘要 |
| 开发脚本          | 根 `package.json` → `pnpm muse`                                     |

### 验收

```bash
pnpm lint && pnpm format:check && pnpm test:run
# 38 tests passed

pnpm muse agent list
pnpm muse agent use 00000000-0000-4000-8000-000000000002
curl -s http://127.0.0.1:7421/agents | jq .
```
