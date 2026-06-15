# 阶段 3：Backend 控制面

**状态**：⬜ 未开始  
**预估周期**：~2 周

---

## 目标

账号、LLM Provider、CLI 设备配对与心跳；Web 配 Key 后 CLI 无 Key 可调模型。

---

## 计划任务

- [ ] 用户注册/登录（JWT）
- [ ] LLM Provider CRUD（加密存 API Key）
- [ ] Provider 代理：`POST /v1/chat/completions`（CLI 调 LLM 走 Server）
- [ ] Device 配对（配对码）
- [ ] CLI 心跳 + endpoint 注册
- [ ] Web 设备列表 API
- [ ] Server 接入 Postgres / Redis

---

## 验收标准

- Web 设置页配置 Provider 后，CLI 经 Server 代理成功调用 LLM
- 设备列表显示 online/offline
- `/auth/login` 替换阶段 0 stub

---

## 完成记录

_（阶段完成后在此填写）_
