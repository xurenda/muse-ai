# 架构设计

## 总览

```mermaid
flowchart LR
    subgraph Web["Web 前端"]
        Chat[聊天 / Session UI]
        Settings[设置 / 设备]
    end

    subgraph Backend["Backend（Docker Compose）"]
        Auth[账号 / JWT]
        Provider[LLM Provider 代理]
        Device[设备注册 / 端点目录]
    end

    subgraph CLI["CLI（用户机器 / 云服务器）"]
        Daemon[HTTP + SSE]
        Harness[AgentHarness]
        Store["~/.muse 本地存储"]
    end

    Chat -->|"① SSE/HTTP 直连"| Daemon
    Settings --> Auth
    Settings --> Device
    Daemon --> Harness
    Harness --> Store
    Harness -->|"② LLM 请求"| Provider
    Daemon -->|"③ 登录 / 心跳 / 注册端点"| Auth
    Provider -->|"④ 转发至 OpenAI 等"| LLM[(LLM API)]
```

**三条数据路径（已拍板）：**

| 路径      | 走哪                         | 原因                                                         |
| --------- | ---------------------------- | ------------------------------------------------------------ |
| 聊天流    | Web → **CLI 直连** SSE       | 低延迟，不经 Backend 转发                                    |
| LLM 调用  | CLI → Backend → Provider     | API Key 统一在后端，CLI 不存 Key                             |
| 账号/设备 | Web → Backend；CLI → Backend | 登录、设备目录（配对/registry）；**不**参与聊天 runtime 状态 |

Backend **不转发**聊天 SSE；只提供 CLI 的 **endpoint 目录** 和 **鉴权 token**，Web 选中设备后直连 CLI。

### 两条连接通道（runtime vs registry）

| 通道         | 路径         | 用途                                                  | 谁消费                       | 时效                                                  |
| ------------ | ------------ | ----------------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| **Runtime**  | Web ↔ CLI    | 聊天 SSE/REST、Session、Agents、底栏「CLI 可达」      | 全局（除 `/devices` 弱提示） | **高**（Web 长连 `GET /device/events`；指数退避重连） |
| **Registry** | CLI → Server | 配对、endpoint 注册、设备目录 `online` / `lastSeenAt` | 主要 **`/devices`**          | **低**（30s 心跳；启停各上报一次）                    |

- Web 底栏与侧栏 **只看 Runtime**（设备 SSE），不读 Server 的 `device.online`。
- `/devices` 列表的「目录在线/离线」来自 Registry；**连接设备**以 Web→CLI 设备 SSE 为准。
- CLI 启动立即 `online: true`；优雅退出（SIGINT/SIGTERM）上报 `online: false`。

---

## 已拍板决策

| 议题         | 决策                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| Web 连 CLI   | 直连 SSE/HTTP，不经 Backend 转发                                                                      |
| Session 存储 | 只在 CLI 本地（`~/.muse/sessions/`）                                                                  |
| MCP 第一期   | 不做通用 MCP 框架；`~/.muse/mcps/` 占位；Tools 内置在 CLI 代码                                        |
| npm 包名     | `@muse-ai/cli`，本地命令 `muse`                                                                       |
| 本地开发     | CLI + Web 用 `pnpm dev`；Backend 用 Docker Compose                                                    |
| Agent 运行时 | `@earendil-works/pi-agent-core` 的 **AgentHarness** + `@earendil-works/pi-ai`（不用 pi-coding-agent） |

---

## Web 直连 CLI：可行性与技术要点

### 结论

**可行。** Web 直连本地或远程 CLI 都是合理架构；Backend 能「连上」CLI 不等于 Web 自动能连——两者场景不同，但远程 CLI 同样可以做到 Web 直连。

### 本地 CLI（最常见）

Web 与 CLI 在同一台机器：

```
Web (localhost:65434) ──► CLI (localhost:65433)
```

难点少：CORS 允许 dev origin、配对 token 校验即可。

### 远程 CLI（云服务器 / 另一台电脑）

Web 在浏览器里，CLI 在远程机器：

```
Web (https://app.example.com) ──► CLI (https://cli-user.example.com:65433)
         ▲
         └── Backend 只返回 { endpoint, accessToken }，不转发流
```

**Backend 连 CLI vs Web 连 CLI：**

| 方式          | 典型做法                                            | NAT 友好                  |
| ------------- | --------------------------------------------------- | ------------------------- |
| Backend → CLI | CLI **主动** HTTP 心跳注册 endpoint（非 WebSocket） | ✅ CLI 在内网也行         |
| Web → CLI     | 浏览器 **主动**连 CLI 的 HTTP 地址                  | ⚠️ 浏览器必须能访问该地址 |

Backend 通过「CLI 出站长连」知道设备在线；Web 仍需一个**浏览器可达**的 CLI 地址。两者不矛盾：

1. CLI 启动后向 Backend 注册：`{ deviceId, endpoint, accessToken }`
2. `endpoint` 可以是公网 IP:端口、域名、Tailscale Serve URL、Cloudflare Tunnel 等
3. Web 从 Backend 拉设备列表，选中设备后用 `endpoint + token` 直连 SSE

### 主要技术难点

| 难点                 | 说明                                                              | 应对                                                                                                                           |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **浏览器可达性**     | 家里/NAT 后的 CLI，外网 Web 无法直接访问                          | 云 VM 公网端口、Tailscale Serve、CF Tunnel；或第一期仅支持同机/局域网                                                          |
| **HTTPS / 混合内容** | Web 是 HTTPS 时，浏览器会拦截对 `http://` CLI 的请求              | 远程 CLI 需 HTTPS（反向代理 / tunnel 自带 HTTPS）；本地 dev 可用 HTTP                                                          |
| **CORS**             | 跨域 SSE 需 CLI 返回正确 CORS 头                                  | CLI daemon 配置 `Access-Control-Allow-Origin`（允许 Web 域名）                                                                 |
| **鉴权**             | 直连不能把 API Key 给 Web；需证明「这个浏览器用户有权控这个 CLI」 | 配对时 Backend 签发 **device-scoped token**；CLI 校验 `Authorization: Bearer <token>`                                          |
| **在线状态**         | `/devices` 需目录级 online；聊天需 runtime 可达                   | **Registry**：CLI→Server 心跳（30s，启停各一次）；**Runtime**：Web 长连 CLI `GET /device/events`（30s ping；断线指数退避重连） |
| **多设备**           | 一个账号多台 CLI                                                  | Backend 存多设备 endpoint；Web 让用户选择连哪台                                                                                |

### 第一期建议

- **必做**：同机 localhost 直连 + 局域网 IP 直连
- **文档预留**：远程 CLI 的 endpoint 注册与 HTTPS 要求
- **可选（阶段 5）**：Cloudflare Tunnel / Tailscale 一键脚本

---

## CLI 内部结构

```
packages/cli/
├── daemon/          # HTTP 服务器、SSE、CORS、鉴权中间件
├── harness/         # MuseHarness（封装 AgentHarness）
├── tools/           # 内置 tools（参考 pi-coding-agent：read、ls、bash、write、edit…，见阶段 4）
├── assets/          # 内置 personas、skills
└── commands/        # muse start | login | agent | …

~/.muse/
├── config.json      # Backend URL、deviceId、本地 token 等
├── agents/          # 组装好的 agent 定义
├── personas/
├── skills/
├── mcps/            # 第一期仅占位
└── sessions/        # JSONL session 文件
```

### MuseHarness 封装职责

- 固定 `NodeExecutionEnv`、`JsonlSessionStorage`
- 从 Agent 定义加载 Persona + Skills + active tools
- LLM 请求走 Backend Provider 代理（`getApiKey` 回调指向 Backend）
- 暴露 subscribe 事件供 SSE 转发

---

## Backend 内部结构（规划）

```
packages/server/
├── docker-compose.yml   # Postgres、Redis（仅 server 包使用）
├── auth/                # 注册、登录、JWT
├── provider/            # Provider CRUD、加密存 Key、代理转发
├── device/              # CLI 配对、endpoint 注册、心跳
└── market/              # 后期：Persona/Skill 市场
```

CLI 调 Backend 的典型接口：

| 接口                        | 用途                                 |
| --------------------------- | ------------------------------------ |
| `POST /auth/login`          | 用户登录                             |
| `POST /devices/pair`        | 配对码换 device token                |
| `POST /devices/heartbeat`   | 上报 online + endpoint               |
| `POST /v1/chat/completions` | LLM 代理（兼容 OpenAI 格式或自定义） |

---

## Web 内部结构（规划）

```
packages/web/
├── pages/
│   ├── chat/        # 聊天 + SSE 客户端（直连 CLI endpoint）
│   ├── sessions/    # Session 列表/树（数据来自 CLI API）
│   ├── agents/      # Agent 组装
│   └── settings/    # Provider、设备、主题
└── api/             # 仅调 Backend（不经过 Backend 聊天气）
```

---

## SSE 事件协议（概要）

对齐 pi `AgentEvent` 子集，CLI SSE 推送 JSON 行：

```typescript
// packages/shared/src/events.ts（规划）
type MuseSSEEvent =
  | { type: 'agent_start' }
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; toolName: string; args: unknown }
  | { type: 'tool_end'; toolName: string; result: unknown }
  | { type: 'turn_end' }
  | { type: 'agent_end' }
  | { type: 'error'; message: string }
```

Web `POST` 到 CLI 发起对话，`GET /sessions/:id/events` 收 Session 流。详细 schema 见 `packages/shared/src/types/sse-events.ts`。

### 设备级 SSE（`/device/events`）

与 Session 聊天 SSE **独立**的长连接；Web 选中设备后建立，用于底栏「CLI 可达」与 Session 列表刷新：

| 事件                       | 说明                                                    |
| -------------------------- | ------------------------------------------------------- |
| `connected`                | 首包，含 `endpoint`                                     |
| `ping`                     | 每 30s 保活                                             |
| `shutting_down`            | CLI 优雅退出前广播                                      |
| `session_registry_changed` | Session 增删改（`reason`: created / deleted / renamed） |

断线后 Web 侧 **指数退避**（1s 起，上限 30s）重连；底栏展示倒计时与「立即重连」。Tab 关闭即断开，新 Tab 新建连接即可。

Schema：`packages/shared/src/types/device-sse-events.ts`。

---

## 安全边界

| 层           | 策略                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| CLI Tools    | 阶段 4 参考 pi-coding-agent 实现；`bash` 限制 cwd、超时；敏感路径可后续加 denylist |
| Device Token | 短期 JWT + 可撤销；仅用于 Web→CLI，不含 LLM Key                                    |
| LLM Key      | 仅存 Backend 加密字段；CLI 只有 user/device 凭证                                   |
| Session 数据 | 不出 CLI 磁盘（第一期）；用户自行备份 `~/.muse`                                    |

---

## 本地开发方式

```bash
# Terminal 1 — 后端依赖（Postgres、Redis）
cd packages/server && docker compose up -d

# Terminal 2 — CLI
pnpm --filter @muse-ai/cli dev
muse login
muse start

# Terminal 3 — Web
pnpm --filter @muse-ai/web dev
```

Web 环境变量示例：`VITE_BACKEND_URL=http://localhost:65435`（Backend）、CLI 地址从设备 API 动态获取，不写死。
