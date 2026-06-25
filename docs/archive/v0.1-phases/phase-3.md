# 阶段 3：Backend 控制面

**状态**：✅ 已完成  
**完成日期**：2026-06-15  
**Commit**：`754b06c`  
**预估周期**：~2 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

账号、LLM Provider、CLI 设备配对与心跳；API Key 存 Backend，CLI 经 Server 代理调模型；**接通阶段 1 的 `POST /chat` + SSE，完成终端/curl 真实 LLM 验证**。

---

## 任务清单

- [x] 用户注册/登录（JWT）
- [x] LLM Provider CRUD（加密存 API Key）
- [x] Provider 代理：`POST /v1/chat/completions`
- [x] Device 配对（配对码）+ CLI 心跳
- [x] `GET /devices` 设备列表（含 online/offline）
- [x] Server 接入 Postgres / Redis
- [x] `POST /chat` 接通 `MuseHarness` + Backend LLM 代理
- [x] CLI 鉴权 middleware（Bearer device-token）
- [x] `muse chat` / `muse pair` 命令
- [x] 端到端验收（真实 Provider + 重启续聊）

---

## 设计决策

| 项          | 决策                                                                                   |
| ----------- | -------------------------------------------------------------------------------------- |
| ORM         | **Drizzle** + 启动时 `CREATE TABLE IF NOT EXISTS`                                      |
| Provider    | 第一期仅 **OpenAI 兼容**（`baseUrl` + `apiKey`）                                       |
| Key 加密    | `ENCRYPTION_KEY`（32 字节 hex）+ **AES-256-GCM**                                       |
| 配对        | Web `POST /devices/pair/init` → CLI `muse pair <code>`；Redis TTL 10 分钟              |
| CLI 鉴权    | `/health` 公开；**已配对**后其余路由需 Bearer；**未配对**时放行并警告                  |
| LLM 路径    | CLI Harness → `http://server/v1` 代理 → Provider（CLI 不存 Key）                       |
| `muse chat` | 单次：`muse chat <消息>`，自动建 session 并打印 SSE                                    |
| 无 Provider | SSE `error` 硬失败，文案指引去配置 Provider                                            |
| 默认模型    | 内置 Persona 改为 `openai/deepseek-v4-flash`（通用）、`openai/deepseek-v4-pro`（编程） |

---

## 实际产出

### 1. `@muse-ai/server` — 控制面

**依赖：** Postgres、Redis、Drizzle、`jose`（JWT）、`bcryptjs`、`dotenv`

**目录：**

```
packages/server/src/
├── db/schema.ts          # users、providers、devices
├── db/client.ts          # 连接池 + 建表 SQL
├── crypto/aes-gcm.ts     # Provider apiKey 加解密
├── services/
│   ├── auth-service.ts   # 注册/登录/JWT
│   ├── provider-service.ts
│   ├── device-service.ts # 配对码、心跳、在线状态
│   └── llm-proxy-service.ts
├── middleware/           # user JWT、device token
├── routes/               # auth、devices、providers、llm-proxy
└── app.ts                # createServerContext + 路由挂载
```

**Server API（增量）：**

| 方法                | 路径                   | 鉴权         | 说明                    |
| ------------------- | ---------------------- | ------------ | ----------------------- |
| POST                | `/auth/register`       | —            | 注册                    |
| POST                | `/auth/login`          | —            | 登录（替换阶段 0 stub） |
| GET/POST/PUT/DELETE | `/providers`           | user JWT     | Provider CRUD           |
| POST                | `/devices/pair/init`   | user JWT     | 生成 6 位配对码         |
| POST                | `/devices/pair`        | —            | CLI 提交配对码          |
| POST                | `/devices/heartbeat`   | device token | 心跳 + endpoint         |
| GET                 | `/devices`             | user JWT     | 设备列表 + `online`     |
| POST                | `/v1/chat/completions` | device token | OpenAI 兼容代理         |

**环境变量：** `packages/server/.env.example`（`JWT_SECRET`、`ENCRYPTION_KEY`、`DATABASE_URL`、`REDIS_URL`）

**测试：** `test/app.test.ts`（mock 依赖）、`test/crypto/aes-gcm.test.ts`

### 2. `@muse-ai/shared`（本阶段增量）

| 变更                                 | 说明                     |
| ------------------------------------ | ------------------------ |
| `types/provider.ts`                  | Provider CRUD schema     |
| `types/pair.ts`                      | `pairInitResponseSchema` |
| `SERVER_API_PATHS.DEVICES_PAIR_INIT` | Web 发起配对             |

### 3. `@muse-ai/core`（本阶段增量）

| 模块                | 变更                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| `muse-harness.ts`   | 暴露 `prompt` / `steer` / `followUp`                                             |
| `harness-events.ts` | `mapHarnessEventToSse`（含 `thinking_delta` → `text_delta`）                     |
| `agent-registry.ts` | `parseModelRef` 支持 OpenAI 兼容自定义 model id；默认 `openai/deepseek-v4-flash` |

### 4. `@muse-ai/cli` — 接通 Backend

**`~/.muse/config.json` 增量：**

| 字段                       | 说明               |
| -------------------------- | ------------------ |
| `backendUrl`               | Server 根 URL      |
| `deviceId` / `deviceToken` | `muse pair` 后写入 |

**新增命令：**

| 命令                                        | 说明                               |
| ------------------------------------------- | ---------------------------------- |
| `muse pair <code> [--name …] [--backend …]` | 配对并保存 token                   |
| `muse chat <消息>`                          | 建 session、订阅 SSE、打印流式回复 |

**Daemon 变更：**

| 模块                        | 变更                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `chat-service.ts`           | 占位 SSE → 真实 `MuseHarness` + Server 代理                              |
| `backend/llm-auth.ts`       | `getApiKeyAndHeaders` 用 device token；`model.baseUrl` 指向 Server `/v1` |
| `daemon/auth-middleware.ts` | 已配对时校验 Bearer                                                      |
| `daemon/heartbeat.ts`       | 启动后每 30s 心跳                                                        |
| `daemon/server.ts`          | 配对后启动心跳；受保护路由挂鉴权                                         |

**测试：** `test/daemon/server.test.ts` 扩展（未配对错误、鉴权等）；共 **41** tests

### 5. 数据流（本阶段打通）

```
Web/API 配 Provider（加密存 Postgres）
        ↓
CLI muse pair → device token 写入 ~/.muse
        ↓
POST /chat → MuseHarness → Server /v1/chat/completions → DeepSeek 等
        ↓
SSE text_delta → Web / muse chat
```

---

## 验收

```bash
pnpm test:run
# 41 tests passed

# Server + Docker + CLI 运行中；packages/server/.env 已配置

# 注册 & Provider（示例：DeepSeek OpenAI 兼容）
curl -s -X POST http://127.0.0.1:65435/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@muse.ai","password":"password123"}'

curl -s -X POST http://127.0.0.1:65435/providers \
  -H "Authorization: Bearer <user-jwt>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"DeepSeek","apiKey":"sk-...","baseUrl":"https://api.deepseek.com/v1","isDefault":true}'

# 配对
curl -s -X POST http://127.0.0.1:65435/devices/pair/init -H "Authorization: Bearer <user-jwt>"
pnpm muse pair <pairCode>

# 对话（已配对需 Bearer device-token）
pnpm muse chat "你好"

# 设备在线
curl -s http://127.0.0.1:65435/devices -H "Authorization: Bearer <user-jwt>"
# → online: true, endpoint: http://127.0.0.1:65433

# 重启续聊：同一 sessionId 再次 POST /chat，上下文保留（验收 2026-06-15 通过）
```

---

## 未做 / 留到后续阶段

| 能力                     | 阶段 | 说明                               |
| ------------------------ | ---- | ---------------------------------- |
| Web Provider 设置 UI     | 5    | 本阶段用 API/curl 配 Provider      |
| Web 设备列表 UI          | 5    | `GET /devices` API 已就绪          |
| Tools 执行               | 4    | `activeToolNames` 仍为空           |
| SSE 区分 thinking / 正文 | 6    | v4 模型推理流暂合并为 `text_delta` |
| 远程 CLI / Tunnel        | 5+   | 文档预留                           |

---

## 下一阶段

见 [phase-4.md](./phase-4.md)：内置 Tools（read / ls / bash 等），接入 `MuseHarness`。
