# MuseAI

可组装的 personal AI agent 平台。本地 CLI 运行 agent，Web 交互，Server 管理账号与 LLM Provider。

- 产品文档：[docs/README.md](./docs/README.md)
- **开发指南**：[docs/development-guide.md](./docs/development-guide.md)（三进程联调、排错、远程 CLI）
- 贡献约定：[AGENTS.md](./AGENTS.md)

## 环境要求

- Node.js >= 22.19.0
- pnpm >= 10
- Docker（仅 Server 依赖：Postgres、Redis）

## 开发环境

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量（首次）

```bash
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env
# 可选：cp packages/cli/.env.example packages/cli/.env
```

`packages/server/.env` 开发环境可直接使用示例值；`packages/web/.env` 默认指向 `http://127.0.0.1:65435`。CLI 环境变量见 [packages/cli/.env.example](./packages/cli/.env.example) 与开发指南。

### 3. 启动 Postgres / Redis

仅 Server 需要 Docker：

```bash
cd packages/server && docker compose up -d && cd ../..
```

### 4. 启动三个进程

需要 **3 个终端**，均在仓库根目录执行：

| 终端 | 命令              | 说明                                                           |
| ---- | ----------------- | -------------------------------------------------------------- |
| 1    | `pnpm dev:server` | 后端 API，默认 `http://127.0.0.1:65435`                        |
| 2    | `pnpm dev:cli`    | CLI daemon（等同 `muse start`），默认 `http://127.0.0.1:65433` |
| 3    | `pnpm dev:web`    | Web 前端，默认 `http://127.0.0.1:65434`                        |

浏览器打开：**http://127.0.0.1:65434**

### 5. 首次使用

1. 在 Web 注册 / 登录
2. 进入「设备」页生成配对码
3. 另开终端执行：`pnpm muse pair <配对码>`
4. 在 Web「Provider 设置」配置 LLM API Key 后，即可开始聊天
5. （可选）侧栏「市场」浏览官方套件；设备在线后可安装/更新

> 修改 `packages/server/.env`（如 CORS）或 Server 代码后，需重启 `pnpm dev:server`。  
> Server 首次启动会从 `@museai/basic-kit` 构建并种子 `museai/basic-kit` 市场包（blob 落盘 `packages/server/data/market/`，已 gitignore）。

## 快速开始

```bash
# 编译所有包
pnpm build

# 单元测试
pnpm test:run

# 构建 official basic-kit .musepack（CI 与 Server 种子同源）
pnpm pack:basic-kit

# 代码检查与格式化
pnpm lint
pnpm format:check
```

开发日常只需按上文「开发环境」启动，不必每次 `pnpm build`。修改 `packages/shared` 后需 `pnpm --filter @museai/shared build`，详见开发指南。

## 远程 CLI（摘要）

Web 聊天 **直连 CLI**，不经 Server 转发 SSE。配对时 CLI 上报的 **endpoint 必须是浏览器能访问的地址**（局域网请设 `MUSE_CLI_HOST` 为本机 LAN IP，勿用 `127.0.0.1` 代填）。还需配置 CLI / Server 的 `MUSE_CORS_ORIGINS` 与 Web 的 `VITE_BACKEND_URL`。

完整步骤（LAN 验收、HTTPS 限制、Tailscale 示例）：**[docs/development-guide.md](./docs/development-guide.md#远程-cli-与局域网)**。

## 健康检查

```bash
curl http://127.0.0.1:65435/health   # server
curl http://127.0.0.1:65433/health   # cli
```

## 包说明

| 包                  | 说明                                         |
| ------------------- | -------------------------------------------- |
| `@museai/shared`    | 类型、API 路径、SSE 协议、市场 schema        |
| `@museai/basic-kit` | 官方 `museai/basic-kit` 资产与 musepack 构建 |
| `@museai/core`      | Agent 组装（阶段 1）                         |
| `@museai/cli`       | `muse` 命令与 daemon                         |
| `@museai/server`    | 后端 API + docker-compose                    |
| `@museai/web`       | Web 前端                                     |

## 参考仓库（本机）

| 项目      | 路径                           |
| --------- | ------------------------------ |
| pi        | `/Users/kingen/code/pi`        |
| Paperclip | `/Users/kingen/code/paperclip` |
