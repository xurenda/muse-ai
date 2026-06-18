# 阶段 7：打磨与自用

**状态**：🔲 进行中  
**预估周期**：~1 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。  
> 若单个子阶段工作量过大，可再拆 **7.x.y**（例如 7.1.1 仅做 SSE 重连 UI）。

---

## 目标

连续自用 3–5 天无明显 blocker，**v0.1 MVP 交付**。

**前置**：阶段 6 Web UI 改版完成，日常界面可接受；本阶段聚焦**稳定性**、**长对话**、**可观测性**、**Steer/Follow-up 真接入**与**文档收尾**。

**不做**：Backend 转发 SSE、通用 MCP、附件/工作区、Trace 调试右栏、Models 独立设置页（均留 v0.2+）。

---

## 现状与差距（阶段 6 交付后）

| 维度              | 阶段 6 基线                                                    | 7.1 完成后（当前）                                                                  | 7.2+ 仍待办 |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------- |
| SSE 断线          | 底层 1s 重连；`ready` 后无 UI、无 resync                       | 连接态枚举 + 重连 resync + toast；底栏「重连中」；SSE 重连 **3s 后** 自动展开面板   | —           |
| 错误提示          | 聊天顶栏 destructive 条；无重试；Header 设备按钮               | **AppLayout 底栏**设备状态条 + 展开面板；i18n 错误码；重试；health 与会话态分离     | —           |
| Steer / Follow-up | Composer UI 已有；`ChatService` 每轮新建 Harness 且恒 `prompt` | **7.2** turn-scoped Harness + mode 分发；steer/follow_up 即时注入；idle 回落 prompt | —           |
| Session compact   | 未实现                                                         | **7.3** 手动 + overflow 自动 compact；Web 按钮与 SSE 状态                           | —           |
| Token 统计        | 无展示                                                         | **7.4** SSE turn_end usage + settings 累计 + Web footer                             | —           |
| 远程 CLI / 文档   | 索引偏旧                                                       | **7.5** 开发指南、CLI env 示例、README / docs 索引                                  | —           |

---

## 已确认决策（2026-06-17）

| 项                    | 决策                                                                | 说明                                                                                   |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Steer / Follow-up** | **阶段 7 实现**                                                     | 不做「禁用 UI」；CLI 侧 turn 进行中持有 Harness（见 7.2）                              |
| **Session compact**   | **手动 + 自动都要**                                                 | 手动：聊天页/Session 栏入口；自动：context 溢出时触发（对齐 pi compaction 语义）       |
| **Token 统计**        | CLI 侧会话累计；Web 展示；Backend 持久化 **v0.1 可选**              | 优先打通 SSE → CLI 内存/Session meta → Web UI                                          |
| **SSE 重连**          | 保留 fetch 流 + 客户端重连；重连成功后 **拉 tree 覆盖 messages**    | 不引入 Backend SSE 中继；丢失 delta 以 branch 为准                                     |
| **远程 CLI**          | v0.1 **文档 + 配置说明**；Tunnel 一键脚本 **可选**                  | 必写：HTTPS、CORS、`MUSE_CLI_HOST`、配对 endpoint 勿写错内网地址                       |
| **实施顺序**          | **7.1 → 7.2 → 7.3**；**7.4 与 7.5 可并行**（7.2/7.3 依赖 CLI 改造） | 7.1 优先（自用 blocker）；Steer 与 Compact 均改 ChatService，7.2 先于 7.3 或同 PR 内序 |

---

## 子阶段拆分

| 子阶段  | 名称                     | 交付物                                                                                          | 依赖         | 状态      |
| ------- | ------------------------ | ----------------------------------------------------------------------------------------------- | ------------ | --------- |
| **7.1** | 断线重连与错误体验       | SSE 连接态、resync、错误 i18n、重试、health 探测、**AppLayout 底栏设备状态**                    | 无           | ✅ 已完成 |
| **7.2** | Steer / Follow-up 真接入 | CLI turn-scoped Harness；`POST /chat` 按 `mode` 分发 prompt/steer/follow_up                     | 7.1（建议）  | ✅ 已完成 |
| **7.3** | Session compact          | `MuseHarness.compact()`、`POST /sessions/:id/compact`、溢出自动 compact、Web 手动按钮与状态提示 | 7.2          | ✅ 已完成 |
| **7.4** | Token 用量统计           | SSE `turn_end` 携带 usage；CLI 累计；Web Session 栏或消息区展示                                 | 无（可并行） | ✅ 已完成 |
| **7.5** | 远程 CLI 与开发文档      | 远程 endpoint/HTTPS 指南、CLI env 示例、README/`docs` 索引更新、开发指南                        | 无（可并行） | ✅ 已完成 |

建议实施顺序：**7.1 → 7.2 → 7.3**；**7.4、7.5 与 7.2 完成后并行**。

---

## 任务清单

### 7.1 断线重连与错误体验 ✅

- [x] **SSE 连接态**：`connecting` / `connected` / `reconnecting` / `disconnected`；**AppLayout 底栏**展示聚合状态；重连成功 toast；SSE 重连持续 **3s** 后自动展开面板
- [x] **重连 resync**：SSE 重连成功后 `getSessionTree` + `mergeBranchWithEphemeralTail`，修复断线 delta 丢失与 streaming 卡死
- [x] **初始/会话连接失败**：底栏面板内 destructive 文案 + **「重试」**（`checkCliHealth` + `connectSession`）；CLI 恢复或 health 已通过时会话仍 error 时 **自动重试**
- [x] **错误 i18n**：`connection-errors.ts` 规范 `cli_unreachable` / `sse_subscribe_failed` / `unknown`；文案走 `chat` 命名空间
- [x] **设备 health**：`DeviceHealthProvider` 订阅 CLI `GET /device/events`（设备 SSE）；指数退避重连 + 倒计时 +「立即重连」；**不可达时禁发**（`canSend`）
- [x] **设备状态 UI**：底栏 + 展开面板（endpoint / 设备 SSE / Session SSE / 错误与重试 / 最近活动）；设备 SSE 重连时展示倒计时与「立即重连」
- [x] **未连设备引导**：`/chat` 无设备时 `no-device-guide` 步骤化 CTA
- [x] **侧栏 Session 列表**：`session-list-store` 的 `refreshNonce` / `requestRefresh`；去除 chat hook 内重复 `listCliSessions`

### 7.2 Steer / Follow-up 真接入 ✅

- [x] **turn-scoped Harness runtime**（CLI `ChatService`）：仅在 prompt turn 进行中持有 Harness；turn 结束即 evict；下一轮 prompt 重建（上下文在 pi Session 文件）
- [x] **mode 分发**：`prompt` → `harness.prompt`；`steer` → `harness.steer`；`follow_up` → `harness.followUp`；非法组合（如 idle 时 steer）返回 4xx 或回落 prompt 并记录
- [x] **并发与排队**：与现有 `sessionChains` 串行策略对齐；steer 仅在 Agent streaming 时接受；follow_up 语义与 pi 一致
- [x] **SSE 生命周期**：Harness subscribe 与 Session SSE 订阅解耦；Session 切换/销毁时 unsubscribe 并释放 runtime
- [x] **Web**：Composer 现有 Enter / Shift+Enter 行为不变；必要时补充 steer 失败时的用户可见错误
- [x] **测试**：CLI `server.test` / `ChatService` 覆盖三 mode；至少 steer 在 mock streaming 下被调用

### 7.3 Session compact（手动 + 自动）

- [x] **core**：`MuseHarness` 暴露 `compact()`（转发 pi Session / Harness API）；映射 compaction 相关 Harness 事件到 SSE（若 pi 有 `compaction_start` / `compaction_end`，按需纳入 `shared` 协议）
- [x] **CLI API**：`POST /sessions/:id/compact`（可选 body：`customInstructions`）；compact 进行中拒绝并发 chat 或排队（与 pi 行为对齐）
- [x] **自动触发**：LLM context 溢出（或 pi 等价错误/事件）时自动 enqueue compact，完成后可选自动重试原 turn 或仅提示用户
- [x] **Web 手动入口**：Session 栏或聊天顶栏「压缩上下文」按钮；compact 中 disabled + loading；完成后刷新 tree/messages
- [x] **Session 树**：compaction 节点 v0.1 可仍不在树 UI 展示详情，但 compact 后 branch 消息应变短；必要时 status toast「已压缩 N 次」
- [x] **测试**：compact API 集成测试；自动触发可用 mock 溢出错误

### 7.4 Token 用量统计 ✅

- [x] **shared**：扩展 SSE `turn_end` 携带 input/output/total（及 pi cost 字段）
- [x] **core**：`mapHarnessEventToSse` 转发 turn 级 usage；`readSessionTokenUsage` 汇总 JSONL
- [x] **CLI**：Session 级累计（自 pi Session JSONL 读取，重启可恢复）；`GET /sessions/:id/settings` 返回 `tokenUsage`
- [x] **Web**：ChatSessionBar footer 展示当前 Session token 累计；`turn_end` 实时累加，`agent_end` / compact 后 resync
- [x] **Backend 持久化**：v0.1 **不做**（留 v0.2+）

### 7.5 远程 CLI 与开发文档 ✅

- [x] `**docs/development-guide.md`\*\*（或等价）： monorepo 结构、三进程联调、常见排错、改 shared 后 rebuild
- [x] **远程 CLI 专节**：`MUSE_CLI_HOST` / `MUSE_CLI_PORT` / `MUSE_CORS_ORIGINS`；配对时 **endpoint 必须是浏览器可达地址**（非 `127.0.0.1` 代填）；HTTPS Web + HTTPS CLI；Tailscale / 反向代理 / CF Tunnel 示例（择一写清即可）
- [x] `**packages/cli/.env.example`\*\*（或 README 表格）列出 CLI 环境变量
- [x] **根 `README.md`**：链到开发指南；远程场景摘要
- [x] `**docs/README.md**`：索引更新为 phase-0 ~ **phase-7**；当前阶段指向 `current-phase.md`
- [x] **阶段完成记录（增补）**：Runtime/Registry 两通道 + 设备 SSE 已写入本文 [完成记录](#完成记录)（2026-06-18）；**v0.1 整体关闭**时补 Commit 与 B/C 勾选

---

## 设计决策（实现）

| 项                | 决策                                      | 说明                                                                                                                                            |
| ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| SSE 传输          | Web 直连 CLI，fetch 流 + 客户端重连       | 与 architecture 一致；重连后以 **tree branch** 为真相源 resync                                                                                  |
| 设备状态展示      | **AppLayout 全宽底栏**（含侧栏列）        | 替代 Header 设备按钮与聊天顶栏连接条；点击展开详情面板                                                                                          |
| 聚合状态          | 设备 SSE 优先，再区分会话/SSE             | `deviceSseStatus === reconnecting` 优先于 `unreachable`；`session_disconnected` 表示设备已连但 Session SSE/会话失败（见 [完成记录](#完成记录)） |
| 面板自动展开      | 失败立即展开；SSE 重连 3s 后展开          | 恢复 `ready` 后 2s 自动收起（仅自动展开时；用户手动展开不强制收）                                                                               |
| Harness 生命周期  | **turn 结束即释放**；Session 删除时 evict | steer 仅需 turn 进行中同一实例；对齐 pi 语义，HTTP daemon 不跨 idle 常驻（pi REPL 因单进程复用 Agent）                                          |
| Compact 触发      | 手动 API + 自动 overflow                  | 自动失败时须 SSE `error` + 可选 UI 提示；手动可带 customInstructions                                                                            |
| Token             | turn_end 携带当轮 usage，Session 累加     | 不做账号级账单；仅自用观测                                                                                                                      |
| 远程 endpoint     | 用户/运维配置公网或 tunnel URL            | `buildCliEndpoint` 行为在文档中明确；必要时支持 pair 时覆盖 endpoint                                                                            |
| follow_up 跨 HTTP | 与 steer 同批交付                         | 依赖 7.2 turn 进行中 runtime                                                                                                                    |

---

## 实际产出

### 7.1 断线重连与错误体验（2026-06-17）✅

#### 1. `packages/shared` — i18n

| 命名空间 | 新增/变更                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat`   | `sseReconnecting`、`sseReconnected`、`cliHealthRestored`；连接/发送错误（`errorCliUnreachable` 等）；`noDevice.*` 三步引导；`retryConnection` / `retryConnecting` |
| `layout` | `statusBar.*`：底栏聚合态（`ready` / `unreachable` / `sessionDisconnected` / `reconnecting` 等）；`statusBar.panel.*` 面板字段；`statusBar.activity.*` 最近活动   |

#### 2. `packages/web` — API 与协议层

| 文件                             | 说明                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `api/cli-client.ts`              | `SseSubscriptionCallbacks` 增加 `onConnected` / `onReconnecting` / `onReconnected`；底层重连逻辑不变（1s 间隔）       |
| `lib/connection-errors.ts`       | `parseConnectionError`、`formatConnectionErrorMessage`；错误码 `cli_unreachable` / `sse_subscribe_failed` / `unknown` |
| `lib/device-aggregate-status.ts` | `resolveDeviceAggregateStatus`：合并 health + chat + SSE；`isDeviceStatusFailure`                                     |

#### 3. `packages/web` — Hooks 与全局状态

| 文件                            | 说明                                                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-chat-session.ts`     | 导出 `sseStatus`、`canSend`、`retryConnection`；SSE 回调更新连接态；重连/恢复后 `refreshTree` resync + toast；**health 不可达禁发**；CLI 恢复或 health 已通过时会话 error **自动重试** |
| `hooks/use-device-health.tsx`   | `DeviceHealthProvider`：订阅 CLI `**/device/events`\*\*（见 [完成记录](#完成记录) 增补）；`visibilitychange` 时 `retryNow`                                                             |
| `routes/guards.tsx`             | Protected 路由包裹 `DeviceHealthProvider`                                                                                                                                              |
| `stores/session-list-store.ts`  | `refreshNonce` / `requestRefresh`；SSE `session_meta_updated` 仍走 `patchSession`                                                                                                      |
| `stores/device-status-store.ts` | 设备信息、health、chat/SSE 态、面板开闭、最近活动、重试 handler 注册                                                                                                                   |

#### 4. `packages/web` — UI 与布局

| 文件                                              | 说明                                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `components/layout/device-status-bar.tsx`         | AppLayout **最底一行**状态条 + 展开面板（endpoint / 健康检查 / SSE / 错误与重试 / 最近活动） |
| `components/layout/device-status-controller.tsx`  | 同步 auth + health 到 store；聚合态变迁时自动展开/收起面板与 activity 日志                   |
| `components/layout/chat-device-status-bridge.tsx` | 聊天路由内将 `useChatSession` 态写入 device store，注册 `retryConnection`                    |
| `components/chat/no-device-guide.tsx`             | 无设备时三步 CTA                                                                             |
| `layouts/app-layout.tsx`                          | 挂载 `DeviceStatusController`、`DeviceStatusBar`；聊天区挂载 `ChatDeviceStatusBridge`        |

**删除：** `chat-connection-banner.tsx`、`chat-connection-error-bar.tsx`；`main-header.tsx` 移除 Header 设备按钮。

#### 5. `packages/web` — 测试

| 文件                                       | 覆盖                                            |
| ------------------------------------------ | ----------------------------------------------- |
| `test/api/cli-client-sse.test.ts`          | SSE 断线重连回调                                |
| `test/lib/connection-errors.test.ts`       | 错误码解析与 i18n key                           |
| `test/lib/device-aggregate-status.test.ts` | health 通过 + 会话失败 → `session_disconnected` |

#### 6. 7.1 行为摘要（联调预期）

```text
底栏状态（聚合）：
  no_device → 未选设备
  checking / connecting → 检测中 / 连接中
  unreachable → CLI health 失败（禁发消息）
  session_disconnected → health 通过但 SSE/会话失败（面板可重试）
  reconnecting → SSE 重连中（3s 后面板自动展开）
  ready → 就绪

自动行为：
  CLI 从不可达恢复 → toast「CLI 已恢复」+ 若在聊天且会话 error 则自动 retry
  health 已通过、会话仍 error → 约 800ms 后自动 retry 一次
  从失败态恢复 ready → 2s 后自动收起面板（非用户手动展开时）
```

**2026-06-17 自动化验收（7.1 相关）：**

- `pnpm --filter @muse-ai/shared build` — 通过
- `pnpm --filter @muse-ai/web test:run` — **27 passed**（含 `cli-client-sse`、`connection-errors`、`device-aggregate-status`）

### 7.2 Steer / Follow-up 真接入（2026-06-17）✅

#### 1. `packages/cli` — ChatService turn-scoped runtime

| 文件                         | 说明                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/daemon/chat-service.ts` | `activeTurns` 仅在 prompt turn 进行中持有 Harness；`steer`/`follow_up` 即时注入当前 turn；`**dispatchTurn` finally 即 evict\*\*；下一轮 prompt 调用 `createTurnRuntime` 重建 |
| `src/daemon/server.ts`       | `DELETE /sessions/:id` 后调用 `chatService.evictRuntime` 释放进行中的 turn                                                                                                   |

**行为摘要：**

- `prompt`：每轮 `createTurnRuntime` → `harness.prompt()` → finally `evictRuntime`；Harness 事件经 turn 内 subscribe 广播至 `SessionEventHub`（与 Web SSE 订阅解耦）
- `steer` / `follow_up`：仅当 `activeTurns` 存在时调用；**idle 时回落为 prompt** 并 `console.warn`
- `isSessionBusy`：`sessionChains` 或 `activeTurns` 非空
- 与 pi coding-agent 差异：pi 单进程 REPL 跨 turn 复用 `Agent`；MuseAI HTTP daemon 仅在 turn 进行中借还 Harness，重建成本可接受（上下文在 pi Session）

#### 2. `packages/web` — 发送错误解析

| 文件                | 说明                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `api/cli-client.ts` | `postChat` 非 202 时解析 JSON `error`/`message`，便于展示 CLI 拒绝原因 |

Composer Enter / Shift+Enter 逻辑未改；steer 失败仍经 SSE `error` 事件 + 顶栏 `sendError`（HTTP 层）双通道可见。

#### 3. 测试

| 文件                               | 覆盖                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `test/daemon/chat-service.test.ts` | `prompt` / streaming 下 `steer` / streaming 下 `follow_up` / idle steer 回落 prompt / turn 结束释放 / 强制 evict |

**2026-06-17 自动化验收（7.2 相关）：**

- `pnpm --filter @muse-ai/cli build` — 通过
- `npx vitest run packages/cli/test/daemon/` — **28 passed**（含新增 `chat-service.test.ts` 6 项）

### 7.3 Session compact（2026-06-17）✅

#### 1. `packages/shared` — 协议与 i18n

| 项                         | 说明                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `types/sse-events.ts`      | 新增 `compaction_start` / `compaction_end`（含 `reason`、`success`、`tokensBefore`、`compactionCount`） |
| `types/session-compact.ts` | `sessionCompactRequestSchema`（可选 `customInstructions`）                                              |
| `constants/api-paths.ts`   | `SESSION_COMPACT`、`sessionCompactPath()`                                                               |
| `i18n/chat`                | `compactContext`、`compactingContext`、`compactSuccess`、`compactFailed`、`compactOverflowHint`         |

#### 2. `packages/core`

| 文件                  | 说明                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `muse-harness.ts`     | 暴露 `compact()`，转发 `AgentHarness.compact`                    |
| `context-overflow.ts` | `isAssistantContextOverflow()`（封装 pi-ai `isContextOverflow`） |

#### 3. `packages/cli` — Compact 与 overflow 自动恢复

| 文件                     | 说明                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daemon/chat-service.ts` | `enqueueCompact` / `runCompact`；`compactingSessions` + `sessionChains` 串行；overflow 时自动 compact 并提示用户重发（避免 duplicate user message） |
| `daemon/server.ts`       | `POST /sessions/:id/compact` → 202；busy → 409                                                                                                      |

#### 4. `packages/web`

| 文件                                   | 说明                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `api/cli-client.ts`                    | `compactSession()`                                                               |
| `hooks/use-chat-session.ts`            | `compacting` 态；SSE compaction 事件 → toast + `refreshTree`；`compactContext()` |
| `components/chat/chat-session-bar.tsx` | 「压缩上下文」按钮                                                               |
| `pages/chat-page.tsx`                  | 传递 compact 相关 props                                                          |

#### 5. 测试

| 文件                                      | 覆盖                                             |
| ----------------------------------------- | ------------------------------------------------ |
| `cli/test/daemon/chat-service.test.ts`    | 手动 compact / busy 拒绝 / overflow 自动 compact |
| `cli/test/daemon/server.test.ts`          | compact API 202 / busy 409                       |
| `shared/test/constants/api-paths.test.ts` | compaction SSE schema                            |

**2026-06-17 自动化验收（7.3 相关）：**

- `pnpm --filter @muse-ai/shared build` — 通过
- `pnpm --filter @muse-ai/core build` — 通过
- `pnpm --filter @muse-ai/cli build` — 通过
- `npx vitest run packages/cli/test/daemon/` — **33 passed**（含 compact 5 项）
- `pnpm --filter @muse-ai/web typecheck` — 通过

### 7.4 Token 用量统计（2026-06-17）✅

#### 1. `packages/shared` — 协议与 i18n

| 项                             | 说明                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `types/session-token-usage.ts` | `turnTokenUsageSchema`、`sessionTokenUsageSchema`、`addTurnToSessionUsage`、`EMPTY_SESSION_TOKEN_USAGE` |
| `types/sse-events.ts`          | `turn_end` 可选 `usage` 字段                                                                            |
| `types/agent-api.ts`           | `sessionSettingsResponseSchema` 增加 `tokenUsage`                                                       |
| `i18n/chat`                    | `sessionTokenUsage`、`sessionTokenUsageWithCost`（↑input ↓output · total [· $cost]）                    |

#### 2. `packages/core`

| 文件                     | 说明                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `session-token-usage.ts` | `normalizeTurnTokenUsage`、`extractTurnUsageFromMessage`、`aggregateSessionTokenUsage`、`readSessionTokenUsage` |
| `harness-events.ts`      | `turn_end` 从 assistant message 提取 usage 并映射到 SSE                                                         |

**累计策略：** 遍历 pi Session JSONL `getEntries()` 中全部 `assistant` 消息求和（对齐 pi coding-agent footer），**不另写 registry 旁路**；CLI 重启后仍可从 JSONL 恢复。

#### 3. `packages/cli`

| 文件                                 | 说明                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| `daemon/session-settings-service.ts` | `get()` 调用 `readSessionTokenUsage(piSession)`，响应含 `tokenUsage` |

#### 4. `packages/web`

| 文件                                      | 说明                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `lib/format-token-count.ts`               | 紧凑格式化（42 / 1.5k / 12k / 1.5M）                                                            |
| `components/chat/session-token-usage.tsx` | footer 用量行；有 cost 时展示 `$0.012` 格式                                                     |
| `components/chat/chat-session-bar.tsx`    | Session 栏下方挂载 `SessionTokenUsageDisplay`                                                   |
| `hooks/use-chat-session.ts`               | SSE `turn_end` → `addTurnToSessionUsage` 实时更新；`agent_end` / compact 后 `loadSettings` 校准 |

**未做（按计划）：** 单轮 turn 轻量 toast 增量提示；Backend 账号级持久化。

#### 5. 测试

| 文件                                      | 覆盖                                  |
| ----------------------------------------- | ------------------------------------- |
| `core/test/session-token-usage.test.ts`   | 规范化 / 单 message 提取 / JSONL 汇总 |
| `core/test/harness-events.test.ts`        | 既有 text/thinking/tool 映射（不变）  |
| `shared/test/constants/api-paths.test.ts` | `turn_end` + usage schema             |
| `web/test/lib/format-token-count.test.ts` | token 数格式化                        |

#### 6. 7.4 行为摘要（联调预期）

```text
初始进入会话：
  GET /sessions/:id/settings → tokenUsage 为 JSONL 历史 assistant 累计

每轮 LLM 响应：
  SSE turn_end（含当轮 usage）→ footer 实时 ↑/↓/total 增加
  SSE agent_end → 重新 GET settings，与 JSONL 汇总对齐

展示：
  ChatSessionBar 下方一行，如「↑1.2k ↓456 · 1.7k tokens」
  有 cost 时追加「· $0.012」
  total 为 0 时不显示
```

**2026-06-17 自动化验收（7.4 相关）：**

- `pnpm --filter @muse-ai/shared build` — 通过
- `pnpm --filter @muse-ai/core build` — 通过
- `pnpm --filter @muse-ai/cli build` — 通过
- `pnpm --filter @muse-ai/web typecheck` — 通过
- `npx vitest run`（7.4 相关子集）— **52 passed**（含 `session-token-usage` 4 项、`format-token-count` 1 项、`api-paths` turn_end schema 1 项；`cli/test/daemon/` 33 项回归通过）

_（7.5 实施中按包补充。）_

### 7.5 远程 CLI 与开发文档（2026-06-18）✅

#### 1. 新增文档

| 文件                        | 说明                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/development-guide.md` | Monorepo 结构、三进程联调、首次配对、**修改 shared 后 rebuild**、CLI 环境变量、`buildCliEndpoint` 行为、**LAN 远程 CLI 步骤**、HTTPS 限制、Tailscale Serve 示例、常见排错表 |
| `packages/cli/.env.example` | `MUSE_CLI_HOST` / `MUSE_CLI_PORT` / `MUSE_CORS_ORIGINS` / `MUSE_HOME`；说明 CLI 不自动 load dotenv                                                                          |

#### 2. 索引更新

| 文件             | 变更                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `README.md`      | 链到开发指南；配置节增加 CLI `.env.example`；**远程 CLI 摘要**一节 |
| `docs/README.md` | 索引增加开发指南；v0.1 阶段范围更新为 phase-0 ~ **phase-7**        |

#### 3. 远程 CLI 文档要点

```text
endpoint 来源：muse pair + 心跳 → buildCliEndpoint(MUSE_CLI_HOST, MUSE_CLI_PORT)
  - MUSE_CLI_HOST=0.0.0.0 时 endpoint 写成 127.0.0.1（勿用于远程）
  - v0.1 endpoint 协议固定 http://；HTTPS 远程 endpoint 覆盖留 v0.2+

LAN 验收（推荐）：
  CLI：MUSE_CLI_HOST=<本机 LAN IP> + MUSE_CORS_ORIGINS 含 Web origin
  Web：VITE_BACKEND_URL 指向可达 Server
  配对后设备页 endpoint 应为 LAN IP，非 127.0.0.1

HTTPS：Web 为 HTTPS 时浏览器拦截 http:// CLI；需 TLS 入口，v0.1 文档说明限制
Tailscale：serve 示例作可选参考，完整 tailnet HTTPS endpoint 待 v0.2
```

**2026-06-18 文档验收：**

- 按 `development-guide.md` 可从零启动三进程并联调
- LAN 场景检查清单与 env 示例与 `packages/cli/src/config.ts`、`buildCliEndpoint` 行为一致

_（阶段 7 全部子阶段完成后，在文首填完成日期与 Commit。）_

---

## 收尾 Checklist

> **当前进度**：7.1–7.5 代码与文档已交付；**自动化验收已通过**（2026-06-18）；阶段 7 **尚未关闭**——还差手动联调、连续自用与 Git/文档归档。

### A. 自动化验收 ✅

- [x] `pnpm --filter @muse-ai/shared build`
- [x] `pnpm test:run` — **45** 文件 / **174** 测试通过
- [x] `pnpm --filter @muse-ai/web typecheck`
- [x] `pnpm --filter @muse-ai/web build`（有 chunk >500kB 警告，非失败）

### B. 手动联调（三进程）

启动：`pnpm dev:server` + `pnpm dev:cli` + `pnpm dev:web`，浏览器 **[http://127.0.0.1:65434](http://127.0.0.1:65434)**，已配对设备 + Provider Key。

| 项  | 场景                                                        | 预期                                                                         | 状态 |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| 7.1 | 停 CLI                                                      | 底栏「重连中」或「不可达」、倒计时 +「立即重连」、面板展开、**禁发**         | ✅   |
| 7.1 | 启 CLI                                                      | 设备 SSE 恢复 →「就绪」；侧栏 Session 自动刷新；会话 error 时可自动/手动重试 | ✅   |
| 7.1 | streaming 中杀 CLI 再启                                     | 消息经 resync 与 branch 一致，**进行中 tool/streaming 应收尾**，不卡死       | ✅   |
| 7.2 | Agent 回复中 **Enter**                                      | steer 打断/改道生效                                                          | ⬜   |
| 7.2 | Agent 回复中 **Shift+Enter**                                | follow_up 排队生效                                                           | ⬜   |
| 7.2 | idle 时 Enter                                               | 正常 prompt，不误 steer                                                      | ⬜   |
| 7.3 | Session 栏「压缩上下文」                                    | compact 中 disabled；完成后消息变短 + toast                                  | ⬜   |
| 7.3 | 长对话 / 真实 overflow                                      | 自动 compact + 提示（或 SSE error）                                          | ⬜   |
| 7.4 | 多轮对话                                                    | ChatSessionBar footer token 累计随轮次增加                                   | ⬜   |
| 7.4 | 刷新页 / 重启 CLI                                           | footer 与 JSONL 汇总一致                                                     | ⬜   |
| 7.5 | 按 [development-guide.md](../development-guide.md) 从零启动 | 新 clone 可跟文档跑通三进程                                                  | ⬜   |
| 7.5 | LAN IP + CORS（可选）                                       | endpoint 为 LAN IP 非 `127.0.0.1`；Web 可聊天                                | ⬜   |

### C. 连续自用（阶段总目标）

- [ ] **连续 3–5 天**日常写代码 / 写文档 / 聊天，记录 blocker（若有则开 issue 或回改 7.x）
- [ ] 自用期间覆盖：断线恢复、steer、长对话 compact、token footer、设备切换
- [ ] 确认无「必须修才能用」的 P0 问题

### D. 发现 blocker 时

| 严重度       | 处理                                                        |
| ------------ | ----------------------------------------------------------- |
| P0（不能用） | 修代码 + 补测试 → 重新跑 **A** 与相关 **B** 项              |
| P1（难用）   | 记录到 phase-7「与计划偏差」或留 v0.2；不阻塞交付则文档注明 |
| 文档有误     | 改 `development-guide.md` / README，不重跑全量测试          |

### E. Git 与文档归档（阶段关闭时）

**顺序**（见 [current-phase.md](../current-phase.md)）：

1. [ ] 提交**阶段交付 commit**（含本阶段全部代码 + 测试 + 7.5 文档）
2. [ ] `git rev-parse --short HEAD` 记下 hash
3. [ ] 更新 `phase-7.md` 文首：**状态** ✅、**完成日期**、**Commit**
4. [ ] 更新 `phase-7.md` **验收** 节：粘贴 **A** 的真实命令输出摘要；**B/C** 勾选结果或一句结论
5. [ ] 更新 `phase-7.md` **完成记录**：验收摘要、与计划偏差（如有）
6. [ ] 勾选任务清单最后一项「阶段完成记录」（v0.1 各 phase 验收节按需抽查，不必重写 0–6）
7. [ ] **单独 commit 文档**（避免 amend 导致 hash 与文内 Commit 不一致）
8. [ ] 同步 `docs/v0.1/README.md`：阶段 7 → ✅ 已完成
9. [ ] 同步 `docs/current-phase.md`：**当前** → `v0.1 已交付` 或下一阶段；**下一步** 链到 roadmap v0.2
10. [ ] 更新 `docs/roadmap.md`：v0.1 状态为已交付（若尚未更新）

### F. v0.1 交付判定

全部满足方可称 **v0.1 MVP 交付**：

- [x] 7.1–7.5 子阶段任务清单完成
- [x] **A** 自动化验收通过
- [ ] **B** 手动联调关键路径通过（至少 7.1 + 7.2 + 7.3 + 7.4 同机；7.5 文档可走通）
- [ ] **C** 连续自用 3–5 天无 P0 blocker
- [ ] **E** 文档与 Git 归档完成

**关闭阶段 7 后**：进入 [v0.2](../roadmap.md#v02第二期) 规划（市场、附件、记忆 v1 等）。

---

## 验收

```bash
# 自动化
pnpm --filter @muse-ai/shared build
pnpm test:run
pnpm --filter @muse-ai/web typecheck
pnpm --filter @muse-ai/web build

# 手动（三进程联调）
# 7.1 ✅：停 CLI → 底栏「不可达」、面板展开、禁发；启 CLI → 「会话断开」或自动重连 → 「就绪」；
#        health 通过时不应再误显示「连接失败」；streaming 中杀 CLI 再启，消息经 resync 与 branch 一致
# 7.2：Agent 回复过程中 Enter 发 steer 能打断/改道；Shift+Enter follow_up 生效；idle 时不会误 steer
# 7.3：长对话手动 compact 后上下文变短；模拟/真实 overflow 触发自动 compact；compact 中 UI 有反馈
# 7.4 ✅：多轮对话后 ChatSessionBar footer 可见 token 累计随轮次增加；刷新/重连 CLI 后累计与 JSONL 一致
# 7.5：按 development-guide 能从零启动；远程 CLI 文档步骤可_follow（同机验收至少 LAN IP + CORS）
# 连续自用：3–5 天写代码/写文档无明显 blocker
```

**验收通过时**：本文顶部填 **完成日期**、**Commit**；`验收` 节补真实命令输出摘要。

**2026-06-18 自动化验收（阶段 7 收尾）：**

- `pnpm --filter @muse-ai/shared build` — 通过
- `pnpm test:run` — **45** 测试文件 / **174** passed（含 `pnpm -r build`）
- `pnpm --filter @muse-ai/web typecheck` — 通过
- `pnpm --filter @muse-ai/web build` — 通过（chunk >500kB 警告，非失败）

手动联调与连续自用见上文 **[收尾 Checklist](#收尾-checklist)**。

---

## 未做 / 留到后续

| 能力                       | 阶段  | 说明                         |
| -------------------------- | ----- | ---------------------------- |
| Token 上报 Backend / 账单  | v0.2+ | v0.1 仅 CLI 累计 + Web 展示  |
| CF Tunnel / Tailscale 脚本 | v0.2+ | v0.1 文档说明即可            |
| Compaction 树节点可视化    | v0.2+ | v0.1 以消息变短与 toast 为准 |
| 附件 / 工作区 / Trace      | v0.2+ | 见 phase-6 未做表            |
| Backend 转发 SSE           | —     | 架构刻意不做                 |

---

## 完成记录

**2026-06-18 — 7.1 手动联调增补：Runtime / Registry 两通道 + 设备级 SSE**  
**Commit**：`46e4b42`

### 背景

7.1–7.5 代码交付后进行 **B. 手动联调**，暴露两类问题：

1. **侧栏 Session 列表**在 CLI 恢复后仍 `Failed to fetch`（需在 runtime 恢复时主动 refresh）。
2. **底栏「CLI 可达」**原用 `/health` 轮询，与架构上「Web↔CLI runtime / CLI→Server registry」分工不清；且无法推送 Session 目录变更。

据此实施 **两通道重构**：Registry 只管 Server 设备目录；Runtime 由 Web 长连 CLI **设备级 SSE**，与 Session 聊天 SSE 分离。

### 架构决策（增量）

| 通道         | 路径         | 用途                                                  | 消费方                           |
| ------------ | ------------ | ----------------------------------------------------- | -------------------------------- |
| **Runtime**  | Web ↔ CLI    | 聊天 SSE/REST、Session、底栏可达、侧栏列表刷新        | Web 全局（除 `/devices` 弱提示） |
| **Registry** | CLI → Server | 配对、endpoint、`/devices` 的 `online` / `lastSeenAt` | 主要设备页目录                   |

| 项              | 原 7.1 计划                             | 实际                                                                             |
| --------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| CLI 可达探测    | 30s `/health` 轮询 + `visibilitychange` | `**GET /device/events` 长连接\*\*（30s `ping`）；断线指数退避（1s 起，上限 30s） |
| 侧栏 Session    | SSE `session_meta_updated` 补丁         | 增加 `**session_registry_changed`\*\* 广播 + runtime 恢复时 `requestRefresh`     |
| `/devices` 在线 | —                                       | 保留 Server `online` 为**目录弱提示**；连接设备不再因 `online: false` 禁用       |
| CLI 目录心跳    | —                                       | 启动立即 `online: true`；**SIGINT/SIGTERM** 上报 `online: false`；30s 周期心跳   |

详见 `[architecture.md](../architecture.md)`「两条连接通道」与「设备级 SSE」、`development-guide.md` Runtime vs Registry 专节。

### 实际产出（按包）

#### `packages/shared`

| 项                           | 说明                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `types/device-sse-events.ts` | `connected` / `ping` / `shutting_down` / `session_registry_changed`                                      |
| `constants/api-paths.ts`     | `DEVICE_EVENTS`、`deviceEventsPath()`                                                                    |
| `i18n/layout`                | `deviceReconnectIn`、`deviceReconnectNow`；activity：`deviceSseReconnecting` / `deviceSseReconnected` 等 |
| `i18n/device`                | 目录在线/离线弱提示文案                                                                                  |

#### `packages/cli`

| 文件                         | 说明                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `daemon/device-event-hub.ts` | 设备 SSE 多订阅者广播                                                                          |
| `daemon/server.ts`           | `GET /device/events`；Session 增删改发 `session_registry_changed`；shutdown 前 `shutting_down` |
| `daemon/heartbeat.ts`        | `startDeviceRegistryHeartbeat`：启停各报 `online` + 30s 心跳                                   |
| `backend/client.ts`          | `heartbeat(token, { endpoint?, online? })`                                                     |
| `daemon/deps.ts`             | 注入 `deviceEventHub`                                                                          |

#### `packages/web`

| 文件                                             | 说明                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `api/cli-client.ts`                              | `parseDeviceSseBuffer`、`subscribeDeviceEvents`（退避 + `retryNow`） |
| `lib/sse-reconnect.ts`                           | `computeSseBackoffMs`、`waitForSseRetry`（倒计时 + wake）            |
| `hooks/use-device-health.tsx`                    | 由 health 轮询改为设备 SSE 订阅；`visibilitychange` 时 `retryNow`    |
| `hooks/use-session-list.ts`                      | `reachable` false→true 时 `requestRefresh`                           |
| `lib/device-aggregate-status.ts`                 | 纳入 `deviceSseStatus`；设备 SSE `reconnecting` 优先于 `unreachable` |
| `stores/device-status-store.ts`                  | `deviceSseStatus`、`deviceReconnectInMs`、`invokeDeviceRetry`        |
| `components/layout/device-status-bar.tsx`        | 重连倒计时 +「立即重连」                                             |
| `components/layout/device-status-controller.tsx` | 区分设备 SSE / Session SSE 活动日志                                  |
| `pages/devices-page.tsx`                         | 去掉「目录离线」禁用连接；改为弱提示                                 |

### 行为摘要（7.1 联调预期，更新后）

```text
底栏（聚合）：
  device SSE reconnecting → 「重连中」+ 面板内「Xs 后重连」+「立即重连」
  device SSE disconnected / 不可达 → 「不可达」、禁发
  session SSE reconnecting（设备已连）→ 「重连中」（Session 通道）
  session_disconnected → health/设备 SSE 通过但会话失败，面板内会话「重试」
  ready → 就绪

设备 SSE 事件：
  connected → 底栏就绪；ping 保活
  session_registry_changed → 侧栏 Session 列表 refresh
  shutting_down → 标记不可达，等待重连

Registry（与底栏无关）：
  CLI 心跳 → Server /devices online；设备页仅作目录参考
```

### 自动化验收（本增补）

- `pnpm --filter @muse-ai/shared build` — 通过
- `pnpm --filter @muse-ai/cli build` — 通过
- `pnpm --filter @muse-ai/web typecheck` — 通过
- 相关单测子集 — **32 passed**（`device-event-hub`、`heartbeat`、`device-aggregate-status`、`sse-reconnect`、`cli-client-sse`、`api-paths`）

### 与计划偏差

| 项          | 说明                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| health 轮询 | **已替换**为设备 SSE；`/health` 仍保留于 CLI，供 `checkCliHealth` 等偶发探测，**不再驱动底栏** |
| Tab 关闭    | 设备 SSE 随 Tab 断开；新 Tab 新建连接即可（**不**保留 health 轮询兜底）                        |
| 阶段状态    | 7.1–7.5 任务清单不变；本增补为 **7.1 手动联调 blocker 修复**，阶段 7 整体仍待 **B/C/E** 收尾   |

### 待办（阶段关闭前）

- [ ] 提交本增补代码 + 文档的 **delivery commit**
- [ ] 完成 [收尾 Checklist](#收尾-checklist) **B**（7.1 含设备 SSE 场景）与 **C** 连续自用
- [ ] **E** 归档：文首 Commit、勾选「阶段完成记录」、同步 `current-phase.md` / `v0.1/README.md`

**2026-06-18 联调 follow-up（7.1 第 3 项）**：streaming 中杀 CLI 再启时，原 `mergeBranchWithEphemeralTail` 会保留 `running` tool 尾部导致 UI 卡死。已改为 Session SSE / 设备恢复 resync 时 `finalizeStaleTail`：收尾未完成 tool、清除 `streaming`，允许继续发消息。**手动联调 B 节第 3 项已通过**（`b14074f`）。

---

## 下一阶段

v0.1 交付后进入 **[v0.2](../roadmap.md#v02第二期)**（市场、附件、记忆 v1 等），具体以 roadmap 为准。
