# MuseAI

可组装的 personal AI agent 平台。本地 CLI 运行 agent，Web 交互，Server 管理账号与 LLM Provider。

- 产品文档：[docs/README.md](./docs/README.md)
- 贡献约定：[AGENTS.md](./AGENTS.md)

## 环境要求

- Node.js >= 22.19.0
- pnpm >= 10
- Docker（仅 Server 依赖：Postgres、Redis）

## 快速开始

```bash
# 安装依赖
pnpm install

# 编译所有包
pnpm build

# 单元测试
pnpm test:run

# 代码检查与格式化
pnpm lint
pnpm format:check

# 1. 启动后端依赖
cd packages/server && docker compose up -d && cd ../..

# 2. 启动 Server（终端 1）
pnpm dev:server

# 3. 启动 CLI daemon（终端 2）
pnpm dev:cli

# 4. 启动 Web（终端 3）
pnpm dev:web
```

## 健康检查

```bash
curl http://127.0.0.1:3000/health   # server
curl http://127.0.0.1:7421/health   # cli
```

## 包说明

| 包                | 说明                      |
| ----------------- | ------------------------- |
| `@muse-ai/shared` | 类型、API 路径、SSE 协议  |
| `@muse-ai/core`   | Agent 组装（阶段 1）      |
| `@muse-ai/cli`    | `muse` 命令与 daemon      |
| `@muse-ai/server` | 后端 API + docker-compose |
| `@muse-ai/web`    | Web 前端                  |

## 参考仓库（本机）

| 项目      | 路径                           |
| --------- | ------------------------------ |
| pi        | `/Users/kingen/code/pi`        |
| Paperclip | `/Users/kingen/code/paperclip` |
