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
| Session compact   | 未实现                                                         | 未改                                                                                | **7.3**     |
| Token 统计        | 无展示                                                         | 未改                                                                                | **7.4**     |
| 远程 CLI / 文档   | 索引偏旧                                                       | 未改                                                                                | **7.5**     |

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
| **7.3** | Session compact          | `MuseHarness.compact()`、`POST /sessions/:id/compact`、溢出自动 compact、Web 手动按钮与状态提示 | 7.2          | ⬜ 待开始 |
| **7.4** | Token 用量统计           | SSE `turn_end` 携带 usage；CLI 累计；Web Session 栏或消息区展示                                 | 无（可并行） | ⬜ 待开始 |
| **7.5** | 远程 CLI 与开发文档      | 远程 endpoint/HTTPS 指南、CLI env 示例、README/`docs` 索引更新、开发指南                        | 无（可并行） | ⬜ 待开始 |

建议实施顺序：**7.1 → 7.2 → 7.3**；**7.4、7.5 与 7.2 完成后并行**。

---

## 任务清单

### 7.1 断线重连与错误体验 ✅

- [x] **SSE 连接态**：`connecting` / `connected` / `reconnecting` / `disconnected`；**AppLayout 底栏**展示聚合状态；重连成功 toast；SSE 重连持续 **3s** 后自动展开面板
- [x] **重连 resync**：SSE 重连成功后 `getSessionTree` + `mergeBranchWithEphemeralTail`，修复断线 delta 丢失与 streaming 卡死
- [x] **初始/会话连接失败**：底栏面板内 destructive 文案 + **「重试」**（`checkCliHealth` + `connectSession`）；CLI 恢复或 health 已通过时会话仍 error 时 **自动重试**
- [x] **错误 i18n**：`connection-errors.ts` 规范 `cli_unreachable` / `sse_subscribe_failed` / `unknown`；文案走 `chat` 命名空间
- [x] **设备 health**：`DeviceHealthProvider` 30s 轮询 + `visibilitychange` 聚焦探测；**health 不可达时立即禁发**（`canSend`）
- [x] **设备状态 UI**：底栏 + 展开面板（endpoint、健康检查、SSE、最近活动、管理设备链接）；**CLI 不可达**与**健康通过但会话断开**分开展示（`unreachable` vs `session_disconnected`）
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

- [ ] **core**：`MuseHarness` 暴露 `compact()`（转发 pi Session / Harness API）；映射 compaction 相关 Harness 事件到 SSE（若 pi 有 `compaction_start` / `compaction_end`，按需纳入 `shared` 协议）
- [ ] **CLI API**：`POST /sessions/:id/compact`（可选 body：`customInstructions`）；compact 进行中拒绝并发 chat 或排队（与 pi 行为对齐）
- [ ] **自动触发**：LLM context 溢出（或 pi 等价错误/事件）时自动 enqueue compact，完成后可选自动重试原 turn 或仅提示用户
- [ ] **Web 手动入口**：Session 栏或聊天顶栏「压缩上下文」按钮；compact 中 disabled + loading；完成后刷新 tree/messages
- [ ] **Session 树**：compaction 节点 v0.1 可仍不在树 UI 展示详情，但 compact 后 branch 消息应变短；必要时 status toast「已压缩 N 次」
- [ ] **测试**：compact API 集成测试；自动触发可用 mock 溢出错误

### 7.4 Token 用量统计

- [ ] **shared**：扩展 SSE `turn_end`（或新增 `usage` 事件）携带 input/output/total（及 pi 已有 cost 字段若可用）
- [ ] **core**：`mapHarnessEventToSse` 转发 turn 级 usage
- [ ] **CLI**：Session 级累计（内存 + 可选写入 Session meta / JSONL 旁路）；`GET /sessions/:id/settings` 或专用接口返回累计值
- [ ] **Web**：ChatSessionBar 或 footer 展示当前 Session token 累计；单轮 turn 可选轻量增量提示
- [ ] **Backend 持久化**：v0.1 **不做**；表格留「可选」

### 7.5 远程 CLI 与开发文档

- [ ] **`docs/development-guide.md`**（或等价）： monorepo 结构、三进程联调、常见排错、改 shared 后 rebuild
- [ ] **远程 CLI 专节**：`MUSE_CLI_HOST` / `MUSE_CLI_PORT` / `MUSE_CORS_ORIGINS`；配对时 **endpoint 必须是浏览器可达地址**（非 `127.0.0.1` 代填）；HTTPS Web + HTTPS CLI；Tailscale / 反向代理 / CF Tunnel 示例（择一写清即可）
- [ ] **`packages/cli/.env.example`**（或 README 表格）列出 CLI 环境变量
- [ ] **根 `README.md`**：链到开发指南；远程场景摘要
- [ ] **`docs/README.md`**：索引更新为 phase-0 ~ **phase-7**；当前阶段指向 `current-phase.md`
- [ ] **阶段完成记录**：本文件与 `docs/v0.1/` 各 phase 验收节在 v0.1 交付时补齐

---

## 设计决策（实现）

| 项                | 决策                                      | 说明                                                                                                                       |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| SSE 传输          | Web 直连 CLI，fetch 流 + 客户端重连       | 与 architecture 一致；重连后以 **tree branch** 为真相源 resync                                                             |
| 设备状态展示      | **AppLayout 全宽底栏**（含侧栏列）        | 替代 Header 设备按钮与聊天顶栏连接条；点击展开详情面板                                                                     |
| 聚合状态          | health 优先，再区分会话/SSE               | `unreachable`（CLI 不可达）与 `session_disconnected`（health 通过但 SSE/会话失败）分开，避免「健康检查通过仍显示连接失败」 |
| 面板自动展开      | 失败立即展开；SSE 重连 3s 后展开          | 恢复 `ready` 后 2s 自动收起（仅自动展开时；用户手动展开不强制收）                                                          |
| Harness 生命周期  | **turn 结束即释放**；Session 删除时 evict | steer 仅需 turn 进行中同一实例；对齐 pi 语义，HTTP daemon 不跨 idle 常驻（pi REPL 因单进程复用 Agent）                     |
| Compact 触发      | 手动 API + 自动 overflow                  | 自动失败时须 SSE `error` + 可选 UI 提示；手动可带 customInstructions                                                       |
| Token             | turn_end 携带当轮 usage，Session 累加     | 不做账号级账单；仅自用观测                                                                                                 |
| 远程 endpoint     | 用户/运维配置公网或 tunnel URL            | `buildCliEndpoint` 行为在文档中明确；必要时支持 pair 时覆盖 endpoint                                                       |
| follow_up 跨 HTTP | 与 steer 同批交付                         | 依赖 7.2 turn 进行中 runtime                                                                                               |

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
| `hooks/use-device-health.tsx`   | `DeviceHealthProvider`：30s 轮询 + `visibilitychange` 调用 `checkCliHealth`                                                                                                            |
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

_（7.2+ 实施中按包补充。）_

### 7.2 Steer / Follow-up 真接入（2026-06-17）✅

#### 1. `packages/cli` — ChatService turn-scoped runtime

| 文件                         | 说明                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/daemon/chat-service.ts` | `activeTurns` 仅在 prompt turn 进行中持有 Harness；`steer`/`follow_up` 即时注入当前 turn；**`dispatchTurn` finally 即 evict**；下一轮 prompt 调用 `createTurnRuntime` 重建 |
| `src/daemon/server.ts`       | `DELETE /sessions/:id` 后调用 `chatService.evictRuntime` 释放进行中的 turn                                                                                                 |

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

_（7.3+ 实施中按包补充。）_

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
# 7.4：多轮对话后 Session 栏可见 token 累计随轮次增加
# 7.5：按 development-guide 能从零启动；远程 CLI 文档步骤可_follow（同机验收至少 LAN IP + CORS）
# 连续自用：3–5 天写代码/写文档无明显 blocker
```

**验收通过时**：本文顶部填 **完成日期**、**Commit**；`验收` 节补真实命令输出摘要。

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

_（阶段完成后在此填写：Commit、验收结果摘要、与计划偏差说明。）_

---

## 下一阶段

v0.1 交付后进入 **[v0.2](../roadmap.md#v02第二期)**（市场、附件、记忆 v1 等），具体以 roadmap 为准。
