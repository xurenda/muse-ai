# 阶段 1：CLI Runtime 内核

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`71649a9`  
**预估周期**：~2 周

---

## 目标

搭建 CLI agent runtime **基础设施**：代码规范工具链、`MuseHarness` 骨架、本地 `~/.muse` 目录、JSONL Session 持久化、按 session 的 SSE 端点。

**本阶段不含**内置 tools（见 [阶段 4](./phase-4.md)）、Agent 组装（见 [阶段 2](./phase-2.md)）、真实 LLM 调用（见 [阶段 3](./phase-3.md)）。

---

## 任务清单

### 工具链

- [x] ESLint + Prettier + husky + lint-staged
- [x] Node engines `>= 22.19.0`

### Runtime 内核

- [x] `packages/core` 封装 `MuseHarness`（`getApiKey` 占位；`tools: []`）
- [x] `~/.muse` 目录初始化（config、sessions、agents/personas/skills/mcps 占位目录）
- [x] JSONL Session 存储（`MuseSessionStore` + pi `JsonlSessionRepo` + `registry.json`）
- [x] CLI：`POST /sessions`、`GET /sessions`、SSE `GET /sessions/:id/events`
- [x] `POST /chat` 路由骨架（202 入队 + 占位 SSE 事件）

---

## 实际产出

### 1. 根目录工具链

| 文件                | 说明                                                          |
| ------------------- | ------------------------------------------------------------- |
| `eslint.config.js`  | TS + React flat config，与 Prettier 联动                      |
| `.prettierrc.json`  | 格式化规则                                                    |
| `.husky/pre-commit` | 提交前 lint-staged                                            |
| `package.json`      | `lint` / `format` / `format:check`；`engines.node >= 22.19.0` |

### 2. `@muse-ai/core`

封装 pi `AgentHarness`，固定 `NodeExecutionEnv`；Session 持久化接 pi JSONL。

**主要文件：**

```
packages/core/src/
├── muse-harness.ts       # MuseHarness：subscribe → SSE 映射
├── get-api-key.ts        # placeholderGetApiKeyAndHeaders（阶段 3 接 Backend）
├── session-store.ts      # MuseSessionStore：create/list/get/touch
├── session-registry.ts   # ~/.muse/sessions/registry.json 读写
└── types.ts              # MuseHarnessOptions
```

**Session 双轨存储：**

| 层          | 路径                             | 内容                                     |
| ----------- | -------------------------------- | ---------------------------------------- |
| pi JSONL    | `~/.muse/sessions/<uuid>.jsonl`  | 对话消息树（pi 格式）                    |
| Muse 元数据 | `~/.muse/sessions/registry.json` | `agentId`、`name`、`cwd`、`updatedAt` 等 |

**测试：** `test/muse-harness.test.ts`（2 项）、`test/session-store.test.ts`（3 项）

### 3. `@muse-ai/cli`

Daemon 基于 **Hono**；`muse start` 启动 HTTP 服务。

**Daemon 结构：**

```
packages/cli/src/daemon/
├── server.ts         # 路由：health / agents / sessions / chat / SSE
├── deps.ts           # 组装 sessionStore、eventHub、chatService
├── event-hub.ts      # 按 sessionId 的内存 SSE 总线
└── chat-service.ts   # 阶段 1 占位：校验 session 后推送 stub 事件
```

**API（阶段 1）：**

| 方法 | 路径                   | 说明                                                   |
| ---- | ---------------------- | ------------------------------------------------------ |
| GET  | `/health`              | 健康检查                                               |
| GET  | `/agents`              | 占位 `{ agents: [] }`                                  |
| GET  | `/sessions`            | 返回 registry 中的 Session 列表                        |
| POST | `/sessions`            | 创建 Session（必填 `agentId`）→ 201                    |
| GET  | `/sessions/:id/events` | SSE 事件流（`text/event-stream`）                      |
| POST | `/chat`                | `{ sessionId, message, mode }` → 202，异步推送占位事件 |

**`POST /chat` 占位事件序列：** `agent_start` → `turn_start` → `text_delta`（`[阶段 1 占位] 已收到 …`）→ `turn_end` → `agent_end`

**`~/.muse` 初始化（`paths.ts`）：**

| 路径                                       | 说明                                |
| ------------------------------------------ | ----------------------------------- |
| `config.json`                              | `{ version: 1 }`，可选 `backendUrl` |
| `sessions/`                                | JSONL + registry                    |
| `agents/`、`personas/`、`skills/`、`mcps/` | 空目录占位（阶段 2 使用）           |

测试可通过 `MUSE_HOME` 指向临时目录。

**测试：** `test/paths.test.ts`（3 项）、`test/daemon/event-hub.test.ts`（1 项）、`test/daemon/server.test.ts`（5 项）

### 4. `@muse-ai/shared`（本阶段增量）

| 类型                 | 说明                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `chatRequestSchema`  | `sessionId`、`message`、`mode`（`prompt` \| `steer` \| `follow_up`） |
| `museSseEventSchema` | SSE 事件联合类型（`text_delta`、`tool_start` 等）                    |
| `DEFAULT_AGENT_ID`   | 占位 UUID，供测试与默认 agent 引用                                   |

---

## 验收

```bash
pnpm lint && pnpm format:check && pnpm test:run
# 27 tests passed

pnpm dev:cli   # 或 muse start

# 创建 Session
curl -s -X POST http://127.0.0.1:7421/sessions \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"00000000-0000-4000-8000-000000000001"}'

# 发起占位对话（daemon 运行中）
curl -s -X POST http://127.0.0.1:7421/chat \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<上一步 id>","message":"你好","mode":"prompt"}'
# → {"accepted":true}；SSE 端可收到占位 text_delta
```

---

## 未做 / 留到后续阶段

| 能力                             | 阶段 | 说明                                      |
| -------------------------------- | ---- | ----------------------------------------- |
| Agent 组装（Persona/Skills）     | 2    | `MuseAgentRegistry`、真实 `GET /agents`   |
| LLM 调用（Backend 代理）         | 3    | `getApiKey` + `POST /v1/chat/completions` |
| CLI 鉴权（device token）         | 3    | Bearer middleware                         |
| `muse chat` / curl 完整 SSE 收流 | 3    | 纯文本对话                                |
| 内置 Tools                       | 4    | read / bash 等                            |

---

## 下一阶段

见 [phase-2.md](./phase-2.md)：Persona + Skills 组装 Agent、`muse agent` 子命令、真实 `/agents` 与默认 agent 会话创建。
