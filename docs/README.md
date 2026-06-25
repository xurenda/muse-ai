# MuseAI 文档

MuseAI 是一个可组合的 personal AI agent 平台：本地 CLI 运行 agent，Web 负责交互与管理，后端统一管理账号与 LLM Provider。

## 文档索引

| 文档                                    | 说明                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| [产品描述](./product.md)                | 定位、用户价值、核心概念、功能范围                    |
| [架构设计](./architecture.md)           | 三层架构、连接方式、数据存储、技术选型与已拍板决策    |
| [路线规划](./roadmap.md)                | 版本路线；v0.1 已交付，v0.2+ 规划中                   |
| **[开发指南](./development-guide.md)**  | Monorepo 联调、排错、修改 shared 后 rebuild、远程 CLI |
| **[v0.1 交付说明](./releases/v0.1.md)** | v0.1 产品线终态（含 v0.1.1 增量）                     |
| [当前阶段](./current-phase.md)          | 当前版本快照（v0.2 规划）                             |
| [API 协议](./protocols.md)              | REST 与 SSE 契约（v0 草案）                           |
| [归档](./archive/)                      | 原 phase 过程文档（考古用）                           |

## 快速理解

```
Web ──SSE/HTTP──► CLI          聊天、Session、Agent（低延迟，不经 Backend 转发）
CLI ──HTTP──────► Backend      LLM Provider 代理、鉴权、设备注册
Web ──HTTP──────► Backend      登录、设置、设备列表、市场（后期）
```

## 仓库结构（规划）

```
muse-ai/
├── AGENTS.md          # AI / 贡献者约定（命名、测试、架构约束）
├── packages/
│   ├── cli/           # @muse-ai/cli，本地命令 muse
│   ├── core/          # Agent 组装、资产加载（封装 pi AgentHarness）
│   ├── shared/        # API 类型、事件协议、i18n
│   ├── server/        # @muse-ai/server，含 docker-compose.yml
│   └── web/           # 前端
└── docs/              # 本文档目录
```

## 参考仓库（本机 clone，供探索）

| 项目               | 路径                           |
| ------------------ | ------------------------------ |
| pi（AgentHarness） | `/Users/kingen/code/pi`        |
| Paperclip          | `/Users/kingen/code/paperclip` |

## 相关调研（tmp/，非正式文档）

- `tmp/muse-ai 设想.md` — 原始产品设想
- `tmp/cursor_agent_agentharness.md` — pi AgentHarness 能力调研
- `tmp/cursor_.md` — Paperclip 多 agent 编排调研
