# 开发指南

面向在本仓库联调 MuseAI 的贡献者与自用场景。架构背景见 [architecture.md](./architecture.md)；v0.1 已交付能力见 [releases/v0.1.md](./releases/v0.1.md)。

## 环境要求

| 依赖    | 版本 / 说明                       |
| ------- | --------------------------------- |
| Node.js | >= 22.19.0                        |
| pnpm    | >= 10（仓库锁定 `pnpm@10.12.1`）  |
| Docker  | 仅 Server 需要（Postgres、Redis） |

## Monorepo 结构

```
muse-ai/
├── AGENTS.md              # AI / 贡献者约定
├── packages/
│   ├── shared/            # @muse-ai/shared — 类型、API 路径、SSE 协议、i18n
│   ├── core/              # @muse-ai/core — MuseHarness、Session、资产加载
│   ├── server/            # @muse-ai/server — 后端 + docker-compose.yml
│   ├── cli/               # @muse-ai/cli — muse 命令与 HTTP daemon
│   └── web/               # @muse-ai/web — Vite + React 前端
└── docs/                  # 产品与阶段文档
```

**依赖方向**（勿反向引用）：

```
web ──► shared
cli ──► core ──► shared
server ──► shared
```

**约定摘要**：

- 根目录 `package.json` 集中安装 TypeScript、ESLint、Vitest 等共用 devDependencies。
- import 优先 `@/` 别名（各包 `tsconfig` paths 已配置）。
- 单元测试放在各包 `test/`，镜像 `src/` 目录结构。
- 详见 [AGENTS.md](../AGENTS.md)。

## 三进程联调

MuseAI 本地开发需同时运行 **Server、CLI、Web** 三个进程。Web 聊天 **直连 CLI**（SSE/REST），LLM 请求 **CLI → Server → Provider**。

```
浏览器 ──SSE/HTTP──► CLI (65433)          Agent runtime（底栏、聊天、Session）
浏览器 ──HTTP──────► Server (65435)     登录、Provider、/devices
CLI ────HTTP──────► Server (65435)     LLM 代理、**设备目录心跳**（非 Web 底栏）
```

### Runtime vs Registry（两条通道）

| 通道                         | 说明                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| **Web ↔ CLI（Runtime）**     | 聊天、底栏状态、Session 列表；Web 长连 `GET /device/events` + Session SSE                     |
| **CLI → Server（Registry）** | 仅设备目录：`/devices` 配对列表、`online`、`endpoint` 更新；30s 心跳，**启动/退出各上报一次** |

底栏「CLI 可达」来自 **设备 SSE**（非 `/health` 轮询），**不**等 Server 心跳。`/devices` 的「目录在线」仅为 Server 最近是否收到 CLI 注册。

### 1. 安装与配置

```bash
pnpm install

cp packages/server/.env.example packages/server/.env
cp packages/web/.env.example packages/web/.env
# CLI 环境变量见 packages/cli/.env.example（可选，见下文）
```

`packages/server/.env` 开发环境可直接使用示例占位值。`packages/web/.env` 默认 `VITE_BACKEND_URL=http://127.0.0.1:65435`。

### 2. 启动 Postgres / Redis

```bash
cd packages/server && docker compose up -d && cd ../..
```

### 3. 启动三个进程

在仓库根目录开 **3 个终端**：

| 终端 | 命令              | 默认地址                 |
| ---- | ----------------- | ------------------------ |
| 1    | `pnpm dev:server` | `http://127.0.0.1:65435` |
| 2    | `pnpm dev:cli`    | `http://127.0.0.1:65433` |
| 3    | `pnpm dev:web`    | `http://127.0.0.1:65434` |

浏览器打开 **http://127.0.0.1:65434**。

> `pnpm dev:web` 会先执行 `@muse-ai/shared build`，再启动 Vite。日常改 Web 代码无需手动 build shared。

### 4. 首次配对

1. Web 注册 / 登录
2. 「设备」页生成配对码
3. 新终端：`pnpm muse pair <配对码>`（可选 `--name "My Mac"`）
4. 「Provider 设置」配置 LLM API Key
5. 在 Web 选择该设备，进入聊天

配对成功后 CLI 会写入 `~/.muse/config.json`（device token、backend URL），并向 Server 发送**目录心跳**（启动立即 `online`，之后每 30s，退出时 `online: false`）。

### 5. 健康检查

```bash
curl http://127.0.0.1:65435/health   # server
curl http://127.0.0.1:65433/health   # cli
```

## 修改 `@muse-ai/shared` 后

`shared` 产出编译后的 `.js` / `.d.ts`，被 `core`、`cli`、`web` 消费。修改 shared 源码后：

```bash
# 改 types / 协议 / i18n / api-paths 后至少执行一次
pnpm --filter @muse-ai/shared build

# 若改了 core（Harness、Session 等），还需
pnpm --filter @muse-ai/core build
```

**何时必须 rebuild：**

| 改动位置              | 需要 rebuild                | 需重启的进程                |
| --------------------- | --------------------------- | --------------------------- |
| `packages/shared`     | `shared build`              | cli、web（server 通常不用） |
| `packages/core`       | `core build`（依赖 shared） | cli                         |
| `packages/cli` src    | 无（`tsx watch` 热重载）    | 若 watch 未捕获则重启 cli   |
| `packages/web` src    | 无（Vite HMR）              | —                           |
| `packages/server` src | 无（tsx watch）             | server 自动重载             |

跑全量测试前建议 `pnpm build`（根脚本 `test:run` 已包含 build）。

## CLI 环境变量

CLI **不**自动加载 `.env` 文件（与 Server 不同）。可将 `packages/cli/.env.example` 复制为 `packages/cli/.env`，启动前 export：

```bash
set -a && source packages/cli/.env && set +a
pnpm dev:cli
```

| 变量                | 默认                     | 说明                                               |
| ------------------- | ------------------------ | -------------------------------------------------- |
| `MUSE_CLI_HOST`     | `127.0.0.1`              | daemon 监听地址；**同时用于注册 endpoint 的 host** |
| `MUSE_CLI_PORT`     | `65433`                  | daemon 端口                                        |
| `MUSE_CORS_ORIGINS` | `http://localhost:65434` | 允许跨域的 Web 来源，逗号分隔                      |
| `MUSE_HOME`         | `~/.muse`                | 本地数据目录（测试可覆盖）                         |

Server 侧 CORS 由 `packages/server/.env` 的 `MUSE_CORS_ORIGINS` 控制；Web 后端地址由 `VITE_BACKEND_URL` 控制。远程 / 局域网场景三处需一致，见下节。

### endpoint 如何生成

配对与心跳时，CLI 调用 `buildCliEndpoint(host, port)`：

```typescript
// packages/cli/src/backend/client.ts
// host === '0.0.0.0' 时 endpoint 会写成 127.0.0.1（浏览器通常不可达）
// 协议固定为 http://（v0.1）
```

因此：

- **不要**把 `MUSE_CLI_HOST=0.0.0.0` 当作「远程可访问地址」——endpoint 会变成 `http://127.0.0.1:65433`，其他机器上的浏览器无法连接。
- 局域网场景请把 `MUSE_CLI_HOST` 设为 **本机 LAN IP**（如 `192.168.1.100`），配对或心跳后 Backend 存的 endpoint 才是浏览器可达的。
- 修改 `MUSE_CLI_HOST` / `MUSE_CLI_PORT` 后需 **重新配对** 或等待心跳（约 30s）更新 Backend 上的 endpoint。

## 远程 CLI 与局域网

Web 聊天 **不经 Server 转发 SSE**，浏览器必须能直接访问 CLI 的 `endpoint`。设备列表里的 endpoint 来自配对 / 心跳，不是 Server 代填。

### 同机开发（默认）

三进程均在本机，endpoint 为 `http://127.0.0.1:65433`，无需额外配置。

### 局域网（LAN）— v0.1 推荐验收方式

场景：Web 在 A 电脑浏览器，CLI daemon 在 B 电脑（同一 Wi‑Fi / 局域网）。

**B 电脑（跑 CLI）：**

```bash
# 查 LAN IP，例如 192.168.1.100
ipconfig getifaddr en0   # macOS Wi‑Fi

export MUSE_CLI_HOST=192.168.1.100
export MUSE_CLI_PORT=65433
export MUSE_CORS_ORIGINS=http://192.168.1.50:65434,http://127.0.0.1:65434

pnpm dev:cli
pnpm muse pair <配对码> --backend http://192.168.1.50:65435
```

**A 电脑（跑 Server + Web）：**

```bash
# packages/server/.env
# HOST=0.0.0.0          # 若需 LAN 访问 Server
# MUSE_CORS_ORIGINS=http://192.168.1.50:65434,http://192.168.1.100:65434

# packages/web/.env
# VITE_BACKEND_URL=http://192.168.1.50:65435
```

配对成功后，在 Web 设备页确认 endpoint 为 `http://192.168.1.100:65433`（**不是** `127.0.0.1`）。底栏应显示「就绪」，可正常发消息。

**检查清单：**

- [ ] CLI `curl http://192.168.1.100:65433/health` 从 A 电脑可通
- [ ] Web 设备 endpoint 与 CLI 实际地址一致
- [ ] `MUSE_CORS_ORIGINS` 包含浏览器地址栏的 **完整 origin**（含 scheme、host、port）
- [ ] Server `MUSE_CORS_ORIGINS` 包含 Web origin（登录、设备 API）

### HTTPS 与混合内容

若 Web 以 **HTTPS** 部署，浏览器会 **拦截** 对 `http://` CLI 的请求（混合内容）。远程 CLI 也需要 **HTTPS** 入口（反向代理或 Tunnel 自带 TLS）。

v0.1 限制：`buildCliEndpoint` 注册的 URL **固定 `http://`**。生产级 HTTPS 远程 CLI（含 `https://` endpoint）留 **v0.2+**（如 pair 时 `--endpoint` 覆盖）。自用可先：

- 全链路 HTTP（仅 LAN / 本机），或
- Web 与 CLI 均走同一 Tunnel 的 HTTPS 域名（需后续支持自定义 endpoint scheme）。

### Tailscale Serve 示例（可选）

在已安装 Tailscale 的机器上，可将本机 CLI 暴露给 tailnet 内其他设备：

```bash
# CLI 仍监听本机
export MUSE_CLI_HOST=127.0.0.1
pnpm dev:cli

# 另开终端：把 65433 以 HTTPS 暴露到 tailnet（路径依 Tailscale 版本可能略有不同）
tailscale serve --bg --https=65433 http://127.0.0.1:65433
```

Tailscale 会给出类似 `https://<machine>.<tailnet>.ts.net` 的 URL。因 v0.1 endpoint 仍为 `http://127.0.0.1:65433`，**tailnet 外浏览器无法直接使用**；仅 tailnet 内且需手动对齐 endpoint 的场景可参考，完整 HTTPS endpoint 注册待 v0.2。

更通用的公网方案（Cloudflare Tunnel、Nginx 反代等）思路相同：**TLS 终止在代理**，CLI 本机 HTTP；关键是 Backend 存的 endpoint 必须是 **浏览器实际请求的 origin**，v0.1 需 LAN IP + HTTP 验证。

## 常见排错

| 现象                              | 可能原因                                      | 处理                                                    |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Web 底栏「CLI 不可达」            | CLI 未启动或防火墙拦截                        | 确认 CLI 运行；检查 endpoint 与防火墙；底栏「立即重连」 |
| 设备 SSE 断开但会话仍在           | 仅设备长连接断线                              | 等待自动重连或点「立即重连」；Session SSE 独立          |
| 配对成功但聊天连不上              | endpoint 是内网地址，浏览器在另一网络         | 将 `MUSE_CLI_HOST` 设为浏览器可达 IP 后重新 pair        |
| CORS 错误（控制台）               | `MUSE_CORS_ORIGINS` 未含 Web origin           | CLI / Server 的 CORS 都加上浏览器地址栏 origin          |
| 改协议 / schema 后类型报错        | shared 未 rebuild                             | `pnpm --filter @muse-ai/shared build`，重启 cli / web   |
| `pnpm dev:web` 报 shared 导入失败 | 首次 clone 未 build                           | `pnpm --filter @muse-ai/shared build`                   |
| Server 启动失败                   | 缺 `JWT_SECRET` / `ENCRYPTION_KEY` 或 DB 未起 | 检查 `packages/server/.env` 与 `docker compose ps`      |
| 发消息 401                        | 未 pair 或 device token 失效                  | `pnpm muse pair <码>`；Web 重新选设备                   |
| Provider 报错                     | Server 未配置 API Key                         | Web「Provider 设置」                                    |

断线重连、Steer、Compact、用量面板等行为见 [releases/v0.1.md](./releases/v0.1.md) 与 [architecture.md](./architecture.md)。

## 测试与质量

```bash
pnpm lint              # ESLint
pnpm format:check      # Prettier
pnpm test:run          # build + vitest 全量
pnpm typecheck         # 各包 tsc --noEmit

# 单包
pnpm --filter @muse-ai/web test:run
pnpm --filter @muse-ai/cli build
```

提交前 husky + lint-staged 会对 staged 文件自动 fix。

## 相关文档

| 文档                                   | 说明                |
| -------------------------------------- | ------------------- |
| [README.md](../README.md)              | 快速开始            |
| [architecture.md](./architecture.md)   | 三层架构与存储      |
| [protocols.md](./protocols.md)         | REST / SSE 契约     |
| [releases/v0.1.md](./releases/v0.1.md) | v0.1 产品线交付说明 |
| [current-phase.md](./current-phase.md) | 当前版本快照        |
