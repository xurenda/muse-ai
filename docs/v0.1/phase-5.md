# 阶段 5：Web 聊天 MVP

**状态**：⬜ 未开始  
**预估周期**：~2–3 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

浏览器完整对话体验：Web 经 Backend 拿 device endpoint，**直连 CLI SSE**；Server 仅负责 LLM 代理。

**前置**：阶段 4 内置 Tools 完成，聊天页可展示真实 tool call。

---

## 计划任务

- [ ] 登录、设备选择与在线状态
- [ ] Agent 选择与简易组装 UI
- [ ] 聊天页：流式 Markdown、thinking、tool call 卡片
- [ ] steer / followUp 输入模式
- [ ] 模型、thinking level 切换
- [ ] Session 列表 + 树形展示（数据来自 CLI API）

---

## 验收标准

- Web → CLI（SSE）+ CLI → Server（LLM）全链路跑通
- 局域网内 Web 可连 CLI（CORS + device token）
- 编程类对话可展示 `read` / `bash` 等 tool call 卡片

---

## 完成记录

_（阶段完成后在此填写）_
