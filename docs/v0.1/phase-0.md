# 阶段 0：仓库与契约

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`2df1650`  
**预估周期**：~1 周

---

## 目标

搭建 monorepo 骨架，定好 Web ↔ CLI ↔ Server 的 REST 与 SSE 契约，Backend 依赖能用 Docker Compose 跑起来，三进程（server / cli / web）可本地联调 health。

---

## 任务清单

- [x] 初始化 pnpm monorepo（`packages/cli`、`core`、`shared`、`server`、`web`）
- [x] `packages/server/docker-compose.yml`（Postgres、Redis）
- [x] 根目录 `AGENTS.md`、Vitest（`vitest.config.ts`、`pnpm test` / `pnpm test:run`）
- [x] `packages/shared`：SSE 事件类型、REST 路径常量、Device/Agent/Session DTO
- [x] CLI daemon 骨架（health + agents/sessions 占位）
- [x] Server 骨架（health + auth/login stub）
- [x] Web 骨架（Vite + React + 环境变量）
- [x] 根目录 README：三进程联调命令
- [x] `docs/protocols.md`：REST + SSE 详细 schema

---

## 实际产出

### 1. Monorepo 根目录

| 文件                  | 说明                                                      |
| --------------------- | --------------------------------------------------------- |
| `package.json`        | 根脚本：`build`、`dev:cli/server/web`、`test`、`test:run` |
| `pnpm-workspace.yaml` | `packages/*`                                              |
| `tsconfig.base.json`  | 共享 TS 严格配置                                          |
| `vitest.config.ts`    | 多项目：shared、core、cli、server                         |
| `.gitignore`          | node_modules、dist、.env 等                               |
| `README.md`           | 安装、构建、三进程启动、health curl                       |
| `AGENTS.md`           | 贡献约定（命名、Vitest、架构约束、参考仓库路径）          |

### 2. `@muse-ai/shared`

跨包契约层，Zod schema + 类型导出。

**目录结构：**

```
packages/shared/src/
├── constants/api-paths.ts    # SERVER_API_PATHS、CLI_API_PATHS、DEFAULT_PORTS
├── types/
│   ├── auth.ts               # login/register 请求与响应
│   ├── agent.ts              # AgentDefinition、Persona
│   ├── device.ts             # Device、配对、心跳
│   ├── health.ts             # HealthResponse
│   ├── session.ts            # SessionMeta
│   └── sse-events.ts         # MuseSseEvent、ChatRequest、formatSseData
└── index.ts
```

**默认端口：**

| 服务    | 端口  |
| ------- | ----- |
| Server  | 65435 |
| CLI     | 65433 |
| Web dev | 65434 |

**测试：** `test/constants/api-paths.test.ts`（6 项）

### 3. `@muse-ai/core`

占位包，导出 `CORE_VERSION`。阶段 1 在此封装 pi `AgentHarness`。

**测试：** `test/index.test.ts`（1 项）

### 4. `@muse-ai/cli`

本地命令 `muse`，daemon 基于 **Hono** + `@hono/node-server`。

| 路径/命令       | 说明                                |
| --------------- | ----------------------------------- |
| `muse start`    | 启动 daemon，默认 `127.0.0.1:65433` |
| `GET /health`   | 健康检查                            |
| `GET /agents`   | 占位，返回 `{ agents: [] }`         |
| `GET /sessions` | 占位，返回 `{ sessions: [] }`       |

**环境变量：**

| 变量                | 说明                                        |
| ------------------- | ------------------------------------------- |
| `MUSE_CLI_HOST`     | 监听地址，默认 `127.0.0.1`                  |
| `MUSE_CLI_PORT`     | 端口，默认 `65433`                          |
| `MUSE_CORS_ORIGINS` | 逗号分隔，默认允许 `http://localhost:65434` |

**测试：** `test/daemon/server.test.ts`（3 项）

### 5. `@muse-ai/server`

Backend API，Docker Compose 放在本包内。

**`docker-compose.yml`：** Postgres 16 + Redis 7，默认账号 `muse/muse`，库名 `muse`。

**API（阶段 0）：**

| 方法 | 路径          | 说明                                   |
| ---- | ------------- | -------------------------------------- |
| GET  | `/health`     | 健康检查                               |
| POST | `/auth/login` | stub：校验 Zod 后返回固定 `stub-token` |
| GET  | `/devices`    | 占位，返回 `{ devices: [] }`           |

**配置：** `packages/server/.env.example`（`PORT`、`DATABASE_URL`、`REDIS_URL`）

**测试：** `test/app.test.ts`（4 项）

### 6. `@muse-ai/web`

Vite 7 + React 19 占位页，展示 Backend URL 与 CLI 默认端口。

**环境变量：** `VITE_BACKEND_URL`（见 `packages/web/.env.example`）

阶段 4 再接入聊天 UI；当前仅验证构建与 env 读取。

### 7. 文档

| 文档                | 说明                                |
| ------------------- | ----------------------------------- |
| `docs/protocols.md` | Server/CLI REST 与 SSE 事件 v0 草案 |
| `docs/v0.1/`        | 本目录，按阶段记录交付              |

---

## 验收

```bash
pnpm install
pnpm build
pnpm test:run          # 14 tests passed

cd packages/server && docker compose up -d

pnpm dev:server        # 终端 1
pnpm dev:cli           # 终端 2
pnpm dev:web           # 终端 3

curl http://127.0.0.1:65435/health
# {"ok":true,"service":"server","version":"0.0.0"}

curl http://127.0.0.1:65433/health
# {"ok":true,"service":"cli","version":"0.0.0"}
```

---

## 未做 / 留到后续阶段

- pi AgentHarness 集成（阶段 1）
- `~/.muse` 本地目录与 Session JSONL（阶段 1）
- 真实鉴权、Postgres/Redis 连接（阶段 3）
- Web 聊天与 SSE 客户端（阶段 4）
- ESLint / Prettier / husky / lint-staged（阶段 1 已完成）

---

## 下一阶段

见 [phase-1.md](./phase-1.md)：工具链、`MuseHarness` 骨架、内置 tools、`POST /sessions` + `GET /sessions/:id/events`（完整 curl 对话收流见阶段 3）。
