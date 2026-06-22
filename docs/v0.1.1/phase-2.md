# 阶段 2：Server 侧模型解析与代理

**状态**：✅ 已完成  
**完成日期**：2026-06-22  
**Commit**：`06e78a8`

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。  
> 本子阶段拆为 **2.1 → 2.2 → 2.3 → 2.4 → 2.5**，按序交付；2.4 与 2.3 可部分并行（均依赖 2.1 契约）。

---

## 目标

将 **模型策略的解析与 fallback** 从 CLI 下沉到 **Server LLM 代理**，使 CLI 把 Backend 当作**普通 OpenAI 兼容代理**使用，不再拉取或缓存 `model-strategy`。

1. **CLI**：只持久化用户的 `ModelSelection`（tier / 具体 model）；每次 LLM 请求附带 **任务 + 选择** 请求头，不参与池展开与 fallback；**除 LLM 代理外不请求 Server**。
2. **Server**：读取用户 `ModelStrategyConfig`，按 task 展开候选列表，过滤未配置凭证的 Provider，**顺序尝试**直至成功或池耗尽；经响应头回传实际使用的 `modelRef`。
3. **Web 展示**：Picker **乐观显示** tier 对应池首项（来自 Web 已有 `userAuth` 的 model-strategy）；实际模型以 SSE **`model_resolved`** 为准，fallback 后前端切换副文案。

**不做（本阶段）**：

- 聊天 **Auto** 模式与难度路由
- 跨 tier 静默降级（高池全失败仍报错，不自动改用中/低池）
- CLI 侧 `ModelStrategyProvider` 与任何 **CLI→Server 非 LLM** 接口（含 preview resolve）
- 流式响应**中途**失败后换模型重试（见 [流式与 fallback](#流式与-fallback)）

---

## 背景与动机

| 现状（阶段 1）                                               | 问题                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| CLI 启动/会话时 `GET /settings/model-strategy`（userAuth）   | 应用 **deviceToken** 调用 → 401；runtime 不应依赖用户 JWT     |
| 解析与 fallback 分散在 `ChatService` / `SessionTitleService` | 与「LLM 只在 Server 代理」重复；CLI 需感知 pools、taskRouting |
| `promptWithModelFallback` 在 CLI 循环换模型                  | Server 已有 Provider 凭证与 upstream 知识，更适合集中 retry   |
| 设置变更后 CLI TTL 缓存可能过期                              | 解析放 Server 后，策略变更**即时**生效，无需 CLI invalidate   |

**架构对齐**（见 [architecture.md](../architecture.md)）：

```text
Web ──SSE/HTTP──► CLI（Agent runtime、Session、Tools）
Web ──userAuth──► Server（设置页 model-strategy，仅 Web）
CLI ──POST /v1/*──► Server（解析 + fallback + 转发）
Server ───────────► Provider upstream
```

CLI 仍负责：**会话 meta 存 selection**、**Harness 生命周期**、**SSE 事件**；不负责：**modelRef 候选展开**、**池内 fallback 判定**、**向 Server 拉配置**。

---

## 已确认决策（2026-06-22）

| 项                     | 决策                                                                          | 说明                                                                      |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **解析位置**           | **Server** `LlmProxyService` / `ModelResolutionService`                       | 复用 `packages/core` 的 `expand*`、`isRetryableModelError`；不在 CLI 重复 |
| **鉴权**               | **deviceAuth**（与现有 `/v1/*` 一致）                                         | 按 `deviceAuth.userId` 读 `user_settings.model_strategy_json`             |
| **请求头契约**         | 见下节                                                                        | CLI 只传 selection + task；不传 pools                                     |
| **Harness 占位 model** | 固定 `muse/proxy`（或等价 sentinel）                                          | pi-ai 仍需 `Model` 对象；真实 upstream model 由 Server 决定               |
| **body.model**         | Server **以解析结果为准**；忽略 CLI body 中的 model id（有 `X-Muse-Task` 时） | 避免 CLI 与 Server 双真相                                                 |
| **实际 model 回传**    | 响应头 `X-Muse-Resolved-Model` → CLI 发 SSE **`model_resolved`**              | **不做** Preview API；CLI 不为此调 Server                                 |
| **Web 默认展示**       | tier → `pools[tier][0]`（Web 已有 `fetchModelStrategy` userAuth）             | 乐观 UI；SSE 更新为真实 model                                             |
| **Fallback 提示**      | `model_resolved.usedFallback === true` 时 Web **toast.info**                  | 含失败模型与成功模型显示名；见 [Fallback 用户提示](#fallback-用户提示)    |
| **阶段 1 代码**        | 删除 CLI `ModelStrategyProvider`、拉取 API、本地 fallback 循环                | 测试迁移到 server                                                         |

---

## 子阶段拆分

| 子阶段  | 名称                 | 交付物                                                             | 依赖         | 状态 |
| ------- | -------------------- | ------------------------------------------------------------------ | ------------ | ---- |
| **2.1** | 契约与 Server 解析器 | shared 请求头 / SSE 事件、Server `ModelResolutionService`          | phase-1 类型 | ✅   |
| **2.2** | 代理 fallback 循环   | `/v1/*` 读头、展开候选、retry、响应头回传                          | 2.1          | ✅   |
| **2.3** | CLI 瘦身             | 去掉 strategy 拉取；LLM 请求带头；Harness sentinel；读响应头发 SSE | 2.2          | ✅   |
| **2.4** | Web 展示             | Picker 乐观首项 + 消费 `model_resolved`；session settings 简化     | 2.3          | ✅   |
| **2.5** | 清理与测试           | 删 dead code；server/cli/web 测试对齐；文档                        | 2.3、2.4     | ✅   |

建议顺序：**2.1 → 2.2 → 2.3 → 2.4 → 2.5**。

---

## 请求头契约

### CLI → Server（LLM 代理）

| Header             | 必填 | 取值                                                             | 说明                                                                   |
| ------------------ | ---- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Authorization`    | 是   | `Bearer <deviceToken>`                                           | 现有                                                                   |
| `X-Muse-Task`      | 是   | `chat` \| `compaction` \| `titleGeneration`                      | 任务类型；决定 taskRouting 分支                                        |
| `X-Muse-Selection` | 否   | `tier:high` \| `tier:medium` \| `tier:low` \| `model:<modelRef>` | 省略时：chat 用 `taskRouting.chat`；辅助任务仍受 taskRouting 约束      |
| `X-Muse-Provider`  | 否   | Provider id                                                      | **deprecated**；解析后以 modelRef 的 provider 为准；保留一版兼容旧 CLI |

**Selection 编码**：

```text
tier:high | tier:medium | tier:low
model:openai/gpt-4o-mini
```

### Server → CLI（LLM 响应）

| Header                    | 说明                                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `X-Muse-Resolved-Model`   | 最终成功的 `modelRef`（**流式也在 response headers 中**，body 开始前可读） |
| `X-Muse-Fallback-Used`    | `true` \| `false`                                                          |
| `X-Muse-Attempted-Models` | 逗号分隔，调试/日志用（可选，生产可关）                                    |

CLI **不解析 pools**；从 LLM 响应头读取后 **`SessionEventHub.publish` → `model_resolved`**。

---

## SSE：`model_resolved`

### 事件 schema（`museSseEventSchema` 扩展）

```typescript
{
  type: 'model_resolved',
  modelRef: string,           // 与 X-Muse-Resolved-Model 一致
  task: 'chat' | 'compaction' | 'titleGeneration',
  usedFallback?: boolean,     // 对应 X-Muse-Fallback-Used
  attemptedModelRefs?: string[], // 来自 X-Muse-Attempted-Models；首项为失败模型
}
```

### 触发时机

| 时机                            | 行为                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **每次 LLM 代理成功**（含流式） | Server 在 response headers 写入 resolved model；CLI 在收到 headers 后立即发 SSE（早于 `text_delta`）                        |
| **Picker 展示**                 | Web **仅**对 `task: 'chat'` 更新副文案；`titleGeneration` / `compaction` 不驱动 Picker（避免标题/压缩用不同模型时 UI 抖动） |
| **fallback 发生**               | `usedFallback: true`；Web 将副文案从乐观首项切到实际 modelRef                                                               |

### Web 乐观默认

- 已有：`ChatModelPicker` 通过 `fetchModelStrategy(userToken)` 拿 pools + catalog（**Web→Server userAuth**，与 CLI 无关）。
- tier 选中时：副文案默认 `pools[tier][0]`（过滤未配置 Provider 与 Server 侧一致；Web 侧用 `options.authStatus === 'configured'` 即可）。
- 收到 `model_resolved`（chat）：更新 `resolvedModelRef` 状态，覆盖乐观值。
- **`usedFallback: true`**：`toast.info`，文案含 `fromModelName`（`attemptedModelRefs[0]`）与 `toModelName`（`modelRef`）。
- **刷新页面 / 未发消息前**：仅显示乐观首项；首条 turn 结束后与 Server 真相一致。

### Session settings API 调整

- **CLI `GET /sessions/:id/settings`**：返回 `modelSelection` + `thinkingLevel` + …；**不再**本地 expand 出 `modelRef`（或 `modelRef` 改为 optional / 仅回显上次 SSE 写入 session meta 的 `lastResolvedModelRef`，供刷新后短暂显示）。
- Web Picker：**不依赖** session settings 的 `modelRef` 做 tier 副文案；以 pools 乐观值 + SSE 为准。

---

## 数据模型（延续 phase-1）

- **Server DB**：`ModelStrategyConfig` 不变（pools + taskRouting）
- **CLI Session meta**：存 `modelSelection`；可选 `lastResolvedModelRef`（SSE 时写入，**不**调 Server）
- **Harness**：sentinel `muse/proxy`；`getApiKeyAndHeaders` 注入 `X-Muse-Task` + `X-Muse-Selection`

---

## 任务清单

### 2.1 契约与 Server 解析器 ✅

- [x] **shared**：`MUSE_LLM_TASKS`、`MUSE_PROXY_HEADERS`、请求头编解码 util；`museSseEventSchema` 增加 `model_resolved`
- [x] **server**：`ModelResolutionService` + `createModelResolutionService` — 展开候选、过滤未配置 Provider
- [x] **server**：`SettingsService.isProviderConfigured`
- [x] **core**：`isRetryableModelError` 已有单测；2.2 代理 fallback 时复用
- [x] **测试**：`llm-proxy.test.ts`、`model-resolution-service.test.ts`

### 2.2 代理 fallback 循环 ✅

- [x] **server**：`LlmProxyOrchestrator` — 解析 `X-Muse-Task` / `X-Muse-Selection`；缺省无 task 时走 legacy
- [x] **server**：候选顺序 `forward`；`isRetryableModelError` 控制换下一候选；400 不换
- [x] **server**：成功响应附加 `X-Muse-Resolved-Model`、`X-Muse-Fallback-Used`、`X-Muse-Attempted-Models`
- [x] **server**：rewrite 请求 body 的 `model` 为 upstream modelId
- [x] **server**：`app.ts` 装配 orchestrator；CORS 允许 `X-Muse-Task` / `X-Muse-Selection`
- [x] **测试**：`llm-proxy-orchestrator.test.ts`（503→200 fallback、400 停止、legacy 路径）

### 2.3 CLI 瘦身 ✅

- [x] **删除** `model-strategy-provider.ts`、`model-strategy-api.ts` 及 deps 注入
- [x] **cli**：`createBackendGetApiKeyAndHeaders(context)` 注入 `X-Muse-*`；包装 fetch / pi-ai 层以读取 **响应头** 并 `publish(model_resolved)`
- [x] **cli**：`ChatService` 移除本地 resolve / fallback 循环；sentinel model
- [x] **cli**：`SessionTitleService` / compact 走同一代理头（对应 task）
- [x] **cli**：`SessionSettingsService.get` 不再调 Server；可选写 `lastResolvedModelRef` 到 meta
- [x] **测试**：mock LLM 响应头；SSE 断言 `model_resolved`

### 2.4 Web 展示 ✅

- [x] **web**：Picker tier 副文案默认 `pools[tier][0]`（已有 strategy fetch）
- [x] **web**：`use-chat-session` / reducer 处理 `model_resolved`（仅 chat task 更新展示 state）
- [x] **web**：`resolvePickerTriggerLabels` 入参改为 `resolvedModelRef?`（SSE 覆盖乐观值）
- [x] **web**：`usedFallback === true` 时 **toast** 展示 fallback 提示（含失败/成功模型显示名）
- [x] **shared i18n**：`chat.modelPicker.fallbackToast`（zh/en）

### Fallback 用户提示

当 SSE `model_resolved` 且 `usedFallback: true`（`task: 'chat'`）时，Web 弹出 **toast**（`sonner`）说明已切换备用模型：

| 项         | 决策                                                                          |
| ---------- | ----------------------------------------------------------------------------- | ------------ | -------------------------------- |
| **触发**   | 仅 `usedFallback: true`；首候选成功时不显示                                   |
| **形式**   | **toast.info**（非 modal、不阻断对话）                                        |
| **文案**   | i18n：`{{fromModelName}} 不可用，已切换至 {{toModelName}}`                    |
| **模型名** | `attemptedModelRefs[0]` → 失败模型；`modelRef` → 成功模型；catalog 解析显示名 |
| **频率**   | 同 turn 相同 `modelRef                                                        | usedFallback | attemptedModelRefs` 不重复 toast |
| **不做**   | 不 inline、不 modal                                                           |

### 2.5 清理与测试

- [x] **文档**：更新 [architecture.md](../architecture.md)；[phase-1.md](./phase-1.md) 标注解析位置演进
- [x] **删除** CLI model-strategy 401 路径
- [x] **验收**：全量测试 + 手动验证通过（2026-06-22）

---

## 设计细节

### Server 解析流程（单次 LLM 调用）

```text
deviceAuth → userId
load ModelStrategyConfig(userId)
parse X-Muse-Task, X-Muse-Selection
candidates = expandTaskModelSelection(...)
candidates = filterConfiguredProviders(candidates)
for ref in candidates:
  provider = resolve(userId, ref.provider)
  upstream = forward(provider, body with model=ref.id)
  if success → return response + X-Muse-Resolved-Model
  if not retryable → return error
return last error | pool_empty
```

### 流式与 fallback

| 场景                            | 策略                                                     |
| ------------------------------- | -------------------------------------------------------- |
| **非流式**（标题生成等）        | 完整 fallback 循环                                       |
| **流式**（对话 `stream: true`） | **仅在上游未开始输出 body 前** retry                     |
| **流式中途断开**                | 本阶段**不**换模型续写                                   |
| **SSE `model_resolved`**        | 在流式 response **headers 就绪**时即发，不等到 turn 结束 |

### CLI 读响应头

pi-ai / Harness 经 `getApiKeyAndHeaders` 走 Server 代理；需在 CLI 层：

1. 拦截 `fetch` 或 pi 提供的 HTTP hook；
2. 读 `X-Muse-Resolved-Model` / `X-Muse-Fallback-Used`；
3. 向 `SessionEventHub` 发 `model_resolved`（带 `sessionId` 上下文）。

若 pi-ai 对流式响应头暴露有限，2.3 实现时优先验证；必要时在 Server 侧对首 chunk 前发 metadata（**本阶段优先标准 HTTP 响应头**）。

### 与 phase-1 的差异对照

| phase-1                            | phase-2                         |
| ---------------------------------- | ------------------------------- |
| CLI `GET /settings/model-strategy` | 删除                            |
| CLI `promptWithModelFallback`      | Server 循环                     |
| CLI 解析 title/compaction model    | Server 按 task 解析             |
| Session settings 本地 expand       | Web 乐观 + SSE `model_resolved` |
| Preview resolve API                | **不做**                        |

---

## 验收

### 自动化

```bash
pnpm test:run
```

**结果（2026-06-22）**：61 个测试文件、**291** 个用例全部通过。关键覆盖：

| 包     | 测试                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| server | `llm-proxy-orchestrator.test.ts`（503/ECONNREFUSED→fallback、400 停止、legacy）           |
| server | `model-resolution-service.test.ts`                                                        |
| cli    | `chat-service.test.ts`、`model-strategy-routing.test.ts`、`session-title-service.test.ts` |
| core   | `isRetryableModelError`（含 `fetch failed` / `ECONNREFUSED` cause）                       |
| web    | `model-strategy-ui.test.ts`、`use-chat-session` 消费 SSE（集成于 chat 流）                |
| shared | `llm-proxy.test.ts`、`museSseEventSchema` 含 `attemptedModelRefs`                         |

### 手动

1. **配对 CLI** 后启动，**无** model-strategy 拉取失败日志。 ✅
2. **选 tier 高**，池=[A,B]；Picker 先显示 A；A 不可达 → fallback 至 B，副文案切换，**toast** 显示「A 不可用，已切换至 B」。 ✅
3. **未发消息前刷新**：副文案仍为乐观 A（可接受）；发一条消息后与 Server 一致。 ✅
4. **标题/压缩**：`X-Muse-Task` 正确；Picker **不**因标题任务切换模型展示。 ✅
5. **未配对 device** → LLM 401（与现有一致）。 —

---

## 风险与缓解

| 风险                         | 缓解                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| pi-ai 流式响应头不可读       | 2.3 先 spike；实在不行 Server 首 chunk 带 metadata（留 v0.1.1 内备选） |
| 乐观首项与 Server 过滤不一致 | Web 用 `authStatus === 'configured'` 对齐 Server 过滤                  |
| 刷新后副文案短暂不准         | optional `lastResolvedModelRef` 写 session meta                        |
| 流式 fallback 边界复杂       | 仅「未出 body 前」retry；文档写清                                      |
| 调试困难                     | `X-Muse-Attempted-Models` + `model_resolved.usedFallback`              |

---

## 未做 / 留到后续

| 项                                    | 落在                                |
| ------------------------------------- | ----------------------------------- |
| Preview resolve API                   | **不做**（SSE + Web userAuth 足够） |
| 流式中途 fallback                     | v0.2+                               |
| Auto 路由                             | v0.2+                               |
| Picker 展示 title/compaction 实际模型 | 按需                                |

---

## 下一阶段

phase-2 完成后，v0.1.1 模型相关能力闭环；后续见 [roadmap.md](../roadmap.md)。
