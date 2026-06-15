# 路线规划

## 版本概览

| 版本         | 目标                                       | 状态   |
| ------------ | ------------------------------------------ | ------ |
| **v0.1 MVP** | 自用：CLI 聊天 + Web UI + Backend Provider | 未开始 |
| **v0.2**     | 市场 v1、输入增强、记忆 v1                 | 规划中 |
| **v0.3**     | 自进化 v1、Backend MCP Hub                 | 规划中 |
| **v0.4+**    | Workflow、多 Agent 轻编排                  | 规划中 |

---

## v0.1 MVP（第一期）

**目标**：一个人、一台（或多台）电脑、一个 Web 页，能组装 agent、直连 CLI 聊天、看 Session 树，API Key 在后端。

### 范围：做

- [ ] CLI daemon（HTTP + SSE，`muse start`）
- [ ] AgentHarness 集成（Session JSONL、steer/followUp）
- [ ] 本地资产目录 `~/.muse`
- [ ] 内置 Persona ×2–3、Skill ×2–3
- [ ] 内置 Tools（参考 pi-coding-agent，阶段 4）
- [ ] Agent 组装（Persona + Skills + tools）
- [ ] Backend：注册/登录、Provider 管理、CLI 配对与心跳
- [ ] Web：聊天（SSE 直连 CLI）、Session 列表/树、Agent 管理、Provider 设置
- [ ] Web 直连 CLI（localhost + 局域网）；远程 endpoint 注册预留

### 范围：不做

- 市场上传/审核/下载
- Workflow / 多 agent 编排
- 自进化 / 跨会话记忆
- 通用 MCP 框架
- 附件多模态（可留 UI 占位）
- Backend 转发聊天 SSE

### 分阶段交付

#### 阶段 0：仓库与契约（~1 周） — [交付记录](./v0.1/phase-0.md) ✅

- monorepo 骨架（pnpm workspace）
- `packages/shared`：API 类型、SSE 事件协议
- `packages/server/docker-compose.yml`：Postgres + Redis
- 根目录 `AGENTS.md`、Vitest 配置
- 开发文档：三进程联调说明

**里程碑**：`cd packages/server && docker compose up -d` + `pnpm dev` 跑通 health check；Vitest 可运行。

---

#### 阶段 1：CLI Runtime 内核（~2 周） — [进行中](./v0.1/phase-1.md)

- ESLint + Prettier + husky + lint-staged；Node `>= 22.19.0`
- `MuseHarness` 封装 AgentHarness（`getApiKey` 占位，`tools: []`）
- `~/.muse` 初始化
- JSONL Session 存储
- `POST /sessions`、`GET /sessions/:id/events`（SSE 通路）
- `POST /chat` 路由骨架

**里程碑**：Session JSONL 可恢复；SSE 端点可连（mock 事件）；lint/test 通过。**不含 tools；curl 纯文本对话见阶段 3。**

---

#### 阶段 2：可组合 Agent（~1–2 周） — [计划](./v0.1/phase-2.md)

- Persona 格式：`persona.json` + `system.md`
- Skill 格式：`SKILL.md`（兼容 pi/Cursor 惯例）
- `MuseAgentRegistry`：加载、实例化
- 内置资产：通用助手、编程助手等
- CLI：`muse agent list/create/use`
- CLI HTTP API：`/agents`、`/sessions`

**里程碑**：切换 agent 后 system prompt 与 skills 行为明显不同。

---

#### 阶段 3：Backend 控制面（~2 周） — [计划](./v0.1/phase-3.md)

- 用户注册/登录（JWT）
- LLM Provider CRUD（加密存 Key）
- Provider 代理接口（CLI 调 LLM 走 Backend）
- Device 配对（配对码 / QR）
- CLI 心跳 + endpoint 注册
- Web 设备列表 API
- `POST /chat` 接通 Harness；`muse chat` 调试入口；CLI 鉴权

**里程碑**：CLI 无 Key 可调模型；**终端/curl 纯文本 SSE 收流**；设备 online/offline。

---

#### 阶段 4：内置 Tools（~2–3 周） — [计划](./v0.1/phase-4.md)

- 参考 pi-coding-agent 移植 `read` / `ls` / `bash`（P0）及 write/edit/grep/find
- `packages/cli/tools/`、`createMuseTools`、path 沙箱与 truncation
- 与 Agent `activeToolNames` 集成

**里程碑**：编程助手可实际 tool call；SSE `tool_start`/`tool_end` 有真实数据。

---

#### 阶段 5：Web 聊天 MVP（~2–3 周） — [计划](./v0.1/phase-5.md)

- 登录、设备选择（读 Backend endpoint，直连 CLI SSE）
- Agent 选择与简易组装 UI
- 聊天页：流式 Markdown、thinking、tool call 卡片
- steer / followUp
- 模型、thinking level 切换（经 CLI 转发到 Harness）
- Session 列表 + 树形展示（数据来自 CLI API）

**里程碑**：Web → CLI（SSE）+ CLI → Backend（LLM）全链路跑通。

---

#### 阶段 6：打磨与自用（~1 周） — [计划](./v0.1/phase-6.md)

- 断线重连、错误提示
- Session compact（长对话）
- 基础 token 用量统计（CLI 侧累计，Backend 可选持久化）
- 远程 CLI endpoint + HTTPS 说明文档
- README 与开发指南

**里程碑**：连续自用 3–5 天无明显 blocker → **v0.1 交付**。

---

## v0.2（第二期）

| 主题         | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| 市场 v1      | Persona/Skill 浏览、安装；简单审核流                         |
| 输入增强     | 附件、`@文件`、`/skill`                                      |
| 记忆 v1      | 会话摘要入库；新会话检索相关摘要（Thought-Retriever 轻量版） |
| Session 同步 | 可选：仅 metadata 同步 Backend（标题、时间），内容仍本地     |

---

## v0.3（第三期）

| 主题              | 内容                                 |
| ----------------- | ------------------------------------ |
| 自进化 v1         | 审查 agent → 优化建议 → 用户确认采纳 |
| SkillOpt 式验证门 | 改 Skill 前 held-out 任务验证        |
| Backend MCP Hub   | markitdown、headroom 等托管服务      |
| 通用 MCP 框架     | `~/.muse/mcps/` 真正可用             |

---

## v0.4+（第四期及以后）

| 主题              | 内容                                                      |
| ----------------- | --------------------------------------------------------- |
| Workflow          | 线性流水线：coding → review → commit                      |
| 多 Agent 轻编排   | 任务分解、assignee、状态机（借鉴 Paperclip 子集，非全套） |
| 成本治理          | Token 预算、超限 pause                                    |
| AI 自动组装 Agent | 用户描述任务 → 自动选/建 agent                            |
| ClipHub 式模板    | 整包 agent 配置分享（远期）                               |

---

## 风险与原则

1. **第一期坚决砍 scope** — 市场、自进化、Workflow 全部后置。
2. **pi 升级隔离** — 所有 pi 引用集中在 `packages/core`。
3. **Web 直连优先** — 不为聊天流加 Backend relay，避免 latency 与运维复杂度。
4. **远程 CLI 文档诚实** — NAT/HTTPS 是用户环境 problem，产品提供 endpoint 注册 + 隧道指南即可。
