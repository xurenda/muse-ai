# 阶段 1：模型策略与设置

**状态**：🔲 进行中  
**预估周期**：~1–1.5 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。  
> 本子阶段拆为 **1.1 → 1.2 → 1.3 → 1.4**，按序交付；1.3 与 1.4 可在 1.2 完成后并行。

---

## 目标

将当前「全局默认 provider + model + 会话选具体模型」升级为可运维的**模型策略**：

1. **模型池**：高 / 中 / 低三档，每档有序模型列表；请求时按序尝试，遇可恢复错误自动 fallback。
2. **聊天选择**：用户可选 **高 / 中 / 低** 或 **具体 modelRef**；选 tier 时不固化到单一模型。
3. **任务路由**：对话默认、压缩、标题生成可分别配置为 tier、具体模型，或（辅助任务）跟随对话选择。
4. **设置页**：`/settings/models` 从两个下拉升级为「模型池 + 任务路由」；聊天 Model Picker 与之一致。

**不做（本阶段）**：

- 聊天 **Auto** 模式及「Auto 路由模型」任务项
- 跨 tier 静默降级（高组全失败应报错，而非自动改用低组）
- Persona 级模型池（仍用 Persona `defaultModel` 作会话初始 fallback，见设计决策）

---

## 背景与动机

| 现状                                                     | 问题                               |
| -------------------------------------------------------- | ---------------------------------- |
| `/settings/models` 仅 `defaultProvider` + `defaultModel` | 无法表达优先级与备用模型           |
| 标题生成用会话当前模型（`SessionTitleService`）          | 大模型生成 20 字标题，成本高       |
| 压缩用 Harness 会话模型                                  | 应用更合适的摘要模型               |
| Provider 限流 / 503 无 fallback                          | 自用易中断                         |
| 聊天 Picker 只有具体模型列表                             | 无法表达「我要最好的，但允许备用」 |

---

## 已确认决策（2026-06-18）

| 项                   | 决策                                                                                          | 说明                                            |
| -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Tier 命名**        | 固定 `high` / `medium` / `low`；UI 显示 高 / 中 / 低                                          | 内部 enum；i18n 负责展示                        |
| **Auto 模式**        | **本版本不做**                                                                                | 类型/schema 可预留 `auto`，实现与 UI 均不启用   |
| **会话存储**         | 存 **`ModelSelection`**（tier 或 model），非解析后的 modelRef                                 | tier 变更池配置后仍生效                         |
| **Fallback 触发**    | 429、503、超时、鉴权失败、Provider 不可达                                                     | **不** fallback：400、内容策略、prompt 错误     |
| **辅助任务「跟随」** | `follow_chat`：压缩/标题跟随会话 tier 或 model                                                | 非 Auto；语义为「与对话同一选择策略」           |
| **配置存储**         | Server `user_settings` JSON 列或等价扩展                                                      | 与 Provider 凭证同用户；CLI 经 Backend API 拉取 |
| **迁移**             | 现有 `defaultProvider` + `defaultModel` → 写入 **medium 池首项** + `taskRouting.chat = model` | 旧 API 只读兼容一版或 PATCH 时升级              |
| **解析位置**         | `packages/core` 纯函数；CLI 在 turn / 标题 / 压缩前调用                                       | Server 不代理 LLM，仅存配置                     |
| **Thinking level**   | 与会话选择正交；tier 不强制改 thinking                                                        | 保持现有 `ReasoningLevelSlider`                 |

---

## 子阶段拆分

| 子阶段  | 名称           | 交付物                                                                | 依赖      | 状态      |
| ------- | -------------- | --------------------------------------------------------------------- | --------- | --------- |
| **1.1** | 契约与解析器   | shared 类型、Server 读写 API、core `resolveModelSelection` + fallback | v0.1 交付 | ✅ 已完成 |
| **1.2** | CLI 任务路由   | 对话 / 压缩 / 标题接入解析器；会话 settings 存 selection              | 1.1       | ✅ 已完成 |
| **1.3** | Web 设置页     | 模型池编辑 + 任务路由表；替换简陋双下拉                               | 1.1       | ✅ 已完成 |
| **1.4** | Web 聊天选择器 | Picker 支持 tier + 具体模型；展示当前解析结果                         | 1.2       | ✅        |

建议顺序：**1.1 → 1.2**；**1.3** 与 **1.2** 可并行（均依赖 1.1）；**1.4** 依赖 1.2（需 CLI 会话 API 就绪）。

---

## 数据模型（草案）

### ModelSelection

```typescript
/** 用户或任务的模型选择（不含 auto） */
type ModelSelection = { type: 'tier'; tier: 'high' | 'medium' | 'low' } | { type: 'model'; modelRef: string } // provider/modelId

/** 辅助任务额外支持跟随对话 */
type TaskModelSelection = ModelSelection | { type: 'follow_chat' }
```

### ModelStrategyConfig（Server 持久化）

```typescript
interface ModelStrategyConfig {
  pools: {
    high: string[] // modelRef，有序
    medium: string[]
    low: string[]
  }
  taskRouting: {
    chat: ModelSelection // 新会话默认 / 设置页「对话默认」
    compaction: TaskModelSelection
    titleGeneration: TaskModelSelection
  }
}
```

### 会话级覆盖

- `GET/PATCH /sessions/:id/settings` 扩展：`modelSelection?: ModelSelection`（与现有 `modelRef` 并存一版，`modelRef` 视为 `{ type: 'model', modelRef }` 的糖）
- Session 树：沿用 pi `model_change`；写入前 CLI 将 selection 解析为具体 `Model` 给 Harness，同时在 meta 或 tree label 存 selection 供 UI 回显（实现时二选一，优先 **session meta 字段** 避免改 pi 条目类型）

### API

| 方法 | 路径                       | 说明                                                           |
| ---- | -------------------------- | -------------------------------------------------------------- |
| GET  | `/settings/model-strategy` | 返回 pools + taskRouting + 可选 models 目录（已配置 Provider） |
| PUT  | `/settings/model-strategy` | 校验 modelRef 均属于已配置 Provider；池内去重                  |
| GET  | `/settings/models-config`  | **保留**；可内部委托 model-strategy，或标记 deprecated         |

---

## 任务清单

### 1.1 契约与解析器 ✅

- [x] **shared**：`ModelSelection`、`TaskModelSelection`、`ModelStrategyConfig`、Zod schema；i18n 键（settings 命名空间）
- [x] **shared**：`sessionSettingsResponse` / `SessionSettingsPatch` 增加 `modelSelection`；兼容旧 `modelRef`
- [x] **server**：DB 扩展（`user_settings.model_strategy_json`）；读写 service
- [x] **server**：`GET/PUT /settings/model-strategy`；迁移逻辑（首次读把 `defaultProvider/defaultModel` 写入 medium 池）
- [x] **core**：`resolveModelSelection(selection, pools, options)` → `{ modelRef, attemptedRefs?, usedFallback? }`
- [x] **core**：`resolveTaskModelSelection(task, sessionSelection, pools, taskRouting)` 封装 follow_chat
- [x] **core**：`isRetryableModelError(error)` 统一 fallback 判定
- [x] **测试**：core 单测（空池、tier 顺序、follow_chat、不可重试错误）

### 1.2 CLI 任务路由 ✅

- [x] **CLI**：启动或首条 chat 前拉取 model-strategy（缓存 + 设置变更后失效策略）
- [x] **SessionSettingsService**：get/patch 读写 `modelSelection`；get 返回 **effective** `modelRef`（解析后）+ `modelSelection`（用户选择）
- [x] **ChatService**：prompt turn 前 `resolveModelSelection`；失败按池 fallback；必要时 SSE 通知 `model_fallback`（可选，至少打 log）
- [x] **ChatService / compact**：压缩前用 `taskRouting.compaction` 解析模型，再 `harness.setModel`
- [x] **SessionTitleService**：标题请求用 `taskRouting.titleGeneration` 解析，**不再**直接读会话 modelRef
- [x] **测试**：标题/压缩 mock 验证用了不同 modelRef；fallback 顺序；patch selection 为 tier 后会话 get 回显 tier

### 1.3 Web 设置页 ✅

- [x] **模型池 UI**：三档 collapsible；每档有序列表（增删、拖拽排序）；仅可选已配置 Provider 的模型
- [x] **任务路由 UI**：表格四行（对话默认 / 压缩 / 标题生成）；下拉：高/中/低/具体模型/跟随对话（后两项仅辅助任务）
- [x] **保存**：`PUT /settings/model-strategy`；校验失败 toast
- [x] **空池提示**：某档为空时 inline 警告
- [x] **移除或降级**旧「Provider + Model 两个下拉」为「从 medium 池同步默认」的说明/快捷操作（避免两套真相）
- [x] **i18n**：zh / en 完整覆盖

### 1.4 Web 聊天选择器

- [x] **Picker 顶部**：高 / 中 / 低 快捷项 + 分隔线 + 按 Provider 分组的具体模型（现有列表）
- [x] **选中态**：tier 选中时 trigger 显示「高」等 + 副文案解析到的具体模型名（只读）
- [x] **PATCH**：提交 `modelSelection` 而非仅 `modelRef`
- [x] **链接**：「编辑模型」仍指向 `/settings/models`
- [x] **测试**（可选组件测试）：选中 tier 后 trigger 文案

---

## 设计细节

### Fallback 流程（单次 LLM 调用）

```text
resolve selection → candidates[]
for ref in candidates:
  try call LLM with ref
  if success → return
  if not retryable → throw（不换下一个）
return last error or pool_empty
```

- **tier**：candidates = pools[tier] 过滤掉未配置凭证的项（Server 校验 + CLI 二次过滤）
- **model**：candidates = [modelRef] 仅一个；无 fallback（除非后续产品要求单模型也配 backup，本版本不做）

### 优先级链（effective model）

```text
会话 modelSelection（或 legacy modelRef）
  → 若无：taskRouting.chat
  → 若无：Persona defaultModel
  → 若无：DEFAULT_MODEL_REF
  → 若 selection 为 tier：按池解析
```

### 与 Persona 的关系

- Persona `defaultModel` 保留：新 Session 无用户选择时使用。
- 设置页「对话默认」写入 `taskRouting.chat`，**高于** Persona 默认（用户全局偏好）。
- 会话内 patch 仍最高优先级。

---

## 验收

### 自动化

```bash
pnpm --filter @museai/shared build
pnpm --filter @museai/core build
pnpm test:run packages/core/test/model-strategy
pnpm test:run packages/server/test/settings
pnpm test:run packages/cli/test/daemon/session-title-service.test.ts
pnpm test:run packages/cli/test/daemon/chat-service.test.ts
pnpm --filter @museai/web typecheck
```

预期：新增/更新测试全绿；既有 CLI daemon 测试不回归。

### 手动

1. **设置页**：配置高=[Pro, 备用A]、低=[Flash]；保存刷新后顺序保持。
2. **聊天选「高」**：Picker 显示 tier；footer 或 tooltip 显示实际解析模型。
3. **标题**：会话用 Pro，标题任务设为「低」→ 抓包或 log 确认标题请求为 Flash。
4. **压缩**：任务设为「中」→ compact 使用 medium 池首模型。
5. **Fallback（可选联调）**：mock 首模型 503 → 同 tier 内自动用第二个；用户可见错误或 toast（若实现 SSE）。
6. **迁移**：旧账号仅有 defaultModel → 打开设置页可见 medium 池已预填。

---

## 未做 / 留到后续

| 项                          | 落在                         |
| --------------------------- | ---------------------------- |
| 聊天 Auto（难度路由）       | v0.2+                        |
| Auto 路由专用模型           | v0.2+                        |
| 跨 tier 降级策略            | 按需；默认不做               |
| 自定义 tier 名称 / 多于三档 | v0.2+                        |
| Persona 级模型池            | v0.2+                        |
| `model_fallback` SSE 事件   | 本阶段 optional；无则 v0.1.2 |
| Backend 持久化 token        | v0.2+                        |

---

## 风险与缓解

| 风险                                           | 缓解                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| Session 树只存 model 不存 tier，换池后语义丢失 | session meta 存 `modelSelection` JSON                    |
| CLI 缓存 strategy 过期                         | 设置 PUT 后 Web 调 CLI invalidate 或 TTL 5min + 401 刷新 |
| 双 API（models-config vs model-strategy）混乱  | 1.1 明确 deprecate 路径；Web 统一走 model-strategy       |
| fallback 掩盖真实配置错误                      | 不可重试错误立即失败；fallback 写 warn 日志              |

---

## 下一阶段

本版本交付并自用稳定后，按 [roadmap.md](../roadmap.md) 进入 **v0.2**（市场、附件、记忆 v1 等）；Auto 路由可作为 v0.2 早期独立子项单独立项。

**解析位置演进**：阶段 1 将解析放在 CLI；[phase-2.md](./phase-2.md) 将 **resolve + fallback 下沉至 Server LLM 代理**，CLI 仅传 `ModelSelection` 请求头。
