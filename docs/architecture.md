# Muse 架构（Flue 运行时）

本文描述 Muse 基于 [Flue](https://flueframework.com/) 的目标架构：本地 daemon、数据目录、市场包格式、API 分层，以及 Muse 概念与 Flue 概念的映射。实现时以本文为准；类型定义逐步沉淀到 `@muse-ai/shared`。

## 设计原则

- **Agent 运行时交给 Flue**：`@muse-ai/cli` 不直接依赖 `@earendil-works/pi-*`；对话状态、工具循环、事件流由 `@flue/runtime` 提供。
- **构建时发现 Agent**：市场包安装到本地后，由内嵌的 `@flue/cli` 将 `~/.muse/runtime/` 编译为可部署的 `dist/server.mjs`；不支持运行时 jiti 加载 extension。
- **能力可组合**：Package 导出 profile、tool、skill 等**独立能力**；客户端在 Agent 实例上任意勾选组合（例如 A 的人设 + B 的 tool）。
- **裸 Flue Agent API**：Web / Desktop 通过 `@flue/sdk` 调用 `POST /agents/:name/:id` 与事件流；不保留 pi 时代的 `/sessions` 协议，不做事件 adapter。
- **Muse 自定义 API 只管产品面**：设置、市场安装、对话索引等；不重复实现 agent loop。
- **单 daemon**：全局唯一本地 HTTP 服务（Hono），默认 `127.0.0.1:7421`；启动时不绑定 cwd。
- **cwd 按对话注入**：用户在客户端创建对话时选择工作目录；首次 `initialize({ id })` 时写入 Flue harness，不同对话可有不同 cwd。
- **市场与安装**：浏览、搜索、下载由 `@muse-ai/backend` 负责；本地 `registry/` 只记录已安装项，不存远程 source。

## 包职责

| 包                             | 职责                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `@muse-ai/cli`                 | 本地 daemon（Hono）、Flue 工作区生成与 build、市场包同步、`/api/*` 产品路由；内嵌 `@flue/cli` |
| `@muse-ai/web`                 | Web 客户端；`@flue/sdk` 调 Agent API + 调 Muse `/api/*`                                       |
| `@muse-ai/desktop`（后续实现） | Electron 客户端；与 Web 相同协议，连接任意可达的 `@muse-ai/cli`                               |
| `@muse-ai/backend`             | 插件 / tool / agent 市场 API（元数据 + 包下载）                                               |
| `@muse-ai/shared`              | 跨包类型、常量、协议（`Composition`、`ConversationMeta` 等）                                |

## Muse 概念 ↔ Flue 概念

| Muse（产品 / UI）      | Flue（运行时）                                 | 说明                                               |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------- |
| 市场 Package           | `~/.muse/packages/<id>/` 源码                  | 安装单元，声明可导出能力                           |
| Agent 实例（助手配置） | `agents/<slug>.ts` 模块名 + `composition.json` | UI 里的「我的代码助手」，不是 Flue instance id     |
| 对话（Conversation）   | Agent **instance id**（URL 中的 `:id`）        | 一次对话 = 一个 Flue instance，独立 harness 与 cwd |
| 对话内多轮消息         | 同一 instance 下 `session('default')`          | 历史由 Flue `SessionStore` 持久化，无本地 jsonl    |
| Tool                   | `defineTool` 模块，build 时编入 registry       | 可按 package 任意组合                              |
| Skill                  | `SKILL.md`，build 时编入 registry              | 可按 package 任意组合                              |
| Plugin（旧称）         | 不再使用；统一为 **Package**                   | 不再暴露 extension / jiti                          |

### 对话与实例的关系

同一 Agent 实例（如 `my-bot`）下可有多条对话：

```
Agent 实例 "my-bot"  →  Flue agent 模块名: my-bot
对话 A               →  instance id: uuid-a  →  cwd: /project/a
对话 B               →  instance id: uuid-b  →  cwd: /project/b
```

每条对话有独立 harness、cwd 与 SessionStore。Web 侧边栏的「对话列表」来自 Muse 轻量索引，不是 Flue 公共 API 的一部分。

## 环境变量

| 变量               | 作用                                                 |
| ------------------ | ---------------------------------------------------- |
| `MUSE_HOME`        | 覆盖数据根目录（默认 `~/.muse`）；用于测试或隔离环境 |
| `MUSE_DAEMON_PORT` | daemon 监听端口（默认 `7421`）                       |

对话 **cwd** 在 `POST /api/conversations` 时由客户端传入，不通过环境变量设置。

## 目录布局

```
~/.muse/
├── daemon.json                 # daemon 运行状态（pid、port 等）
├── settings.json               # 全局设置（语言、主题等）
├── auth.json                   # API Key / OAuth；用于生成 runtime/app.ts 的 provider 配置
├── models.json                 # 自定义 provider / 模型（可选，与 settings 合并策略实现时定稿）
│
├── registry/                   # 已安装 package 注册表
│   └── packages.json
│
├── packages/                   # 从 backend 下载的原始包
│   └── acme/
│       └── code-assistant/
│           ├── muse.manifest.json
│           ├── profiles/
│           ├── tools/
│           └── skills/
│
├── agents/                     # Muse Agent 实例（UI 配置，非 Flue agents/ 源码）
│   └── my-bot/
│       ├── meta.json           # 显示名、描述等
│       └── composition.json    # 用户勾选的能力组合
│
├── conversations/              # 对话索引（非对话内容；内容由 Flue SessionStore 持有）
│   └── <conversation-id>.json
│
└── runtime/                    # Flue 工作区（cli 自动生成，勿手改）
    ├── flue.config.ts
    ├── app.ts                  # 从 auth.json 生成 registerProvider 等
    ├── lib/                    # 由 cli workspace 复制；读 ~/.muse 的 composition / conversation
    │   ├── load-composition.ts
    │   └── load-conversation.ts
    ├── agents/
    │   └── my-bot.ts           # 按实例生成；通过 ../lib 读 composition + conversation
    ├── tools/
    │   └── registry.ts         # 聚合已安装 package 的 defineTool
    ├── skills/
    │   └── registry.ts         # 聚合已安装 package 的 SKILL.md
    └── dist/
        └── server.mjs          # flue build 产物
```

**明确废弃：**

- `sessions/**/*.jsonl` — 对话历史由 Flue 管理
- `plugins/<id>/extensions/` + jiti — 改为 Flue `defineTool` / MCP
- `agents/<id>/SYSTEM.md` + `plugins.json` 启用列表 — 改为 `composition.json`

## 核心数据结构

### `composition.json`（Agent 实例能力组合）

路径：`~/.muse/agents/<slug>/composition.json`。客户端设置页读写此文件。

```json
{
  "model": "anthropic/claude-sonnet-4-6",
  "profile": {
    "package": "acme/code-assistant",
    "id": "default"
  },
  "tools": [
    { "package": "acme/github-tools", "id": "create-pr" },
    { "package": "beta/web-search", "id": "search" }
  ],
  "skills": [{ "package": "acme/review-pack", "id": "code-review" }],
  "mcp": [{ "package": "acme/mcp-bundle", "server": "filesystem" }]
}
```

- `profile`：人设与默认 model 建议，来自某 package 的 `profiles` 导出。
- `tools` / `skills` / `mcp`：可来自**任意已安装** package；保存后对新对话生效（已打开的 instance 是否热更新由实现定稿，默认可要求新开对话）。

### `conversations/<id>.json`（对话索引）

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "agentName": "my-bot",
  "cwd": "/Users/me/projects/my-app",
  "title": "修复登录 bug",
  "createdAt": "2026-06-11T10:00:00.000Z",
  "updatedAt": "2026-06-11T10:05:00.000Z"
}
```

用途：

1. Web 侧边栏列表（`GET /api/conversations`）
2. `createAgent(({ id }) => ...)` 中 `loadConversation(id)` 解析 `cwd` 与 `agentName`

对话正文与 tool 历史**不**写入此文件。

### `muse.manifest.json`（市场 Package）

每个可安装包根目录声明可导出能力（示意）：

```json
{
  "id": "acme/github-tools",
  "version": "1.0.0",
  "exports": {
    "tools": [
      {
        "id": "create-pr",
        "module": "tools/create-pr.ts",
        "name": "create_pr",
        "description": "Create a GitHub pull request"
      }
    ]
  }
}
```

```json
{
  "id": "acme/code-assistant",
  "version": "1.0.0",
  "exports": {
    "profiles": [
      {
        "id": "default",
        "instructions": "你是代码助手…",
        "defaultModel": "anthropic/claude-sonnet-4-6",
        "suggestedTools": ["acme/github-tools/create-pr"]
      }
    ]
  }
}
```

可选 `bundle` 字段提供市场一键安装时的默认 composition，用户仍可在客户端拆开或替换。

工具在 registry 中的键为 `<packageId>/<exportId>`（如 `acme/github-tools/create-pr`），避免跨包 `name` 冲突。

## HTTP API 分层

daemon 为单一 Hono 应用：

```
┌─────────────────────────────────────────────┐
│  @muse-ai/cli (Hono)                        │
│                                             │
│  /api/*              Muse 产品 API          │
│  /agents/*           Flue 原生（flue()）     │
│  /workflows/*        Flue 原生（可选）       │
│  /openapi.json       Flue 自带              │
└─────────────────────────────────────────────┘
```

### Flue 原生（Web 用 `@flue/sdk`）

| 方法           | 路径                | 用途                             |
| -------------- | ------------------- | -------------------------------- |
| `POST`         | `/agents/:name/:id` | 发送消息 `{ "message": string }` |
| `GET` / `HEAD` | `/agents/:name/:id` | Durable Streams 事件流           |
| `GET`          | `/openapi.json`     | OpenAPI                          |

示例：

```http
POST /agents/my-bot/550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "message": "帮我看看这个项目" }
```

Web 侧：

```ts
import { createFlueClient } from '@flue/sdk'

const client = createFlueClient({ baseUrl: daemonUrl })
await client.agents.prompt('my-bot', conversationId, { message: '...' })
const stream = client.agents.stream('my-bot', conversationId)
```

聊天 UI 直接消费 Flue `AttachedAgentEvent` / `FlueEvent`，不维护 pi 事件映射。

### Muse 产品 API（`/api/*`）

| 方法           | 路径                     | 用途                                       |
| -------------- | ------------------------ | ------------------------------------------ |
| `GET`          | `/api/health`            | 健康检查                                   |
| `GET` / `PUT`  | `/api/settings/*`        | 全局设置、provider、API Key                |
| `GET`          | `/api/packages`          | 已安装 package 列表                        |
| `POST`         | `/api/packages/install`  | 从 backend 安装（触发 sync + rebuild）     |
| `DELETE`       | `/api/packages/:id`      | 卸载（触发 rebuild）                       |
| `GET` / `POST` | `/api/agents`            | Muse Agent 实例（composition）CRUD         |
| `GET` / `POST` | `/api/conversations`     | 对话索引；创建时写入 `cwd`                 |
| `DELETE`       | `/api/conversations/:id` | 删除索引；Flue instance 清理策略实现时定稿 |

Web / Desktop 连接**任意**可达的 `@muse-ai/cli` 基址（含远程服务器上的 daemon）。

## 生成的 Flue Agent 模块（示意）

`~/.muse/runtime/agents/my-bot.ts` 由 cli 根据已安装的 agent 实例生成，核心逻辑：

```ts
import { createAgent, type AgentRouteHandler } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { loadComposition } from '../lib/load-composition'
import { loadConversation } from '../lib/load-conversation'
import { pickTools } from '../tools/registry'
import { pickSkills } from '../skills/registry'

export const route: AgentRouteHandler = async (_c, next) => next()

export default createAgent(({ id }) => {
  const conv = loadConversation(id)
  const comp = loadComposition(conv.agentName)
  return {
    model: comp.model,
    instructions: resolveProfile(comp.profile),
    tools: pickTools(comp.tools),
    skills: pickSkills(comp.skills),
    cwd: conv.cwd,
    sandbox: local(),
  }
})
```

每个 Muse Agent 实例 slug 对应一个 Flue agent 模块名；`id` 为 conversation id。

## 安装与构建流程

```mermaid
flowchart LR
  BE["@muse-ai/backend"] -->|"下载 tarball"| PKG["~/.muse/packages/"]
  PKG --> WB["Workspace Builder"]
  WB --> RT["~/.muse/runtime/"]
  RT --> FB["flue build"]
  FB --> SRV["dist/server.mjs"]
  SRV --> DAEMON["muse daemon"]
```

| 操作             | 行为                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| 安装 package     | backend 下发 → 解压到 `packages/` → 更新 `registry/packages.json` → 重新生成 `runtime/` → `flue build` → 重启 daemon |
| 卸载 package     | 删除目录与 registry 项 → rebuild                                                                                     |
| 修改 composition | 只改 `agents/<slug>/composition.json`；**无需 rebuild**（能力已在 registry 中）                                      |
| 新装 package     | **必须 rebuild**（新 tool/skill 模块进入 bundle）                                                                    |

内嵌 `@flue/cli`：短期通过 `node_modules/@flue/cli/bin/flue.mjs build --target node` 调用；长期争取使用官方导出的 programmatic `build()` API。

## `@muse-ai/cli` 模块划分（目标）

```
packages/cli/src/
├── workspace/              # 生成 ~/.muse/runtime/、tool/skill registry
│   └── runtime-lib/        # 生成时复制到 runtime/lib/（读 composition、conversation）
├── flue/                   # 封装 flue build、管理 server 子进程
├── api/                    # Hono /api/* 路由
├── app.ts                  # mount flue() + /api
└── commands/               # muse daemon start | package install | ...
```

### `workspace/runtime-lib`（原「bridge」）

Flue 生成的 `agents/*.ts` 在 `initialize({ id })` 时需要读取 Muse 本地数据（`~/.muse/conversations/`、`~/.muse/agents/`）。这些逻辑**不**单独成包，而是：

1. 源码维护在 `packages/cli/src/workspace/runtime-lib/`
2. Workspace Builder 每次生成 `~/.muse/runtime/` 时复制到 `runtime/lib/`
3. 生成的 agent 模块通过相对路径 `import '../lib/...'` 引用

类型定义放在 `@muse-ai/shared`；市场 package 不包含任何 `~/.muse` 读取逻辑。

**删除（pi 时代）**：`agent-factory`、`extension-host`、基于 pi 的 `session-manager`、自研 `/sessions` 与 WebSocket pi 事件协议。

## 配置分层

| 文件                             | 作用域     | 说明                                     |
| -------------------------------- | ---------- | ---------------------------------------- |
| `settings.json`                  | 全局       | 语言、主题等                             |
| `auth.json`                      | 全局       | provider 凭证；参与生成 `runtime/app.ts` |
| `agents/<slug>/meta.json`        | Agent 实例 | 显示名、描述                             |
| `agents/<slug>/composition.json` | Agent 实例 | 能力组合                                 |
| `conversations/<id>.json`        | 单条对话   | 索引 + cwd；无消息正文                   |

## 命名与 id

市场资源 id 采用命名空间：

| 来源     | 格式                 | 示例               |
| -------- | -------------------- | ------------------ |
| 市场     | `<publisher>/<name>` | `acme/code-review` |
| 本地创建 | `local/<name>`       | `local/my-bot`     |

目录路径将 `/` 映射为层级（如 `packages/acme/code-assistant/`）。registry 键与 manifest `id` 一致。

## 实现阶段

| 阶段    | 内容                                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------------- |
| Phase 0 | 手工 `runtime/` 最小 Flue 项目 + `muse daemon` build 并起 `server.mjs`；curl 验证 `POST /agents/...` |
| Phase 1 | 去掉 pi 依赖；Workspace Builder + 单 agent；Web 用 `@flue/sdk` 完成基础对话                          |
| Phase 2 | `composition.json` + registry 跨 package 组合；`/api/conversations`、`/api/agents`                   |
| Phase 3 | `@muse-ai/backend` 市场 API + `muse install`；settings → `app.ts` provider                           |
| Phase 4 | Desktop、MCP、skills UI                                                                              |

## 与过期文档的对照

| 旧（`local-data-model.md`）         | 新（本文）                               |
| ----------------------------------- | ---------------------------------------- |
| pi-agent-core 运行时                | `@flue/runtime`                          |
| jiti extensions                     | `defineTool` + build registry            |
| `sessions/*.jsonl`                  | Flue SessionStore                        |
| `/sessions/:id/prompt` + WS pi 事件 | `/agents/:name/:id` + `@flue/sdk` stream |
| Plugin 隐藏 extension               | Package 统一导出能力                     |
| `agents/<id>/plugins.json` 启用列表 | `composition.json`                       |

## 相关链接

- Flue 文档：<https://flueframework.com/docs/guide/building-agents/>
- Flue 仓库：`/Users/kingen/code/flue`（monorepo 内参考实现）
- 过期文档：[`local-data-model.md`](./local-data-model.md)
