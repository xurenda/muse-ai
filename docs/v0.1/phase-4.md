# 阶段 4：内置 Tools

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**预估周期**：~2–3 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

参考 [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi)（**只读探索，不添加 npm 依赖**）在 Muse 内实现完整 coding-agent 级内置 tools，并接入 `MuseHarness` / Agent 定义。

---

## 子阶段

| 子阶段  | 范围                                             | 状态 |
| ------- | ------------------------------------------------ | ---- |
| **4.1** | 基础设施 + `read` / `ls` / `bash` + Harness 接入 | ✅   |
| **4.2** | `write` / `edit` + `file-mutation-queue`         | ✅   |
| **4.3** | `grep` / `find`（系统 PATH，无自动下载）         | ✅   |

---

## 设计决策

| 项           | 决策                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------ |
| 路径策略     | 与 pi 一致：**不限制 cwd**，支持绝对路径与 `~` 展开                                              |
| bash timeout | 默认**无超时**；LLM 传 `timeout`（秒）时才启用                                                   |
| read         | **文本 only**，不移植图片 resize                                                                 |
| grep/find    | v0.1：**仅系统 PATH**（`rg`、`fd`/`fdfind`），未安装则明确报错；**不**从 GitHub/Backend 自动下载 |
| rg/fd 后续   | Backend 工具链分发见 [roadmap.md](../roadmap.md) **v0.4+**                                       |
| 工具落点     | `packages/cli/src/tools/`，直接实现 `AgentTool`                                                  |
| Agent 分工   | 通用：`read`+`ls`；编程：全套含 `grep`/`find`                                                    |
| core 边界    | `buildHarnessOptions` 仍返回 `tools: []`；由 CLI `ChatService` 注入                              |

---

## 任务清单

- [x] 4.1：`read` / `ls` / `bash` + 基础设施 + Harness 接入
- [x] 4.2：`write` / `edit` + `file-mutation-queue` + `edit-diff`
- [x] 4.3：`grep` / `find` + `system-binary`（PATH 解析）

---

## 实际产出

### `@muse-ai/cli` — `src/tools/`

| 模块                                                               | 说明                                    |
| ------------------------------------------------------------------ | --------------------------------------- |
| `truncate.ts`                                                      | 行/字节截断、`truncateLine`（grep）     |
| `paths.ts` / `path-utils.ts`                                       | 路径解析                                |
| `shell-utils.ts` / `output-accumulator.ts`                         | bash                                    |
| `read.ts` / `ls.ts` / `bash.ts`                                    | P0                                      |
| `write.ts` / `edit.ts` / `edit-diff.ts` / `file-mutation-queue.ts` | P1                                      |
| `grep.ts` / `find.ts` / `system-binary.ts`                         | P2（PATH only）                         |
| `index.ts`                                                         | `createAllTools` / `resolveActiveTools` |

**接入：** `chat-service.ts` → `resolveActiveTools` → `MuseHarness`。

**内置 Agent `activeToolNames`：**

| Agent    | 工具                                                  |
| -------- | ----------------------------------------------------- |
| 通用助手 | `read`, `ls`                                          |
| 编程助手 | `read`, `ls`, `bash`, `write`, `edit`, `grep`, `find` |

### `@muse-ai/core`

- 再导出 `AgentTool` / `AgentToolResult` 类型供 CLI tools 使用

---

## 验收

```bash
pnpm test:run
# 78 passed（含 tools 单测）

# 编程助手 + 已配对 CLI + Provider：
pnpm muse agent use 00000000-0000-4000-8000-000000000002
pnpm muse chat "在当前目录 grep package.json 里的 name 字段"
# 需系统已安装 rg；SSE 应含 tool_start/tool_end
```

---

## 未做 / 留到后续

| 能力               | 阶段  | 说明                                       |
| ------------------ | ----- | ------------------------------------------ |
| Backend 分发 rg/fd | v0.4+ | [roadmap.md](../roadmap.md) CLI 工具链分发 |
| Web tool call 卡片 | 5     | SSE 数据已就绪                             |
| read 图片          | —     | v0.1 刻意文本 only                         |

---

## 下一阶段

见 [phase-5.md](./phase-5.md)：Web 聊天 MVP（tool call 卡片、设备选择等）。
