# 阶段 5：Web 聊天 MVP

**状态**：✅ 已完成  
**完成日期**：2026-06-16  
**Commit**：`3c3e754`  
**预估周期**：~2–3 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

浏览器完整对话体验：Web 经 Backend 拿 device endpoint + token，**直连 CLI SSE**；Server 仅负责账号、Provider、设备目录。

**前置**：阶段 4 内置 Tools 完成，聊天页可展示真实 tool call。

---

## 子阶段拆分

| 子阶段  | 名称                | 交付物                                                                                    | 依赖                                       |
| ------- | ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| **5.1** | 基础壳层 + 认证设备 | UI 栈、i18n、登录、设备列表/配对、Web→CLI 鉴权链路                                        | Server **device credentials API**          |
| **5.2** | 聊天页核心          | SSE 客户端、流式 Markdown、**thinking_delta**、tool call 卡片、steer/followUp             | 5.1；**shared SSE 拆分 thinking**          |
| **5.3** | Agent 与设置        | Agent 选择/组装（Persona + Skills + **Tools**）、Provider 设置、**会话级** model/thinking | 5.1；CLI **agents / tools / settings API** |
| **5.4** | Session 列表与树    | Session 侧栏、树形展示、**fork 分叉**                                                     | 5.2；CLI **session tree + fork API**       |

---

## 任务清单

### 5.1 基础壳层 + 认证设备

- [x] Web UI 栈：Tailwind CSS + Radix UI 基元（见 AGENTS.md）
- [x] **i18n 脚手架**：`packages/shared/src/i18n/`（react-i18next + `zh` / `en` locale）；Web 文案走 `t('…')`
- [x] 路由布局（登录 / 聊天 / 设置）
- [x] 登录、注册（Backend JWT，localStorage）
- [x] 设备列表 + 在线状态（`GET /devices`）
- [x] 配对码生成 UI（`POST /devices/pair/init`）+ 引导 `muse pair`
- [x] **Server**：`GET /devices/:id/credentials` → `{ endpoint, accessToken }`（user JWT）
- [x] CLI HTTP 客户端封装（Bearer device token + health check）

### 5.2 聊天页核心

- [x] **shared + core**：SSE 新增 `thinking_delta`，`mapHarnessEventToSse` 不再合并进 `text_delta`
- [x] 选中设备后建立 CLI 连接（health check）
- [x] Session 创建 + SSE 订阅（`POST /sessions`、`GET /sessions/:id/events`）
- [x] `POST /chat` 发消息；`mode`: prompt / steer / follow_up
- [x] 流式 Markdown 渲染（assistant 正文）
- [x] thinking 折叠/展开区块（消费 `thinking_delta`）
- [x] tool call 卡片（`tool_start` / `tool_end`，含 args/result）
- [x] 基础错误态（CLI 不可达、SSE/发送失败、SSE error 事件）
- [x] `muse chat --show-thinking` 将 thinking 输出到 stderr

### 5.3 Agent 与设置

- [x] Agent 列表（`GET /agents`）与会话绑定
- [x] **CLI**：`GET /personas`、`GET /skills`、`GET /tools`（可用内置 tool 名称列表）
- [x] **CLI**：`POST /agents` — Persona + Skills + **activeToolNames**（勾选 Tools，与 Skills 并列）
- [x] 组装 UI：选 Persona、勾选 Skills、勾选 Tools → 创建 Agent
- [x] Provider 设置页（Backend CRUD，已有 API）
- [x] **会话级** model / thinking level：`PATCH /sessions/:id/settings`（Harness `setModel` / `setThinkingLevel`，写入 session tree）

### 5.4 Session 列表与树

- [x] Session 列表侧栏（`GET /sessions`）
- [x] **CLI**：`GET /sessions/:id/tree`（pi `Session.getEntries()` 映射）
- [x] 树形 UI（message / branch_summary / label 等）
- [x] 点击节点加载该路径消息历史
- [x] **CLI**：`POST /sessions/:id/fork`（pi `Session.fork`）；Web 从任意节点分叉并切换 active leaf

---

## 设计决策

| 项             | 决策                                      | 说明                                                        |
| -------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Web→CLI token  | `GET /devices/:id/credentials`            | user JWT 鉴权；列表接口不暴露 token                         |
| Device token   | 复用配对签发的 device accessToken         | AES-GCM 加密存 DB；**已配对旧设备需重新 `muse pair`**       |
| Server CORS    | `hono/cors` + `MUSE_CORS_ORIGINS`         | 默认含 Web dev origin（5173）                               |
| UI 栈          | Tailwind v4 + Radix + CVA；React Router   | 与 AGENTS.md 一致                                           |
| i18n           | **本阶段搭脚手架**                        | `shared/i18n` + Web `useTranslation`；locale：`zh`、`en`    |
| thinking SSE   | **拆分 `thinking_delta`**                 | Web 分区展示；`muse chat` 默认仍只打正文                    |
| SSE 订阅       | fetch 流 + Authorization                  | 浏览器 EventSource 不支持 Bearer；断线自动重连              |
| EventHub       | 无订阅者时缓冲 + 回放                     | 避免 Web 尚未连上 SSE 就丢事件                              |
| REST chat mode | steer/follow_up 回落 prompt               | 每 HTTP 请求新建 Harness（idle）；steer 仅 streaming 时可选 |
| 模型/thinking  | **会话级** `PATCH /sessions/:id/settings` | 持久化到 pi session tree                                    |
| Agent 组装     | Persona + Skills + **Tools 勾选**         | `activeToolNames` 与 `skillIds` 同为创建时多选              |
| Session 树     | fork + navigate                           | `fork` 新 session；`navigate` 同 session 切换 leaf          |
| 局域网         | CLI `MUSE_CORS_ORIGINS` + 心跳 endpoint   | Web 直连 CLI，不经 Server 转发 SSE                          |

---

## 实际产出

### 1. `@muse-ai/shared`

| 模块                         | 变更                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `types/sse-events.ts`        | 新增 `thinking_delta` 事件类型                                    |
| `types/agent-api.ts`         | `createAgentRequestSchema`、`sessionSettingsPatch/Response`       |
| `types/session-tree.ts`      | 树节点、分支消息、fork/navigate 请求与响应 schema                 |
| `constants/builtin-tools.ts` | 内置 tool 描述符列表                                              |
| `constants/api-paths.ts`     | `sessionTreePath`、`sessionNavigatePath`、`sessionForkPath`       |
| `i18n/locales/{zh,en}/`      | `common`、`auth`、`device`、`chat`、`agents`、`settings` 命名空间 |

### 2. `@muse-ai/core`

| 模块                                  | 变更                                                             |
| ------------------------------------- | ---------------------------------------------------------------- |
| `harness-events.ts`                   | `thinking_delta` 独立映射（不再合并进 `text_delta`）             |
| `model-ref.ts` / `session-runtime.ts` | 解析 session tree 中的 model/thinking 覆盖                       |
| `harness-factory.ts`                  | `buildHarnessOptionsForSession`                                  |
| `muse-harness.ts`                     | `setModel` / `setThinkingLevel` / getters                        |
| `agent-registry.ts`                   | `listPersonas`、`listSkills`、`createAgent(activeToolNames)`     |
| `session-tree.ts`                     | pi `SessionTreeEntry` → API 节点；`buildBranchFromSession`       |
| `session-store.ts`                    | `getTree`、`navigate`（moveTo）、`fork`（JsonlSessionRepo.fork） |

### 3. `@muse-ai/server`

| 模块                         | 变更                                           |
| ---------------------------- | ---------------------------------------------- |
| `routes/auth-devices.ts`     | `GET /devices/:id/credentials`                 |
| `services/device-service.ts` | endpoint + `access_token_encrypted`（AES-GCM） |
| `app.ts`                     | CORS middleware（`MUSE_CORS_ORIGINS`）         |

### 4. `@muse-ai/cli`

**Daemon 新/改路由：**

| 方法      | 路径                           | 说明                               |
| --------- | ------------------------------ | ---------------------------------- |
| GET       | `/agents`                      | Agent 列表                         |
| POST      | `/agents`                      | 创建 Agent（含 `activeToolNames`） |
| GET       | `/personas` `/skills` `/tools` | 组装资产                           |
| GET/PATCH | `/sessions/:id/settings`       | 会话级 agent/model/thinking        |
| GET       | `/sessions/:id/tree`           | Session 树 + 当前分支消息          |
| POST      | `/sessions/:id/navigate`       | 切换 active leaf                   |
| POST      | `/sessions/:id/fork`           | 从节点 fork 新 session             |

**关键模块：**

| 文件                          | 职责                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `session-settings-service.ts` | 读写 session 设置（Harness + session tree）                  |
| `chat-service.ts`             | `buildHarnessOptionsForSession`；steer/follow_up 回落 prompt |
| `event-hub.ts`                | 无订阅者缓冲；订阅后回放                                     |
| `server.ts`                   | 上述路由 + CORS（含 PATCH）                                  |

**命令：** `muse chat --show-thinking` — thinking 输出 stderr

### 5. `@muse-ai/web`

**页面：** `/login`、`/register`、`/devices`、`/chat`、`/agents`、`/settings/providers`

**聊天页布局：** Session 列表侧栏 | 主聊天区（SessionBar + 消息 + 输入）| Session 树面板

| 模块                        | 说明                                         |
| --------------------------- | -------------------------------------------- |
| `api/cli-client.ts`         | Session/SSE/chat/agents/settings/tree/fork   |
| `api/backend-client.ts`     | 登录、设备、credentials、Provider CRUD       |
| `hooks/use-chat-session.ts` | SSE 重连、树刷新、navigate/fork、会话切换    |
| `lib/chat-reducer.ts`       | SSE → 消息列表（含 thinking/tool）           |
| `components/chat/*`         | Markdown、thinking 折叠、tool 卡片、侧栏、树 |

### 6. 数据流（本阶段打通）

```
Web 登录 → Backend JWT
        ↓
选设备 → GET /devices/:id/credentials → { endpoint, accessToken }
        ↓
Web ──SSE/HTTP──► CLI daemon（Bearer device token）
        ↓
POST /chat → MuseHarness → Backend LLM 代理 → Provider
        ↓
SSE：thinking_delta / text_delta / tool_start / tool_end / agent_end
        ↓
Web 聊天 UI + Session 树（GET tree / POST navigate / POST fork）
```

---

## 验收

```bash
pnpm test:run
# 96 tests passed（阶段 5 前 78 → 后 96）

# 前置
cd packages/server && docker compose up -d
pnpm dev:server    # 改 CORS 后需重启
pnpm dev:cli       # muse pair <配对码>
pnpm dev:web

# Web 流程
# 1. 注册/登录 → 设备页生成配对码 → CLI muse pair
# 2. 选在线设备 → /chat
# 3. Prompt 模式发消息 → Network 可见 events（text/event-stream）与 text_delta
# 4. 编程助手对话 → tool call 卡片
# 5. /agents 组装 Agent（Persona + Skills + Tools）
# 6. /settings/providers 配置默认 Provider
# 7. 聊天顶栏切换 Agent / model / thinking
# 8. 左侧 Session 列表切换；右侧树点击 navigate、Fork 新 session
```

**2026-06-16 自动化验收：** `pnpm test:run` — **96 passed**（core session-tree 4、cli server 14、web chat-reducer 2 等）。

**联调注意：**

- 须 **Prompt** 模式发首条消息（Agent 未 streaming 时 Steer/Follow-up 在 UI 已禁用）
- 已配对设备若 credentials 失败，需重新 `muse pair`（token 加密存储变更）
- CLI / Server 改 CORS 或路由后需重启对应进程

---

## 未做 / 留到后续阶段

| 能力                           | 阶段  | 说明                                                     |
| ------------------------------ | ----- | -------------------------------------------------------- |
| steer/follow_up 跨 HTTP 真打断 | 7+    | REST 每轮新建 Harness；streaming 内 steer 待常驻 runtime |
| Session compact                | 7     | Harness `compact()`                                      |
| token 用量统计                 | 7     | Web 展示                                                 |
| 远程 CLI HTTPS 指南            | 7     | 文档                                                     |
| Web UI 视觉改版                | 6     | 见 [phase-6.md](./phase-6.md)                            |
| 附件 / 多模态                  | v0.2+ | UI 占位可留                                              |
| Backend 转发 SSE               | —     | 架构刻意不做                                             |

---

## 下一阶段

[阶段 6：Web UI 改版](./phase-6.md) — 对齐参考仓库 UI；完成后进入 [阶段 7：打磨与自用](./phase-7.md)。
