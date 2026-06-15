# 阶段 4：内置 Tools

**状态**：⬜ 未开始  
**预估周期**：~2–3 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。

---

## 目标

参考 [`@earendil-works/pi-coding-agent`](https://github.com/earendil-works/pi)（**只读探索，不添加 npm 依赖**）在 Muse 内实现完整 coding-agent 级内置 tools，并接入 `MuseHarness` / Agent 定义。

本阶段**不做**最简版 `read_file`/`list_dir`/`run_command` 占位；行为、安全边界与 pi 对齐后再交付。

---

## 为何独立成阶段

| 考量          | 说明                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| 复杂度        | pi-coding-agent 的 tools 含 path 解析、truncation、trust、Operations 可插拔、ToolDefinition 与 render 分层等 |
| 架构约束      | 仓库约定**不依赖** `pi-coding-agent` 包，需按需移植/改写进 `packages/cli/tools/`                             |
| 前置已就绪    | `MuseHarness` + `NodeExecutionEnv` 已封装；`tools: []` 可跑通阶段 1–3 的纯文本对话                           |
| 与 Agent 衔接 | 阶段 2 的 Agent 定义负责 `activeToolNames`；本阶段提供可注册的 tool 全集                                     |

---

## 参考范围（pi-coding-agent `core/tools/`）

| 模块                                                  | 说明                                           | v0.1 优先级 |
| ----------------------------------------------------- | ---------------------------------------------- | ----------- |
| `read`                                                | offset/limit、truncation、图片、ReadOperations | P0          |
| `ls`                                                  | 目录列表（pi 工具名 `ls`，非 `list_dir`）      | P0          |
| `bash`                                                | shell 执行、timeout、输出截断、trust 联动      | P0          |
| `write` / `edit`                                      | 文件变更、`withFileMutationQueue`              | P1          |
| `grep` / `find`                                       | 依赖 rg/fd 或 Operations 抽象                  | P2          |
| `path-utils` / `truncate` / `tool-definition-wrapper` | 公共基础设施                                   | P0          |

本地参考路径：`/Users/kingen/code/pi/packages/coding-agent/src/core/tools/`。

---

## 计划任务

- [ ] 调研 pi-coding-agent tools 分层：`ToolDefinition` vs `AgentTool`、`Operations` 接口
- [ ] `packages/cli/tools/` 目录与 `createMuseTools(cwd, options)` 工厂
- [ ] 移植/改写 P0：`read`、`ls`、`bash`（含 path 沙箱、truncation、默认超时）
- [ ] P1：`write`、`edit` + 文件变更序列化（参考 `file-mutation-queue`）
- [ ] P2：`grep`、`find`（评估是否捆绑 rg/fd 或要求系统已安装）
- [ ] 项目 trust 策略（参考 `trust-manager`，Web 场景可简化为配置级）
- [ ] 与 `MuseAgentRegistry` 集成：按 Agent 启用 tool 子集
- [ ] 单元测试：path 解析、truncation、timeout、越界 cwd

---

## 验收标准

- 阶段 3 已接通 LLM 的前提下，**编程助手 Agent** 可实际触发 `read`/`ls`/`bash`（至少 P0）
- `tool_start` / `tool_end` SSE 事件含可展示的 `args` / `result`
- `pnpm test:run` 通过（含 tools 单测）
- 不引入 `@earendil-works/pi-coding-agent` 依赖

---

## 依赖关系

```
阶段 1 MuseHarness (tools: [])
    → 阶段 2 Agent 定义 (activeToolNames)
    → 阶段 3 Backend + 纯文本 curl/SSE 验证
    → 阶段 4 本阶段（tools 接入 Harness）
    → 阶段 5 Web tool call 卡片
```

---

## 完成记录

_（阶段完成后在此填写）_
