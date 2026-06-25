# 路线规划

## 版本概览

| 版本      | 目标                                       | 状态      |
| --------- | ------------------------------------------ | --------- |
| **v0.1**  | 自用：CLI 聊天 + Web UI + Backend Provider | ✅ 已交付 |
| **v0.2**  | 市场 v1、输入增强、记忆 v1                 | 规划中    |
| **v0.3**  | 自进化 v1、Backend MCP Hub                 | 规划中    |
| **v0.4+** | Workflow、多 Agent 轻编排                  | 规划中    |

---

## v0.1（第一期）— ✅ 已交付

**目标**：一个人、一台（或多台）电脑、一个 Web 页，能组装 agent、直连 CLI 聊天、看 Session 树，API Key 在后端。

**交付说明**（含 v0.1.1 模型策略与上下文状态栏）：[releases/v0.1.md](./releases/v0.1.md)

**过程文档（考古）**：[archive/v0.1-phases/](./archive/v0.1-phases/)、[archive/v0.1.1-phases/](./archive/v0.1.1-phases/)

### 范围：已做

- [x] CLI daemon（HTTP + SSE，`muse start`）
- [x] AgentHarness 集成（Session JSONL、steer/followUp）
- [x] 本地资产目录 `~/.muse`
- [x] 内置 Persona ×2–3、Skill ×2–3
- [x] 内置 Tools（read / ls / bash / write / edit / grep / find）
- [x] Agent 组装（Persona + Skills + tools）
- [x] Backend：注册/登录、Provider 管理、CLI 配对与心跳
- [x] Web：聊天（SSE 直连 CLI）、Session 列表/树、Agent 管理、Provider / Models 设置
- [x] Web 直连 CLI（localhost + 局域网）；远程 endpoint 文档
- [x] 断线重连、Session compact、token / 上下文用量、模型池 fallback（v0.1.1）

### 范围：刻意不做（留后续版本）

- 市场上传/审核/下载
- Workflow / 多 agent 编排
- 自进化 / 跨会话记忆
- 通用 MCP 框架
- 附件多模态
- Backend 转发聊天 SSE
- 聊天 Auto 模式（按难度选 tier）

**里程碑**：连续自用无明显 blocker → **已于 2026-06 交付**。

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

| 主题               | 内容                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow           | 线性流水线：coding → review → commit                                                                                                                              |
| 多 Agent 轻编排    | 任务分解、assignee、状态机（借鉴 Paperclip 子集，非全套）                                                                                                         |
| 成本治理           | Token 预算、超限 pause                                                                                                                                            |
| AI 自动组装 Agent  | 用户描述任务 → 自动选/建 agent                                                                                                                                    |
| ClipHub 式模板     | 整包 agent 配置分享（远期）                                                                                                                                       |
| **CLI 工具链分发** | Backend 托管 `rg`/`fd` 等平台二进制 manifest + 下载 API；CLI 已配对时自动拉取到 `~/.muse/bin/`（v0.1 仅要求系统 PATH，见 [releases/v0.1.md](./releases/v0.1.md)） |

---

## 风险与原则

1. **第一期坚决砍 scope** — 市场、自进化、Workflow 全部后置。
2. **pi 升级隔离** — 所有 pi 引用集中在 `packages/core`。
3. **Web 直连优先** — 不为聊天流加 Backend relay，避免 latency 与运维复杂度。
4. **远程 CLI 文档诚实** — NAT/HTTPS 是用户环境 problem，产品提供 endpoint 注册 + 隧道指南即可。
