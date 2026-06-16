# API 与 SSE 协议（v0 草案）

> 阶段 0 定稿首版契约。实现以 `@muse-ai/shared` 中的 Zod schema 为准。

## Server REST

Base URL：`http://127.0.0.1:65435`（默认）

| 方法     | 路径                       | 说明                        |
| -------- | -------------------------- | --------------------------- |
| GET      | `/health`                  | 健康检查                    |
| POST     | `/auth/login`              | 登录（阶段 0 stub）         |
| POST     | `/auth/register`           | 注册（阶段 3）              |
| GET      | `/devices`                 | 设备列表                    |
| GET      | `/devices/:id/credentials` | 设备直连凭证（user JWT）    |
| POST     | `/devices/pair`            | CLI 配对                    |
| POST     | `/devices/heartbeat`       | CLI 心跳 + endpoint 注册    |
| GET/POST | `/providers`               | LLM Provider 管理（阶段 3） |
| POST     | `/v1/chat/completions`     | LLM 代理（阶段 3）          |

### GET /health

响应：

```json
{ "ok": true, "service": "server", "version": "0.0.0" }
```

### POST /auth/login

请求：

```json
{ "email": "user@example.com", "password": "password123" }
```

响应（阶段 0 stub）：

```json
{
  "accessToken": "…",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

---

## CLI REST

Base URL：由 Backend 设备列表返回的 `endpoint`，默认 `http://127.0.0.1:65433`

鉴权：`Authorization: Bearer <device-access-token>`

| 方法 | 路径                   | 说明                                 |
| ---- | ---------------------- | ------------------------------------ |
| GET  | `/health`              | 健康检查                             |
| GET  | `/agents`              | 本地 agent 列表                      |
| GET  | `/sessions`            | Session 列表                         |
| POST | `/sessions`            | 创建 Session（阶段 1）               |
| POST | `/chat`                | 发起对话（阶段 1 骨架，阶段 3 接通） |
| GET  | `/sessions/:id/events` | 按 Session 的 SSE 事件流（阶段 1）   |

### GET /health

响应：

```json
{ "ok": true, "service": "cli", "version": "0.0.0" }
```

---

## SSE 事件（CLI → Web）

Content-Type：`text/event-stream`

每条事件一行 JSON：

```
data: {"type":"text_delta","delta":"你好"}

```

### 事件类型

| type             | 字段                                           | 说明                 |
| ---------------- | ---------------------------------------------- | -------------------- |
| `agent_start`    | —                                              | 一轮 agent 开始      |
| `turn_start`     | —                                              | 单 turn 开始         |
| `text_delta`     | `delta`                                        | 流式正文             |
| `thinking_delta` | `delta`                                        | 流式推理（thinking） |
| `tool_start`     | `toolCallId`, `toolName`, `args`               | 工具开始             |
| `tool_end`       | `toolCallId`, `toolName`, `result`, `isError?` | 工具结束             |
| `turn_end`       | —                                              | turn 结束            |
| `agent_end`      | —                                              | agent 结束           |
| `error`          | `message`                                      | 错误                 |

定义见 `packages/shared/src/types/sse-events.ts` 的 `museSseEventSchema`。

### POST /chat（阶段 1）

请求：

```json
{
  "sessionId": "uuid",
  "message": "你好",
  "mode": "prompt"
}
```

`mode`：`prompt` | `steer` | `follow_up`

`agentId` 可省略：使用 `~/.muse/config.json` 的 `activeAgentId`，再回退内置「通用助手」。

---

## 数据模型摘要

- **Device**：`id`, `name`, `endpoint?`, `online`, `lastSeenAt?`
- **AgentDefinition**：`id`, `name`, `personaId`, `skillIds[]`, …
- **SessionMeta**：`id`, `agentId`, `name?`, `createdAt`, `updatedAt`

完整 Zod 定义：`packages/shared/src/types/`。
