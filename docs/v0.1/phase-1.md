# 阶段 1：CLI Runtime 内核

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`71649a9`  
**预估周期**：~2 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

搭建 CLI agent runtime **基础设施**：代码规范工具链、`MuseHarness` 骨架、本地 `~/.muse` 目录、JSONL Session 持久化、按 session 的 SSE 端点。

**本阶段不含内置 tools**（独立为 [阶段 4](./phase-4.md)，参考 pi-coding-agent 完整实现）。

**本阶段不追求**终端/curl 完整对话收流——该能力在 [阶段 3](./phase-3.md) 以纯文本验证；tool call 在阶段 4 之后才有意义。

---

## 计划任务

### 工具链（优先）

- [x] ESLint + Prettier + husky + lint-staged
- [x] Node engines `>= 22.19.0`

### Runtime 内核

- [x] `packages/core` 封装 `MuseHarness`（`getApiKey` 占位，阶段 3 接 Backend；`tools: []`）
- [x] `~/.muse` 目录初始化（config、sessions）
- [x] JSONL Session 存储（`MuseSessionStore` + pi `JsonlSessionRepo` + `registry.json`）
- [x] CLI：`POST /sessions`、SSE `GET /sessions/:id/events`
- [x] `POST /chat` 路由骨架（202 入队 + 占位 SSE 事件，阶段 3 接通 Harness）

---

## 验收标准

- [x] `pnpm lint`、`pnpm format:check`、`pnpm test:run` 通过
- [x] `~/.muse/sessions/` JSONL 写入与重启 CLI 后可恢复 Session 元数据
- [x] `GET /sessions/:id/events` SSE 连接可建立；`POST /chat` 推送占位事件

---

## 留到后续阶段

| 能力                             | 阶段 | 说明                                                |
| -------------------------------- | ---- | --------------------------------------------------- |
| 内置 Tools                       | 4    | 参考 pi-coding-agent，见 [phase-4.md](./phase-4.md) |
| LLM 调用（Backend 代理）         | 3    | `getApiKey` + `POST /v1/chat/completions`           |
| Agent 组装（Persona/Skills）     | 2    | `MuseAgentRegistry`、真实 `/agents`                 |
| CLI 鉴权（device token）         | 3    | Bearer middleware                                   |
| `muse chat` / curl 完整 SSE 收流 | 3    | 纯文本；见 [phase-3.md](./phase-3.md) 验收          |

---

## 完成记录

| 模块           | 路径                                                        |
| -------------- | ----------------------------------------------------------- |
| MuseHarness    | `packages/core/src/muse-harness.ts`                         |
| Session 存储   | `packages/core/src/session-store.ts`、`session-registry.ts` |
| ~/.muse 初始化 | `packages/cli/src/paths.ts`                                 |
| SSE 总线       | `packages/cli/src/daemon/event-hub.ts`                      |
| Chat 骨架      | `packages/cli/src/daemon/chat-service.ts`                   |
| Daemon 路由    | `packages/cli/src/daemon/server.ts`                         |
| 工具链         | `eslint.config.js`、`.husky/pre-commit`、`.prettierrc.json` |

### 验收

```bash
pnpm lint && pnpm format:check && pnpm test:run
# 27 tests passed
```
