# API 与 SSE 协议

> 实现以 `@museai/shared` 中的 Zod schema 与 `CLI_API_PATHS` / `SERVER_API_PATHS` 为准。  
> v0.2 增量：市场 REST、CLI 市场路由、注册用户名、设备 SSE `market_installed`。

## Server REST

Base URL：`http://127.0.0.1:65435`（默认）

### 通用

| 方法     | 路径                       | 鉴权         | 说明                  |
| -------- | -------------------------- | ------------ | --------------------- |
| GET      | `/health`                  | —            | 健康检查              |
| POST     | `/auth/login`              | —            | 登录                  |
| POST     | `/auth/register`           | —            | 注册（含 `username`） |
| POST     | `/auth/refresh`            | —            | 刷新 access token     |
| GET      | `/devices`                 | user JWT     | 设备列表              |
| GET      | `/devices/:id/credentials` | user JWT     | 设备直连凭证          |
| POST     | `/devices/pair/init`       | user JWT     | 生成配对码            |
| POST     | `/devices/pair`            | —            | CLI 提交配对码        |
| POST     | `/devices/heartbeat`       | device token | CLI 目录心跳          |
| GET/POST | `/settings/*`              | user JWT     | Provider / 模型策略等 |
| POST     | `/v1/chat/completions`     | device token | LLM 代理（CLI 转发）  |

### 市场（v0.2）

Base：`/market`。**读接口均需 user JWT**（未登录 `401`）。

`packageId` 含 `/` 时使用通配路径，段需 `encodeURIComponent`（如 `museai/basic-kit` → `museai%2Fbasic-kit` 由客户端拼路径）。

| 方法 | 路径                             | 鉴权                     | 说明                                    |
| ---- | -------------------------------- | ------------------------ | --------------------------------------- |
| GET  | `/market/packages`               | user JWT                 | 列表；`?kind=&q=&author=`               |
| GET  | `/market/packages/*`             | user JWT                 | 详情 + 版本列表 + manifest              |
| POST | `/market/packages/*/install-url` | user JWT 或 device token | 返回 `downloadUrl`、`version`、`sha256` |
| GET  | `/market/download/*/:version`    | device token             | 下载 `.musepack` blob                   |

#### GET /market/packages

响应示例：

```json
{
  "packages": [
    {
      "id": "museai/basic-kit",
      "kind": "kit",
      "name": "MuseAI 基础套件",
      "description": "…",
      "author": "museai",
      "status": "published",
      "latestVersion": "1.0.0",
      "updatedAt": "2026-06-25T00:00:00.000Z"
    }
  ]
}
```

#### POST /market/packages/\*/install-url

请求（可选指定版本）：

```json
{ "version": "1.0.0" }
```

响应：

```json
{
  "packageId": "museai/basic-kit",
  "version": "1.0.0",
  "sha256": "…64 hex…",
  "downloadUrl": "http://127.0.0.1:65435/market/download/museai/basic-kit/1.0.0"
}
```

### POST /auth/register（v0.2）

请求：

```json
{
  "email": "user@example.com",
  "password": "password123",
  "username": "kingen"
}
```

`username` 保留名或已占用 → `409` + `{ "error": "username_taken" }`。

### GET /health

```json
{ "ok": true, "service": "server", "version": "0.0.0" }
```

---

## CLI REST

Base URL：设备 `endpoint`（默认 `http://127.0.0.1:65433`）

鉴权：已配对时 `Authorization: Bearer <device-access-token>`；未配对开发模式可放行。

### Session / 聊天

| 方法 | 路径                   | 说明                        |
| ---- | ---------------------- | --------------------------- |
| GET  | `/health`              | 健康检查                    |
| GET  | `/device/events`       | 设备级 SSE                  |
| GET  | `/agents`              | Agent 列表                  |
| POST | `/agents`              | 创建 Agent                  |
| GET  | `/personas`            | Persona 列表（含 `source`） |
| GET  | `/skills`              | Skill 列表（含 `source`）   |
| GET  | `/tools`               | 内置工具描述                |
| GET  | `/sessions`            | Session 列表                |
| POST | `/sessions`            | 创建 Session                |
| POST | `/chat`                | 发起对话（202）             |
| GET  | `/sessions/:id/events` | Session SSE                 |

### 市场（v0.2）

| 方法 | 路径                | 说明                                 |
| ---- | ------------------- | ------------------------------------ |
| GET  | `/market/installed` | 本机 `~/.muse/market/installed.json` |
| POST | `/market/install`   | body: `{ "packageId", "version?" }`  |
| POST | `/market/uninstall` | body: `{ "packageId" }`              |
| POST | `/market/update`    | body: `{ "packageId" }`              |

安装成功响应：

```json
{ "packageId": "museai/basic-kit", "version": "1.0.0", "action": "installed" }
```

错误码（节选）：

| HTTP | error                           | 说明                                               |
| ---- | ------------------------------- | -------------------------------------------------- |
| 401  | `device_not_paired`             | 未配对，无法从 Backend 安装                        |
| 404  | `package_not_installed`         | 卸载/更新时包未安装                                |
| 409  | `agents_reference_conflict`     | 卸载时仍有 Agent 引用；body 含 `conflictingAgents` |
| 409  | `basic_kit_uninstall_forbidden` | 不可卸载 `museai/basic-kit`                        |

#### GET /personas、GET /skills 增量字段

```json
{
  "id": "museai/basic-kit/git",
  "name": "Git 工作流",
  "description": "…",
  "source": "market"
}
```

`source`：`local` | `market`（`local/` 前缀为 `local`；目录存在 `.muse-origin.json` 为 `market`）。

---

## SSE

### Session 聊天（CLI → Web）

`GET /sessions/:id/events`，`Content-Type: text/event-stream`

```
data: {"type":"text_delta","delta":"你好"}
```

| type             | 字段                                           | 说明         |
| ---------------- | ---------------------------------------------- | ------------ |
| `agent_start`    | —                                              | 一轮开始     |
| `turn_start`     | —                                              | 单 turn 开始 |
| `text_delta`     | `delta`                                        | 流式正文     |
| `thinking_delta` | `delta`                                        | 流式推理     |
| `tool_start`     | `toolCallId`, `toolName`, `args`               | 工具开始     |
| `tool_end`       | `toolCallId`, `toolName`, `result`, `isError?` | 工具结束     |
| `turn_end`       | —                                              | turn 结束    |
| `agent_end`      | —                                              | 一轮结束     |
| `error`          | `message`                                      | 错误         |

Schema：`packages/shared/src/types/sse-events.ts` → `museSseEventSchema`。

### 设备级（CLI → Web）

`GET /device/events`

| type                       | 字段                              | 说明                |
| -------------------------- | --------------------------------- | ------------------- |
| `connected`                | `endpoint`, `service`, `version?` | 连接成功            |
| `ping`                     | —                                 | 保活                |
| `shutting_down`            | —                                 | daemon 关闭         |
| `session_registry_changed` | `reason?`                         | Session 列表变更    |
| `market_installed`         | `packageId`, `version`, `action`  | 市场包安装/更新完成 |

Schema：`packages/shared/src/types/device-sse-events.ts` → `deviceSseEventSchema`。

### POST /chat

```json
{
  "sessionId": "uuid",
  "message": "你好",
  "mode": "prompt"
}
```

`mode`：`prompt` | `steer` | `follow_up`。接受时返回 `202` + `{ "accepted": true }`。

---

## 数据模型摘要

- **Device**：`id`, `name`, `endpoint?`, `online`, `lastSeenAt?`
- **AgentDefinition**：`id`, `name`, `personaId`, `skillIds[]`, `activeToolNames[]`, …
- **SessionMeta**：`id`, `agentId`, `name?`, `createdAt`, `updatedAt`
- **MarketPackageSummary** / **InstalledPackagesFile**：见 `packages/shared/src/types/market.ts`、`market-api.ts`

完整 Zod：`packages/shared/src/types/`。

---

## 相关文档

- 市场产品设计：[v0.2/market.md](./v0.2/market.md)
- 本地联调与市场验收：[development-guide.md](./development-guide.md#市场-v1-端到端验收)
