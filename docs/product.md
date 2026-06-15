# 产品描述

## 一句话

**MuseAI = 可组装的 personal AI agent 平台**：用户在本地运行 agent runtime（读写文件、执行命令），在 Web 上聊天和管理；角色与能力可自由组合；长期目标是自进化与多 agent 协作。

## 要解决什么问题

| 痛点                                 | MuseAI 的回应                               |
| ------------------------------------ | ------------------------------------------- |
| 通用聊天产品无法操作本地文件、跑命令 | CLI 作为 agent runtime，内置文件/Shell 工具 |
| Agent 能力写死在产品里，难以扩展     | Persona + Skills + Tools 可组合，后期有市场 |
| API Key 散落在各客户端，难以管理     | Backend 统一托管 Provider，CLI 不存 Key     |
| 长对话上下文有限、无法回顾分支       | 树形 Session（基于 pi AgentHarness JSONL）  |
| 用多个终端/agent 时难以统一管理      | Web 统一入口，可管理多个 CLI 设备（后期）   |

## 不是什么

- **不是 Paperclip 式「AI 公司 OS」** — 第一期是个人 agent 工作台，不做 org chart / issue / heartbeat 全套
- **不是通用 IM** — 对话锚定在 Session 与 Agent 任务上
- **不是云端代跑 agent** — 执行面在用户 CLI；Backend 是控制面，不转发聊天流

## 目标用户

- **现在**：开发者本人（dogfooding）
- **后期**：需要「本地能力 + 可定制 agent」的个人开发者与小团队

## 核心概念

### Agent 组成

```
Agent（运行实例）
├── Persona（角色）       system prompt、默认 model/thinking、行为边界
├── Capabilities（能力包）
│   ├── Skills            自然语言 SOP（SKILL.md），注入 context
│   ├── Tools             内置工具（read、shell 等，第一期写死在 CLI）
│   └── MCP Servers       外部工具服务（第一期仅占位配置）
└── Runtime Config        cwd、权限策略等
```

| 资产    | 能否单独运行 | 存储位置                           |
| ------- | ------------ | ---------------------------------- |
| Persona | 否           | `~/.muse/personas/` + 市场（后期） |
| Skill   | 否           | `~/.muse/skills/` + 市场（后期）   |
| Agent   | **是**       | `~/.muse/agents/`                  |

### 三层产品

| 层          | 包/部署                     | 职责                                            |
| ----------- | --------------------------- | ----------------------------------------------- |
| **CLI**     | `@muse-ai/cli`，命令 `muse` | Agent runtime、Session 持久化、HTTP+SSE 服务    |
| **Backend** | Docker Compose              | 账号、LLM Provider 代理、设备注册、市场（后期） |
| **Web**     | `pnpm dev` / 静态部署       | 聊天 UI、Session 树、Agent 组装、设置           |

## 关键体验

### 聊天

- 流式 Markdown 渲染
- thinking、tool call 可视化
- steer / followUp 打断与追加
- 切换模型、思考等级

### Session

- 树形结构，可从任意节点分叉
- 完整历史存 CLI 本地 JSONL
- 长对话支持 compact（Harness 内置）

### 输入（规划）

附件展示在输入框上方，正文用 `@` 引用；发给 LLM 的 user message 带结构化引用块，由 read 等工具读取路径：

```text
我想做一个 xxx，@[1] 是我的产品文档，参考 @[2] 的效果

---
[1]: /user/xxx/document/prd.md
[2]: /user/xxx/download/1.png
```

第一期不做附件多模态，UI 可预留。

### 可组合（第一期 subset）

- 内置 2–3 个 Persona、2–3 个 Skill
- Web/CLI 选择 Persona + Skills 组装 Agent 并保存
- 市场、AI 自动组装 agent → 后续版本

### 自进化（后续）

- 跨会话记忆（Thought-Retriever 思路：检索「思考摘要」而非原始 chunk）
- 审查 agent 分析表现 → 优化 Skill/Persona（SkillOpt 思路：验证门控后才采纳）
- 默认先给用户看建议，用户确认后再改

## 与竞品/参考项目的关系

| 项目                                                        | 借鉴什么                                                 | 不做什么                      |
| ----------------------------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| [pi AgentHarness](https://github.com/badlogicgames/pi-mono) | Session 树、Skills、steer/followUp、compact              | 不直接用 pi-coding-agent CLI  |
| [Paperclip](https://github.com/paperclipai/paperclip)       | 控制面/执行面分离；后期多 agent 的 assignee、结构化 HITL | 第一期不做 company/issue 模型 |
| [SkillOpt](https://github.com/microsoft/SkillOpt)           | Skill 文档验证门控式优化                                 | 第一期不做                    |
| [Thought-Retriever](https://arxiv.org/abs/2604.12231)       | 跨会话检索推理摘要                                       | 第一期不做                    |

## 第一期成功标准

1. `npm i -g @muse-ai/cli && muse login && muse start` 能跑起来
2. Web 直连 CLI（SSE）完成对话，流式体验流畅
3. 可组装 Agent（选 Persona + Skills），切换后行为明显不同
4. Session 可分叉，重启 CLI 后会话仍在
5. API Key 只配在 Backend Web 设置页，CLI 本地无 Key
