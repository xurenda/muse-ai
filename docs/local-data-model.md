# Muse 本地数据模型

本文描述 Muse daemon 在用户机器上的目录布局、核心概念，以及与后端市场的关系。实现时以本文为准；类型定义逐步沉淀到 `@muse-ai/shared`。

## 设计原则

- **单 daemon**：全局唯一本地 HTTP 服务，**启动时不绑定 cwd**，不做项目级 `.muse/` 配置。
- **工作目录（cwd）**：由用户在 **Web 创建或进入对话时选择文件夹**，按 **session** 注入；不同对话可使用不同目录。daemon 进程本身没有全局 pwd 概念。
- **数据目录 `~/.muse/`**：固定位于用户主目录（可用环境变量 `MUSE_HOME` 覆盖整个数据根路径，供测试用），存放配置、Agent 实例、registry、会话文件等；与某次对话的工作目录无关。
- **多 Agent 实例**：本地只存 Agent **实例**；Agent 模板/包由**后端市场**提供，安装后落盘为 `agents/<id>/`。
- **对用户暴露**：Agent、Plugin、Skill、Prompt。**Extension** 为实现细节，仅存在于 Plugin 内部。
- **市场与安装**：浏览、搜索、下载由**后端 API** 负责；本地 `registry/` 只记录**已安装项**及本地路径，不存远程 source。
- **第一版范围**：仅**用户手动安装**；不做 Agent 自动提议安装；Prompt 仅支持用户 `/命令` 调用（不做 Agent 调 Prompt、不做 subagent 派发）。

## 环境变量

| 变量 | 作用 |
|------|------|
| `MUSE_HOME` | 覆盖数据根目录（默认 `~/.muse`），用于测试或隔离环境；**不是**对话工作目录 |
| `MUSE_DAEMON_PORT` | daemon 监听端口（默认 `7421`） |

对话的 **cwd** 由 Web 在创建 session 时传入，不通过环境变量设置。

---

## 目录布局

```
~/.muse/
├── daemon.json              # daemon 运行状态（pid、port 等，Phase 1 已有）
├── settings.json            # 全局设置（UI、语言、全局行为等）
├── auth.json                # API Key / OAuth 凭证
├── models.json              # 自定义 provider / 模型
│
├── registry/                # 本地安装注册表（不含远程 URL，远程由后端负责）
│   ├── plugins.json
│   ├── skills.json
│   ├── prompts.json
│   └── agents.json
│
├── plugins/
│   └── <plugin-id>/         # 命名空间 id，如 acme/code-tools
│       ├── package.json
│       ├── manifest.json    # Muse 资源声明（extensions / skills / prompts / bins）
│       ├── node_modules/
│       ├── extensions/      # jiti 加载的 TS/JS 插件（对用户不可见）
│       ├── skills/          # 随 Plugin 捆绑的 Skill（若市场定义为 Plugin 一部分）
│       ├── prompts/         # 随 Plugin 捆绑的 Prompt（同上）
│       └── bins/            # Plugin 附带的可执行文件
│
├── skills/
│   └── <skill-id>/          # 市场中单独发布的 Skill
│       └── SKILL.md
│
├── prompts/
│   └── <prompt-id>.md       # 市场中单独发布的 Prompt 模板
│
├── agents/
│   └── <agent-id>/          # Agent 实例（用户创建或从市场安装后生成）
│       ├── config.json      # 名称、描述、默认模型等
│       ├── SYSTEM.md        # 完整 system prompt（无内置默认 prompt，故不区分 APPEND）
│       ├── plugins.json     # 启用的 Plugin id 列表
│       ├── skills.json      # 启用的 Skill id 列表
│       └── prompts.json     # 启用的 Prompt id 列表
│
└── sessions/
    └── <agent-id>/
        └── <session-id>.jsonl
```

---

## 核心概念

### Agent（Agent 实例）

用户可见的「一个 AI 助手配置」：人设（`SYSTEM.md`）、默认模型、以及启用的 Plugin / Skill / Prompt。

- 本地**只有实例**，不存在 `_templates/` 或本地 Agent 包目录。
- 从市场安装 Agent：后端下发包内容 → daemon 在 `agents/<id>/` 创建实例并写入 registry。
- 会话绑定到某个 `agent-id`；切换 Agent 即切换配置与资源集合。

### Plugin

**安装与分发单元**，封装能力 bundle，对用户可见。内部可含：

| 子目录        | 说明                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `extensions/` | TypeScript 插件（jiti），注册 tools、命令、事件等；**不对用户暴露 extension 概念** |
| `skills/`     | 随 Plugin 发布的 Skill                                                             |
| `prompts/`    | 随 Plugin 发布的 Prompt 模板                                                       |
| `bins/`       | 命令行工具等二进制                                                                 |

安装位置：`plugins/<plugin-id>/`。是否包含 skills/prompts 由**市场包定义**决定，不由本地规则推断。

### Skill

遵循 [Agent Skills](https://agentskills.io/specification) 规范：以 `SKILL.md` 为核心的能力说明，供模型按需阅读。

- **单独发布**：安装到 `skills/<skill-id>/`。
- **随 Plugin 发布**：安装到 `plugins/<plugin-id>/skills/...`，卸载 Plugin 时一并删除。

Agent 通过 `agents/<id>/skills.json` **显式启用**哪些 Skill（引用 market id，不复制文件）。

### Prompt

与 pi 的 Prompt 模板一致：Markdown 片段，用户在对话中通过 **`/命令名`** 展开为完整 user message。

- **单独发布**：`prompts/<prompt-id>.md`。
- **随 Plugin 发布**：`plugins/<plugin-id>/prompts/...`。

第一版**不支持** Agent 自动调用 Prompt，也不做 subagent 派发；后续版本再评估。

### Extension（内部）

与 pi extensions 相同：jiti 动态加载的 TS 模块。仅存在于 `plugins/<id>/extensions/`，**不出现在 UI 与 CLI 用户概念中**。

---

## 命名与 id

市场中资源 id 采用**命名空间**，避免歧义，**不做本地冲突合并逻辑**：

| 来源             | id 格式            | 示例               |
| ---------------- | ------------------ | ------------------ |
| 市场（他人发布） | `<user_id>/<name>` | `acme/code-review` |
| 本地创建         | `local/<name>`     | `local/my-prompt`  |

Plugin、Skill、Prompt、Agent 包均遵循同一规则。本地目录名 / registry 键与 id 一致（注意路径安全：将 `/` 映射为目录层级或编码规则在实现时统一，如 `plugins/acme/code-tools/`）。

---

## registry/（本地安装注册表）

本地**不保存**远程下载地址；安装、更新、卸载的 source 解析由**后端 API** 完成。registry 仅记录：

- 已安装的 id
- 本地路径（`plugins/...`、`skills/...` 等）
- 安装时间、版本等元数据（字段在 `@muse-ai/shared` 中定义）
- 可选：`agents.json` 中市场 Agent 包 id → 本地 `agents/<agent-id>/` 的映射，便于更新或卸载

示例（结构示意，非最终实现）：

```json
{
  "plugins": [
    {
      "id": "acme/code-tools",
      "version": "1.2.0",
      "path": "plugins/acme/code-tools",
      "installedAt": "2026-06-09T12:00:00.000Z"
    }
  ]
}
```

---

## 安装行为（第一版）

| 操作                | 行为                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| 安装 Plugin         | 后端下发包 → 解压到 `plugins/<id>/` → 更新 `registry/plugins.json` → 必要时 `npm install` |
| 安装 Skill（独立）  | 落盘 `skills/<id>/` → 更新 `registry/skills.json`                                         |
| 安装 Prompt（独立） | 落盘 `prompts/<id>.md` → 更新 `registry/prompts.json`                                     |
| 安装 Agent          | 后端下发 → 创建 `agents/<id>/` → 可选写入 `registry/agents.json`                          |
| 卸载                | 删除对应目录 + registry 条目；Plugin 内捆绑的 skill/prompt 随 Plugin 删除                 |
| Agent 启用资源      | 仅改 `agents/<id>/plugins.json` 等，不复制文件                                            |

**不做**：Agent 发现能力缺失后自动安装（后续版本 + 用户确认再做）。

---

## 配置分层

| 文件                          | 作用域   | 说明                                |
| ----------------------------- | -------- | ----------------------------------- |
| `settings.json`               | 全局     | 语言、主题、与具体 Agent 无关的行为 |
| `auth.json`                   | 全局     | 各 provider 凭证                    |
| `models.json`                 | 全局     | 自定义模型与 provider               |
| `agents/<id>/config.json`     | 单 Agent | 名称、描述、该 Agent 默认模型等     |
| `agents/<id>/SYSTEM.md`       | 单 Agent | 完整 system prompt                  |
| `agents/<id>/plugins.json` 等 | 单 Agent | 启用哪些已安装资源                  |

---

## 会话（sessions）

```
sessions/<agent-id>/<session-id>.jsonl
```

- 每个会话归属一个 Agent 实例。
- **cwd 存在 session 上**：Web 选文件夹后，在 `POST /sessions`（或等价 API）传入 `cwd`；后续该会话的 tool（read、bash 等）均在此目录下解析相对路径。
- daemon 启动、Agent 切换均不设置 cwd；仅对话/session 层携带。
- 格式参考 pi 的 JSONL 树结构（分支、resume 等后续 Phase 对齐）。
- `session-id` 与文件命名规则在 session 模块实现时定稿。

Session 元数据示意（类型见 `@muse-ai/shared` 的 `SessionMeta`）：

```json
{
  "id": "01HXYZ...",
  "agentId": "default",
  "cwd": "/Users/me/projects/my-app",
  "createdAt": "2026-06-09T12:00:00.000Z"
}
```

---

## daemon 与运行时

1. 用户或 Web 选定 **Agent 实例**（`agent-id`）。
2. 用户创建/进入对话时，在 Web **选择工作目录**，写入该 **session** 的 `cwd`。
3. daemon 读取 `agents/<agent-id>/` 下配置与启用列表。
4. 根据 id 从 `plugins/`、`skills/`、`prompts/` 解析路径并加载资源；Plugin 内 `extensions/` 由 jiti 加载。
5. 组装 system prompt：`SYSTEM.md` + 已启用 Skill 索引等（无 pi 式内置默认 SYSTEM）；需要时可把 session 的 `cwd` 写入 prompt 上下文。
6. 对话事件经 WebSocket 推送到 `@muse-ai/web`。

单 daemon 监听 `127.0.0.1`（默认端口 `7421`），状态写入 `daemon.json`；重复 `muse daemon start` 拒绝并提示已有 pid/port。

---

## 与 pi 的对照

| pi                               | Muse                                  |
| -------------------------------- | ------------------------------------- |
| `~/.pi/agent/` 单配置根          | `~/.muse/` + 多 `agents/<id>/`        |
| `SYSTEM.md` + `APPEND_SYSTEM.md` | 每 Agent 仅 `SYSTEM.md`（无内置默认） |
| 用户可见 extensions              | 隐藏为 Plugin 内部                    |
| `pi install` + settings.packages | 后端市场 + 本地 registry              |
| 项目级 `.pi/`                    | 不做                                  |
| RPC 模式                         | 不做；HTTP + WebSocket                |

---

## 实现阶段（参考）

| 阶段    | 内容                                                        |
| ------- | ----------------------------------------------------------- |
| Phase 1 | daemon start/stop/status、health、Web 连接状态（已完成）    |
| Phase 2 | 目录与 registry 骨架、默认 Agent 实例、settings/auth/models |
| Phase 3 | ResourceLoader、jiti Plugin、Skill、Session                 |
| Phase 4 | Web Agent / Plugin / Skill / Prompt 配置 UI                 |
| Phase 5 | 后端市场 API、安装/卸载命令                                 |
| 后续    | Agent 提议安装、Prompt 供 Agent 调用、subagent              |

---

## 相关文档

- pi 参考实现：`/Users/kingen/code/pi`（extensions、skills、prompt 模板、session JSONL）
