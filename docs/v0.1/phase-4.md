# 阶段 4：内置 Tools

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`a9447d7`  
**预估周期**：~2–3 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

参考 [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi)（**只读探索，不添加 npm 依赖**）在 Muse 内实现 coding-agent 级内置 tools，并接入阶段 1 的 `MuseHarness` 与阶段 2 的 Agent `activeToolNames`。

阶段 3 已能纯文本对话；本阶段让**编程助手可实际 read / ls / bash / write / edit / grep / find**，且 SSE 出现带真实 `args` / `result` 的 `tool_start` / `tool_end`。

---

## 任务清单

- [x] 调研 pi `core/tools/` 分层（`AgentTool`、`Operations` 可注入 mock）
- [x] `packages/cli/src/tools/` + `resolveActiveTools(cwd, activeToolNames)`
- [x] 4.1：基础设施 + `read` / `ls` / `bash` + `ChatService` 注入
- [x] 4.2：`write` / `edit` + `file-mutation-queue` + `edit-diff`
- [x] 4.3：`grep` / `find` + 系统 PATH 解析（`rg`、`fd`/`fdfind`）
- [x] 内置 Agent `activeToolNames` 更新
- [x] 单元测试（path、truncation、Operations mock、file-mutation 串行）
- [x] 端到端验收（DeepSeek + `muse chat` + curl SSE tool 事件）

---

## 设计决策

| 项           | 决策                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| 参考来源     | 本地 `/Users/kingen/code/pi/packages/coding-agent/src/core/tools/`，按需移植 execute 逻辑 |
| npm 依赖     | **不**引入 `@earendil-works/pi-coding-agent`；CLI 新增 `typebox`、`diff`                  |
| 实现形态     | 直接实现 `AgentTool`（跳过 pi 的 TUI `renderCall` / `renderResult`）                      |
| 路径策略     | 与 pi 一致：**不限制 cwd**；支持相对/绝对路径、`~` 展开、macOS 文件名变体                 |
| bash timeout | 默认**无超时**；仅 LLM 在 tool call 里传 `timeout`（秒）时 kill 进程树                    |
| read         | **文本 only**（不移植图片 resize / vision 分支）                                          |
| grep / find  | v0.1：**仅系统 PATH**；未安装则报错并提示安装方式；**不**自动下载                         |
| rg / fd 后续 | Backend 工具链分发见 [roadmap.md](../roadmap.md) **v0.4+**                                |
| 工具注册     | `core.buildHarnessOptions` 仍返回 `tools: []`；**CLI `ChatService`** 按 Agent 注入        |
| Agent 分工   | 通用助手只读；编程助手全套（含写文件与搜索）                                              |

---

## 实际产出

### 1. `@muse-ai/cli` — 内置 tools

**目录：**

```
packages/cli/src/tools/
├── index.ts                 # createAllTools / resolveActiveTools
├── truncate.ts              # 行/字节双限制、grep 单行 truncateLine
├── paths.ts / path-utils.ts # resolveToCwd、~、macOS 变体
├── shell-utils.ts           # getShellConfig、killProcessTree、waitForChildProcess
├── output-accumulator.ts    # bash 流式输出 + 超限写临时文件
├── read.ts / ls.ts / bash.ts
├── write.ts / edit.ts
├── edit-diff.ts             # 精确/模糊匹配、diff、unified patch
├── file-mutation-queue.ts   # 同文件 write/edit 串行化
├── grep.ts / find.ts
└── system-binary.ts         # PATH 解析 rg、fd/fdfind
```

**工具一览（对齐 pi 工具名）：**

| 工具    | 能力摘要                                                      | 依赖                          |
| ------- | ------------------------------------------------------------- | ----------------------------- |
| `read`  | offset/limit、50KB/2000 行截断、续读提示                      | 本地 fs                       |
| `ls`    | 目录列表、500 条上限、目录 `/` 后缀                           | 本地 fs                       |
| `bash`  | shell 执行、可选 timeout、tail 截断                           | Git Bash / sh                 |
| `write` | 创建/覆盖、自动 mkdir 父目录                                  | 本地 fs                       |
| `edit`  | `edits[]` 多块替换；legacy `oldText`/`newText`；BOM/CRLF 保留 | 本地 fs + `diff`              |
| `grep`  | ripgrep JSON 流、context 行、100 条 match 上限                | 系统 **`rg`**                 |
| `find`  | fd glob、1000 条上限、尊重 .gitignore                         | 系统 **`fd`** 或 **`fdfind`** |

**工厂 API：**

```typescript
// packages/cli/src/tools/index.ts
resolveActiveTools(activeToolNames, cwd, options?) → AgentTool[]
```

未知 tool 名抛错；空 `activeToolNames` 返回 `[]`（与阶段 1–3 纯文本行为一致）。

**Daemon 接入：**

| 模块              | 变更                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `chat-service.ts` | 创建 `MuseHarness` 前 `resolveActiveTools(context.agent.activeToolNames, cwd)` |

**内置 Agent 配置（`assets/agents/.../agent.json`）：**

| Agent    | ID                                     | `activeToolNames`                                     |
| -------- | -------------------------------------- | ----------------------------------------------------- |
| 通用助手 | `00000000-0000-4000-8000-000000000001` | `read`, `ls`                                          |
| 编程助手 | `00000000-0000-4000-8000-000000000002` | `read`, `ls`, `bash`, `write`, `edit`, `grep`, `find` |

**CLI 新增依赖：** `typebox`（tool schema）、`diff`（edit unified patch）

**测试：** `packages/cli/test/tools/` 镜像 `src/tools/`，共 **29** 项 tools 单测

### 2. `@muse-ai/core`（本阶段增量）

| 模块       | 变更                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `index.ts` | 再导出 `AgentTool`、`AgentToolResult`（供 CLI tools 类型，不重复依赖 pi 包声明） |

阶段 1 已有 `mapHarnessEventToSse` → `tool_start` / `tool_end`；本阶段无需改映射逻辑，仅注入真实 tools 后事件有内容。

### 3. 数据流（本阶段打通）

```
POST /chat（阶段 3）
        ↓
MuseAgentRegistry → activeToolNames
        ↓
resolveActiveTools → MuseHarness(tools, activeToolNames)
        ↓
LLM 返回 tool_call → CLI 本地执行 read/bash/…
        ↓
SSE tool_start { toolName, args } → tool_end { result, isError? }
        ↓
（阶段 5）Web 聊天页展示 tool call 卡片
```

**与阶段 3 的差异：** 同一 `/chat` + SSE 通路；assistant 回合内可出现多轮 tool loop，CLI stdout（`muse chat`）仍主要打印 `text_delta`（thinking 暂合并，见阶段 6）。

---

## 验收

```bash
pnpm test:run
# 78 tests passed（阶段 4 前 41 → 后 78，+37 含 tools 29 项）

# 前置：Server + Docker、CLI daemon、Provider、muse pair（同阶段 3）

pnpm muse agent use 00000000-0000-4000-8000-000000000002

# 纯文本
pnpm muse chat "用一句话介绍你自己，不要调用任何工具"

# ls 工具
pnpm muse chat "请用 ls 工具列出当前目录，limit 8"

# read + SSE tool 事件（curl 示例）
# → tool_start: read, args: { path, offset, limit }
# → tool_end: result.content[].text 含文件片段

# grep（需 PATH 有 rg，macOS: brew install ripgrep）
pnpm muse chat "用 grep 在 package.json 里搜 name"

# find（需 PATH 有 fd，macOS: brew install fd）
# 未安装时 tool 报错：fd not found in PATH
```

**2026-06-15 人工验收：** DeepSeek（`deepseek-v4-pro` / `deepseek-v4-flash`）+ 已配对 CLI；`read`/`ls`/`grep` tool call 与 SSE `tool_start`/`tool_end` 通过。

---

## 未做 / 留到后续阶段

| 能力                       | 阶段   | 说明                          |
| -------------------------- | ------ | ----------------------------- |
| Web tool call 卡片         | 5      | SSE payload 已就绪            |
| Backend 自动分发 rg/fd     | v0.4+  | [roadmap.md](../roadmap.md)   |
| read 图片 / resize         | —      | v0.1 刻意文本 only            |
| pi 式 trust 弹窗           | —      | Web 场景不做；bash 默认可用   |
| SSE 区分 thinking / 正文   | 6      | 推理流暂进 `text_delta`       |
| `muse chat` 打印 tool 事件 | 6 可选 | 当前仅 `text_delta` + `error` |

---

## 下一阶段

见 [phase-5.md](./phase-5.md)：Web 聊天 MVP（登录、设备选择、SSE 直连 CLI、流式 Markdown、**tool call 卡片**）。
