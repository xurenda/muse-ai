# 阶段 2：可组合 Agent

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`e4fee0c`  
**预估周期**：~1–2 周

---

## 目标

Persona + Skills 可组装成 Agent；切换 agent 后 system prompt 与 skills 注入应明显不同（本阶段 LLM 未接通，通过占位 SSE 与单元测试验证组装结果）。

---

## 任务清单

- [x] Persona 格式：`persona.json` + `system.md`
- [x] Skill 格式：`SKILL.md`（YAML frontmatter，兼容 pi/Cursor）
- [x] `MuseAgentRegistry`：加载、列出、按 agent 解析 Harness 选项
- [x] 内置资产：通用助手、编程助手 + git/review skills
- [x] CLI：`muse agent list` / `create` / `use`
- [x] HTTP：`GET /agents` 真实数据；`POST /sessions` 支持默认 `agentId`

---

## 设计决策

| 项          | 决策                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| 内置资产    | `packages/cli/assets/` **只读**，不复制到 `~/.muse/`                           |
| 加载顺序    | 用户目录优先，其次内置；同 id 用户覆盖                                         |
| Skills 注入 | 仅 system prompt（pi `formatSkillsForSystemPrompt`）                           |
| 默认 Agent  | `config.activeAgentId` → 内置「通用助手」；`POST /sessions` 可显式传 `agentId` |
| 开发入口    | 根目录 `pnpm muse …`（`tsx src/cli.ts`，免 build）                             |

---

## 实际产出

### 1. 资产格式与目录

**Persona**（`personas/<id>/`）：

| 文件           | 字段                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| `persona.json` | `id`、`name`、`systemPromptPath`；可选 `defaultModel`（`provider/modelId`）、`thinkingLevel` |
| `system.md`    | 角色 system prompt 正文                                                                      |

**Skill**（`skills/<id>/SKILL.md`）：

```yaml
---
name: git
description: Git 工作流规范
---
# 正文（SOP）
```

**Agent**（`agents/<uuid>/agent.json`）：

| 字段              | 说明                                 |
| ----------------- | ------------------------------------ |
| `personaId`       | 引用 Persona                         |
| `skillIds`        | 引用的 Skill id 列表                 |
| `activeToolNames` | 本阶段均为 `[]`（阶段 4 启用 tools） |

**存储布局：**

```
packages/cli/assets/          # 内置（只读）
├── personas/general|coding/
├── skills/git|review/
└── agents/<uuid>/

~/.muse/                      # 用户可写
├── config.json               # + activeAgentId
├── agents/<uuid>/            # muse agent create 写入
├── personas/                 # 用户自定义（可选）
└── skills/                   # 用户自定义（可选）
```

### 2. 内置 Agent

| 名称     | UUID    | Persona   | Skills          |
| -------- | ------- | --------- | --------------- |
| 通用助手 | `…0001` | `general` | —               |
| 编程助手 | `…0002` | `coding`  | `git`, `review` |

常量见 `packages/shared/src/constants/builtin-agents.ts`。

### 3. `@museai/core` — `MuseAgentRegistry`

```
packages/core/src/agent-registry.ts
```

| 能力                                 | 说明                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| `listAgents` / `getAgent`            | 合并内置 + 用户 agents                                             |
| `loadPersona` / `loadSkillsForAgent` | 解析资产目录，skills 走 pi `loadSkills`                            |
| `resolveRuntimeContext`              | 组装完整 system prompt（persona + skills XML 索引）                |
| `buildHarnessOptions`                | 产出 `MuseHarnessOptions`（model、thinkingLevel、activeToolNames） |
| `createAgent`                        | 校验 persona/skills 存在后写入 `~/.muse/agents/`                   |

**测试：** `test/agent-registry.test.ts`（5 项，含 fixtures）

### 4. `@museai/shared`（本阶段增量）

| 变更                                                       | 说明                                 |
| ---------------------------------------------------------- | ------------------------------------ |
| `personaSchema`                                            | 增加 `defaultModel`、`thinkingLevel` |
| `agentDefinitionSchema`                                    | 增加 `activeToolNames`               |
| `createSessionRequestSchema`                               | `agentId` 改为可选                   |
| `skillMetaSchema`、`thinkingLevelSchema`、`modelRefSchema` | 新增                                 |

### 5. `@museai/cli`

**新增命令（`commands/agent.ts`）：**

| 命令                                                    | 说明                             |
| ------------------------------------------------------- | -------------------------------- |
| `muse agent list`                                       | 列出 agents；当前默认项标 `*`    |
| `muse agent create --name … --persona … [--skills a,b]` | 创建用户 Agent，stdout 输出新 id |
| `muse agent use <agentId>`                              | 写入 `config.activeAgentId`      |

**Daemon 变更：**

| 路径/模块         | 变更                                                   |
| ----------------- | ------------------------------------------------------ |
| `GET /agents`     | 返回 `MuseAgentRegistry.listAgents()`                  |
| `POST /sessions`  | `agentId` 可省略；校验 agent 存在                      |
| `chat-service.ts` | 占位 SSE 携带 agent 名、persona、skills 与 prompt 摘要 |
| `paths.ts`        | `MuseConfig.activeAgentId`、`saveMuseConfig()`         |
| `assets-path.ts`  | 解析 `packages/cli/assets` 路径                        |

**根 `package.json`：** `"muse": "pnpm --filter @museai/cli exec tsx src/cli.ts"`

**测试：** `test/commands/agent.test.ts`（3 项）；`test/daemon/server.test.ts` 扩展至 10 项

---

## 验收

```bash
pnpm lint && pnpm format:check && pnpm test:run
# 38 tests passed

pnpm muse agent list
pnpm muse agent use 00000000-0000-4000-8000-000000000002   # 切换编程助手

# daemon 运行中
curl -s http://127.0.0.1:65433/agents | jq .
curl -s -X POST http://127.0.0.1:65433/sessions \
  -H 'Content-Type: application/json' -d '{}'              # 使用 activeAgentId
curl -s -X POST http://127.0.0.1:65433/chat \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<id>","message":"hello","mode":"prompt"}'
# SSE text_delta 含 Agent 名、skills 与 prompt 摘要
```

---

## 未做 / 留到后续阶段

| 能力                 | 阶段 | 说明                                |
| -------------------- | ---- | ----------------------------------- |
| LLM 真实调用         | 3    | Harness 接通 Backend Provider       |
| CLI 鉴权             | 3    | device token Bearer                 |
| `muse chat` 终端收流 | 3    | 纯文本 SSE                          |
| Tools 执行           | 4    | `activeToolNames` 对应 read/bash 等 |
| Web Agent 组装 UI    | 5    | 简易选择与创建                      |

---

## 下一阶段

见 [phase-3.md](./phase-3.md)：用户登录、LLM Provider CRUD、设备配对与心跳、CLI 无 Key 调模型。
