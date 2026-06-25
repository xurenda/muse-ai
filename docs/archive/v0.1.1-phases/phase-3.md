# 阶段 3：上下文状态栏与用量面板

**状态**：🔲 进行中  
**预估周期**：~3–5 天

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。  
> 本子阶段拆为 **3.1 → 3.2 → 3.3 → 3.4 → 3.5**，按序交付；3.3 与 3.4 可部分并行（均依赖 3.2 契约）。

---

## 目标

将 **上下文窗口占用** 与 **Session 累计 token** 从输入区上方移至 **App 底部状态栏**，采用 **点击展开面板（方案 B）** 展示详情与操作，使输入区只保留 Agent 选择与消息输入。

1. **状态栏触发器**：对话页底部右侧（模型 Picker 左侧）显示紧凑的上下文摘要（如 `12.3% / 200k`）；压缩后 tokens 未知时为 `? / 200k`；窗口未知时用 `—` 占位，**不使用固定魔法数字**。
2. **上下文面板**：展示窗口占用、Session 累计 token（↑/↓/total、可选 cost / cache）、**压缩上下文** 按钮及进行中状态。
3. **数据层**：CLI 暴露 **Context Usage**（算法对齐 pi coding-agent `getContextUsage`，**不**依赖 `@earendil-works/pi-coding-agent`），区别于现有 **Session 累计 tokenUsage**。
4. **输入区瘦身**：`ChatSessionBar` 移除 token 行与压缩按钮；Agent 选择与管理入口保留。

**不做（本阶段）**：

- Backend 账号级 token 持久化
- 单轮 turn 增量 toast
- 聊天 **Auto** 模式与自动 tier 路由
- 自动 compact 相关文案或状态栏提示
- 非对话路由（设置页等）展示上下文面板

---

## 背景与动机

| 现状（v0.1 phase-7）                               | 问题                                                  |
| -------------------------------------------------- | ----------------------------------------------------- |
| `ChatSessionBar` 下方一行 `↑38 ↓189 · 2.0k tokens` | 与 Agent 选择、输入框挤在一起，职责混杂               |
| 「压缩上下文」按钮在 Session 栏                    | 属于会话运行时操作，非撰写消息动作                    |
| 仅展示 **Session 累计 token**                      | 用户关心的是 **当前 prompt 占窗口多少**，二者语义不同 |
| 模型 Picker 已在底部状态栏右侧（Portal）           | 上下文触发器紧贴其左侧，形成「设备 … 上下文 \| 模型」 |

**参考**：pi coding-agent footer 同时展示累计 token 与 `12.3%/200k`；MuseAI 将累计用量移入面板详情，状态栏主展示 **Context Usage**。

**架构约束**（不变）：

```text
Web ──GET settings / SSE──► CLI（Context Usage 由 pi Session JSONL + 分支消息估算）
Server ──model_resolved──► CLI ──SSE──► Web（contextWindow 随 resolved model 下发）
Web ──Portal──► DeviceStatusBar 右侧插槽（上下文触发器 + 模型 Picker）
```

---

## 已确认决策

### 2026-06-22（方案选型）

| 项                     | 决策                                          | 说明                                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------- |
| **交互形态**           | **方案 B：点击展开面板**                      | 对齐左侧「设备状态」面板模式；详情与操作集中在面板内    |
| **状态栏主文案**       | **Context Usage 优先**                        | 紧凑显示 `percent% / contextWindow`                     |
| **Session 累计 token** | **面板内展示**，不占状态栏主文案              | 保留现有 `tokenUsage` 字段与 SSE 累加逻辑               |
| **压缩入口**           | **面板内主按钮**                              | 从 `ChatSessionBar` 移除；compact 中 disabled + loading |
| **输入区**             | 仅保留 Agent + 管理链接                       | token 行删除                                            |
| **仅对话页**           | 有 `sessionId` 且 `status === 'ready'` 时挂载 | 与 `ChatStatusBarModelPicker` 一致                      |

### 2026-06-22（T1–T9 定稿）

| 项                        | 决策                                                     | 说明                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **T1 Context Usage 计算** | 参考 pi coding-agent 自实现                              | `getContextUsage` 在 **`pi-coding-agent`** 的 `AgentSession`（`agent-session.ts`）；辅助函数 `calculateContextTokens` / `estimateContextTokens` 在 `compaction/compaction.ts`。在 **`packages/core`** 移植同等逻辑，复用 `@earendil-works/pi-agent-core` 的 `buildSessionContext`；**禁止** import `@earendil-works/pi-coding-agent` |
| **T2 contextWindow 来源** | **C：`model_resolved` SSE 携带 `contextWindow`**         | Server 解析模型时从 Provider catalog 填入；CLI 转发至 Web。`contextWindow` 未知时 UI 用 `—`，**禁止**用 sentinel / 128k 等魔法数字冒充真实窗口                                                                                                                                                                                       |
| **T3 实时更新**           | **SSE 增量 + `agent_end` 校准**                          | 与现有 `tokenUsage` 同一套路：`turn_end` 携带 `contextUsage` 实时更新；`agent_end` / compact 后 `GET settings` 与 JSONL 对齐                                                                                                                                                                                                         |
| **T4 面板锚点**           | 紧贴触发器上方 popover                                   | 同 `DeviceStatusPanel`                                                                                                                                                                                                                                                                                                               |
| **T5 状态栏插槽**         | **`STATUS_BAR_CONTEXT_SLOT_ID`，右侧、模型 Picker 左边** | trailing 区域：`ml-auto` 内 `[context slot][model picker]`，不与左侧设备状态抢位                                                                                                                                                                                                                                                     |
| **T6 占用率配色**         | \>70% warning、\>90% destructive                         | 与 pi footer 一致                                                                                                                                                                                                                                                                                                                    |
| **T7 Cache 统计**         | 有数据则面板展示，无则省略                               | `R/W/CH%` 可选行                                                                                                                                                                                                                                                                                                                     |
| **T8 自动 compact**       | **无任何文案或提示**                                     | 本阶段不做开关、不做说明句                                                                                                                                                                                                                                                                                                           |
| **T9 空 Session**         | 触发器 **`0% / {contextWindow}`**                        | `contextWindow` 来自 catalog 乐观值或已收到的 `model_resolved`；未知时为 `0% / —`；**面板内不额外解释**                                                                                                                                                                                                                              |

---

## pi 参考实现（只读，不依赖）

| 位置                                                                  | 职责                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pi/packages/coding-agent/src/core/agent-session.ts`                  | `getContextUsage()`：compaction 边界判定、`percent` 计算           |
| `pi/packages/coding-agent/src/core/compaction/compaction.ts`          | `calculateContextTokens(usage)`、`estimateContextTokens(messages)` |
| `pi/packages/coding-agent/src/modes/interactive/components/footer.ts` | 展示格式与阈值配色参考                                             |

MuseAI 对应落点：`packages/core/src/session-context-usage.ts`（新），由 CLI `SessionSettingsService` 与 SSE 映射调用。

---

## 子阶段拆分

| 子阶段  | 名称              | 交付物                                                                         | 依赖           | 状态 |
| ------- | ----------------- | ------------------------------------------------------------------------------ | -------------- | ---- |
| **3.1** | 契约与 Core 估算  | `ContextUsage` 类型、`readContextUsage(session, contextWindow)`                | v0.1.1 phase-2 | ✅   |
| **3.2** | CLI + Server 暴露 | `GET settings` 增字段；`model_resolved.contextWindow`；`turn_end.contextUsage` | 3.1            | ✅   |
| **3.3** | 状态栏触发器      | 右侧 context 插槽 + 紧凑摘要 + 展开/收起                                       | 3.2            | ✅   |
| **3.4** | 上下文面板 UI     | 详情、压缩按钮、i18n；输入区移除旧控件                                         | 3.2            | ✅   |
| **3.5** | 清理与测试        | core/cli/server/web 单测                                                       | 3.3、3.4       | ✅   |

建议顺序：**3.1 → 3.2 → 3.3 ∥ 3.4 → 3.5**。

---

## 数据模型（草案）

### ContextUsage（shared）

```typescript
/** 当前分支上下文窗口占用（非 Session 累计） */
interface ContextUsage {
  /** 估算占用 token；压缩后尚无新 assistant 响应时为 null */
  tokens: number | null
  /** 模型上下文窗口上限；未知时为 null（禁止伪造默认值） */
  contextWindow: number | null
  /** tokens / contextWindow * 100；任一侧为 null 时为 null */
  percent: number | null
}
```

### SessionSettingsResponse 扩展

```typescript
interface SessionSettingsResponse {
  // ...现有字段
  tokenUsage: SessionTokenUsage // 不变：Session 累计
  contextUsage: ContextUsage // 新增
}
```

### SSE 扩展（3.2 定稿）

| 事件                 | 变更                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| **`model_resolved`** | 新增可选 `contextWindow: number`（Server catalog → CLI → Web）             |
| **`turn_end`**       | 新增可选 `contextUsage: ContextUsage`（与 `usage` 并列，Web 实时 reducer） |

Web 维护会话级 `contextWindow`：优先最近 **chat** 任务的 `model_resolved`；未发消息前可用 Picker 乐观 model 查 Web 侧 catalog（与 phase-2 乐观 UI 一致）。**无可靠来源时为 null → UI 显示 `—`**。

### 触发器展示规则

| 场景                         | 触发器示例             |
| ---------------------------- | ---------------------- |
| 空 Session，窗口已知         | `0% / 200k`            |
| 空 Session，窗口未知         | `0% / —`               |
| 正常占用                     | `12.3% / 200k`         |
| 压缩后 tokens 未知，窗口已知 | `? / 200k`             |
| 窗口未知                     | `? / —` 或 `12.3% / —` |

---

## UI 设计

### 状态栏布局（对话页）

```text
┌──────────────────────────────────────────────────────────────────┐
│ ● 设备 · 就绪              12.3% / 200k ▾  │  标准 DeepSeek V4 Flash 低 ▾ │
└──────────────────────────────────────────────────────────────────┘
     ↑ 左侧固定                    ↑ context slot      ↑ model picker (trailing)
```

- 右侧区域：`flex ml-auto`，顺序为 **上下文触发器 → 模型 Picker**。
- 触发器高度 `h-5`、`text-[11px]`，与模型 Picker 一致。
- 展开时触发器背景 `bg-foreground/6`（同设备面板）。
- 主文案颜色：`percent > 90` → destructive；`> 70` → warning；否则 muted-foreground。

### 上下文面板（点击触发器）

锚定在触发器上方，宽度 `min(20rem, calc(100vw - 1rem))`，结构参考 `DeviceStatusPanel`：

```text
┌─ 上下文 ─────────────────────┐
│ 窗口占用    15.7k / 200k (12.3%) │  ← tokens 或 percent 为 null 时对应字段显示「?」
│ ─────────────────────────────│
│ Session 累计  ↑38 ↓189 · 2.0k tokens │
│ 费用          $0.012（可选）   │
│ 缓存          R1.2k · CH 85%（可选）│
│ ─────────────────────────────│
│ [ 压缩上下文 ]                 │  ← compacting 时 disabled +「正在压缩…」
└──────────────────────────────┘
```

- 点击面板外或 Esc 关闭（与设备面板相同 pointerdown 逻辑）。
- **压缩上下文** 调用现有 `compactContext()`；完成后 `loadSettings` + 刷新 tree（现有逻辑复用）。
- **无**自动 compact 说明文案；**无**空 Session 解释段落。

### 输入区（变更后）

```text
┌ Agent: 编程助手 ▼ ┐  [管理 Agent] [管理 Provider]
┌──────────────────────────────────────────────────┐
│ 输入消息…                                         │
└──────────────────────────────────────────────────┘
```

---

## 实现要点（按包）

### 3.1 `packages/shared` + `packages/core`

| 项                         | 说明                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `types/context-usage.ts`   | `contextUsageSchema`（含 nullable `contextWindow`）、导出类型                                                            |
| `session-context-usage.ts` | `readContextUsage(session, contextWindow: number \| null)`：移植 pi `getContextUsage` 分支逻辑 + `estimateContextTokens` |
| 依赖                       | `@earendil-works/pi-agent-core` 的 `buildSessionContext`；算法参考 pi coding-agent **源码**，不引入包                    |
| `percent`                  | 仅当 `tokens != null && contextWindow != null && contextWindow > 0` 时计算                                               |

### 3.2 `packages/server` + `packages/cli`

| 项                                   | 说明                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| **Server** `model_resolved` / 响应头 | 解析成功时附带 catalog `contextWindow`（无则省略/null，不写 128k）                      |
| **shared** `model_resolved` schema   | `contextWindow: z.number().positive().optional()`                                       |
| `session-settings-service.get()`     | `readContextUsage(piSession, resolveContextWindow(meta, catalog))`                      |
| `resolveContextWindow`               | 优先 session meta `lastResolvedModelRef` + catalog；无则 **null**                       |
| SSE `turn_end`                       | `mapHarnessEventToSse` 在每轮结束后计算并附带 `contextUsage`                            |
| SSE `model_resolved`                 | 转发 Server 下发的 `contextWindow`                                                      |
| 测试                                 | settings schema；compact 后 `tokens/percent: null`；无 catalog 时 `contextWindow: null` |

### 3.3–3.4 `packages/web`

| 项                                  | 说明                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `constants/status-bar.ts`           | `STATUS_BAR_CONTEXT_SLOT_ID`                                                                                     |
| `device-status-bar.tsx`             | trailing 区：`context slot` 在 `STATUS_BAR_TRAILING_SLOT_ID` **之前**，共用 `ml-auto`                            |
| `chat-status-bar-context-panel.tsx` | 触发器 + 面板（Portal）                                                                                          |
| `format-context-usage-trigger.ts`   | 集中处理 `0% / —`、`? / 200k` 等展示规则                                                                         |
| `chat-session-bar.tsx`              | 移除 `SessionTokenUsageDisplay`、压缩按钮                                                                        |
| `use-chat-session.ts`               | `turn_end` → 更新 `contextUsage`；`model_resolved` → 更新 `contextWindow`；`agent_end` / compact → settings 校准 |
| `i18n/chat` + `layout`              | 面板标题、字段标签；**不含** auto compact / 空 Session 说明                                                      |

### 3.5 文档

| 项                     | 说明                                           |
| ---------------------- | ---------------------------------------------- |
| `docs/v0.1/phase-7.md` | 7.4 行为摘要：token / 上下文展示改至状态栏面板 |
| 本文件                 | 完成后填 Commit、验收结果                      |

---

## 验收

### 自动化

```bash
pnpm test:run
pnpm --filter @museai/web typecheck
```

预期新增/更新：

| 包     | 测试                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------ |
| core   | `readContextUsage`：无消息、有 assistant usage、compaction 后 null、contextWindow null 时 percent null |
| server | catalog 有/无 `contextWindow` 时解析结果                                                               |
| cli    | settings + SSE schema；`model_resolved.contextWindow` 转发                                             |
| web    | 触发器：`0% / 200k`、`0% / —`、`? / 200k`；percent 配色                                                |
| shared | `contextUsageSchema`、`model_resolved` 扩展 round-trip                                                 |

### 手动

1. **进入对话**：状态栏右侧、模型左侧出现上下文触发器；输入区**无** token 行与压缩按钮。
2. **空 Session**：触发器 `0% / {窗口}` 或 `0% / —`；打开面板无多余说明文案。
3. **发若干轮**：`turn_end` 后触发器百分比上升；面板 Session 累计同步。
4. **手动压缩**：面板内压缩 → 完成后 tree 变短；尚无新 assistant 时触发器 `? / {窗口}`。
5. **模型 fallback**：`model_resolved` 携带新 `contextWindow`，触发器分母更新。
6. **catalog 缺 window**：全程显示 `—`，不出现 128k。
7. **非对话页**：无上下文触发器。
8. **窄屏**：触发器 truncate；面板不溢出视口。

---

## 风险与缓解

| 风险                               | 缓解                                                  |
| ---------------------------------- | ----------------------------------------------------- |
| pi-agent-core 无 `getContextUsage` | core 移植 coding-agent 算法（T1）                     |
| 首条消息前无 `model_resolved`      | Web catalog 乐观 model 的 `contextWindow`；仍无则 `—` |
| SSE 与 GET settings 双源           | `agent_end` 强制 settings 校准                        |
| 与设备面板同时打开                 | 互斥：打开其一关闭另一                                |
| 右侧宽度不足                       | context 触发器优先 truncate；详情在面板               |

---

## 未做 / 留到后续

| 项                                 | 落在                    |
| ---------------------------------- | ----------------------- |
| 自动 compact 用户开关与提示        | v0.1.2 或 v0.2          |
| 状态栏 mini 进度条                 | 按需 UX 打磨            |
| Backend token 持久化               | v0.2+                   |
| 单轮 turn toast                    | v0.1.2 optional         |
| title/compaction 任务 context 展示 | 不做（仅 chat session） |

---

## 下一阶段

phase-3 完成后，v0.1.1 **UX 与模型策略**闭环；后续按 [roadmap.md](../roadmap.md) 评估 v0.1.2 或 v0.2 能力。
