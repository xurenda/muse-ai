# 阶段 3：Backend 控制面

**状态**：⬜ 未开始  
**预估周期**：~2 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

账号、LLM Provider、CLI 设备配对与心跳；Web 配 Key 后 CLI 无 Key 可调模型；**接通阶段 1 预留的对话与 SSE 通路，完成终端/curl 完整验证**。

---

## 计划任务

- [ ] 用户注册/登录（JWT）
- [ ] LLM Provider CRUD（加密存 API Key）
- [ ] Provider 代理：`POST /v1/chat/completions`（CLI 调 LLM 走 Server）
- [ ] Device 配对（配对码）
- [ ] CLI 心跳 + endpoint 注册
- [ ] Web 设备列表 API
- [ ] Server 接入 Postgres / Redis
- [ ] `POST /chat` 接通 `MuseHarness` + Backend LLM 代理
- [ ] CLI 鉴权 middleware（`Authorization: Bearer <device-token>`）
- [ ] `muse chat` 调试入口（REPL + 单次 prompt）

---

## 验收标准

- Web 设置页配置 Provider 后，CLI 经 Server 代理成功调用 LLM
- 设备列表显示 online/offline
- `/auth/login` 替换阶段 0 stub
- **终端/curl 能经 `POST /chat` + `GET /sessions/:id/events` 完整 SSE 收流（纯文本即可，无需 tool call）**
- **重启 CLI 后会话可恢复且可继续对话**

### curl 验证示例（阶段 3 交付时执行）

```bash
# 创建 session
curl -s -X POST http://127.0.0.1:7421/sessions \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"<default-agent-uuid>"}'

# 另开终端订阅 SSE
curl -N http://127.0.0.1:7421/sessions/<session-id>/events

# 发起对话
curl -s -X POST http://127.0.0.1:7421/chat \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"<session-id>","message":"你好","mode":"prompt"}'
```

---

## 完成记录

_（阶段完成后在此填写）_
