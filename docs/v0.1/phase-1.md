# 阶段 1：CLI Runtime 内核

**状态**：⬜ 未开始  
**预估周期**：~2 周

---

## 目标

CLI 能真正跑 agent 对话：封装 pi AgentHarness、本地 Session 持久化、内置基础 tools，curl 或终端可 SSE 收流。

---

## 计划任务

- [ ] `packages/core` 封装 `MuseHarness`（基于 `@earendil-works/pi-agent-core`）
- [ ] `~/.muse` 目录初始化（config、sessions）
- [ ] 内置 tools：`read_file`、`list_dir`、`run_command`（受限 cwd/超时）
- [ ] JSONL Session 存储（复用 pi Session）
- [ ] CLI：`POST /chat`、`GET /events`（SSE）
- [ ] 调试入口：`muse chat` 或 curl 发 prompt

---

## 验收标准

- 终端/curl 能 SSE 收流
- 重启 CLI 后会话可恢复
- `pnpm test:run` 通过（含新增 core/cli 测试）

---

## 完成记录

_（阶段完成后在此填写实际产出、文件清单、验收命令输出）_
