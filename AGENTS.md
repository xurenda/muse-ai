# AI 与贡献者指南

以下约定适用于在本仓库（MuseAI）内编写与修改代码的 AI 与人类贡献者。

产品背景与架构见 [`docs/`](./docs/README.md)。

当前阶段进度见 [`docs/current-phase.md`](./docs/current-phase.md)。**进行任一阶段时，在此期间有什么问题，我们都可以进行讨论**——实现前优先阅读对应 `docs/v0.1/phase-N.md`。

---

## Monorepo

本仓库为 **pnpm monorepo**：

| 包                                     | 说明                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/shared`（`@muse-ai/shared`） | 跨包共享的常量、类型、协议、i18n、公共函数                                                          |
| `packages/core`（`@muse-ai/core`）     | Agent 组装、资产加载；**唯一**封装 `@earendil-works/pi-agent-core` / `@earendil-works/pi-ai` 的地方 |
| `packages/server`（`@muse-ai/server`） | 后端：账号、LLM Provider 代理、设备注册；**Docker Compose 在此包**                                  |
| `packages/cli`（`@muse-ai/cli`）       | 客户端 daemon 与 `muse` 命令；agent runtime                                                         |
| `packages/web`（`@muse-ai/web`）       | Web 前端                                                                                            |

说明：

- 根目录 `package.json` 集中安装多包共用的依赖（TypeScript、ESLint、Vitest 等）。`packages/*` 子包**不必**重复声明已在根上声明的依赖。新增依赖时，若会被**多个子包**使用，**优先加到根**。
- import **优先使用 `@/`**，对应各包 `src/` 根目录（需在 `tsconfig.json` 的 `paths` 及 Vite `resolve.alias` 中配置），避免冗长的 `../../../`；同目录可适当相对导入。

### 本地开发

```bash
# 后端依赖（Postgres、Redis 等）
cd packages/server && docker compose up -d

# CLI / Web
pnpm --filter @muse-ai/cli dev
pnpm --filter @muse-ai/web dev
```

CLI 与 Web 用 `pnpm dev`；**仅 server 包**使用 Docker Compose（`packages/server/docker-compose.yml`）。

---

## 外部参考仓库（探索用）

以下为本机 clone 的上游/参考项目，实现 Agent runtime 或多 agent 编排时可只读探索，**不要**直接 copy 进本仓库：

| 项目                   | 本地路径                       | 用途                                                                         |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| **pi**（AgentHarness） | `/Users/kingen/code/pi`        | `@earendil-works/pi-agent-core`、`pi-ai`；Session 树、Skills、steer/followUp |
| **Paperclip**          | `/Users/kingen/code/paperclip` | 多 agent 编排、控制面/执行面分离（后期 Workflow 参考）                       |

本仓库内调研笔记（非正式 spec）：

- `tmp/muse-ai 设想.md` — 原始产品设想
- `tmp/cursor_agent_agentharness.md` — pi AgentHarness 能力详解
- `tmp/cursor_.md` — Paperclip 设计分析

正式产品与架构文档：`docs/`。

---

## 注释与文档语言

- **代码注释**（`//`、`/* */`、JSDoc 简述等）统一使用 **简体中文**（专业名称保持原样，如 Agent、SSE、Harness）。
- 解释「为何这么写」优于重复代码在做什么；公共 API 可辅以简短 JSDoc。
- 单元测试的名称和描述也要优先使用简体中文。

---

## 文件与目录命名

| 类型              | 规范                                                                                                   | 示例                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 文件名            | 小写 + 连字符（kebab-case）                                                                            | `device-registry.ts`                                      |
| React 组件 `.tsx` | kebab-case；导出组件名为 PascalCase                                                                    | `message-list.tsx` → `export function MessageList`        |
| 类名              | PascalCase                                                                                             | `class MuseHarness`                                       |
| 函数名、变量名    | camelCase                                                                                              | `function helloWorld()`                                   |
| 常量              | UPPER_SNAKE_CASE                                                                                       | `const API_BASE = ''`                                     |
| 枚举              | 枚举名 PascalCase；成员按场景选 PascalCase 或 UPPER_SNAKE_CASE                                         | —                                                         |
| 测试文件          | 与 `src` 内源文件同基名 + `.test.ts` / `.test.tsx`；放在与 `src` 同级的 `test/` 下，目录结构镜像 `src` | `src/utils/parse-sse.ts` → `test/utils/parse-sse.test.ts` |

- **工具模块、通用函数/类型、HTTP 封装**等使用**能说明职责**的普适命名；**不要**仅为对齐仓库名而加 `muse` / `Muse` 前缀（CLI 命令 `muse` 与 npm scope `@muse-ai/*` 除外）。

---

## 测试

- **框架**：[Vitest](https://vitest.dev/)（根目录 `pnpm test` / `pnpm test:run`），配置见根目录 `vitest.config.ts`。
- **要求**：新增或修改业务逻辑时，**应补充或更新**对应单元测试；纯 UI 占位、一次性脚本可暂不测，但 core / shared / server / cli 的工具与协议逻辑应有覆盖。
- **位置**：各子包的测试放在 **`test/`**，与 **`src/` 同级**；**不要**把 `*.test.ts` 写在 `src/` 里。
- **目录**：`test/` 下的路径镜像 `src/`（例如 `src/utils/foo.ts` → `test/utils/foo.test.ts`）。
- **引用被测代码**：测试里 import 优先用 `@/`（Vitest 已 alias 到对应包的 `src/`），避免 `../../src/...`。
- **命名与语言**：测试文件基名与源文件一致；`describe` / `it` 的描述优先使用**简体中文**。

---

## 代码风格

- 遵循仓库 **Prettier**（`.prettierrc.json`）与 **ESLint**（`eslint.config.js`）配置；不要为绕过规则而滥用 `eslint-disable`。
- **提交前**：husky + lint-staged 对 staged 文件自动 `eslint --fix` 与 `prettier --write`。
- 常用命令：`pnpm lint`、`pnpm lint:fix`、`pnpm format`、`pnpm format:check`。

TypeScript：

- **禁止使用 `any`**。请改为：
  - 具体类型、接口或类型别名；
  - **`unknown`** 并在使用前收窄；
  - **泛型** 表达可复用约束；
  - **类型推断**（`const`、`satisfies` 等）；
  - 动态键值但结构不明的对象：**`Record<string, unknown>`** 或自定义 **`interface`**。
- 与外部库、HTTP、JSON、SSE 交互时，显式建模边界类型，避免 `any` 泄漏进业务层。

---

## UI 基元与设计 Token（`packages/web`）

可复用的底层交互组件采用 **Radix UI** + **Tailwind CSS** + **class-variance-authority（CVA）**：

- **Radix UI**：行为与可访问性基元（按需引入）。
- **Tailwind CSS**：外观与响应式样式。
- **CVA**：集中描述 `variant` / `size` 等类名组合。

**目录**：`packages/web/src/components/ui/`。

**变体**：`cva(...)` 及仅用于当前组件的变体常量写在**同一 `.tsx` 文件内**，**不导出**；对外导出组件及必要的 **`Props`** 类型。

### 设计 Token

定义见 `packages/web/src/styles/index.css`。颜色、字号等用 token + 语义类名（如 `bg-background`、`text-sm`），不要硬编码色值或魔术数字。间距直接用 Tailwind scale（如 `px-3`）。

### 已有 UI 基元（复用优先）

**新增可复用基元时，在本节补一行说明**。

| 基元                                                   | 位置                                      | 用法                                   |
| ------------------------------------------------------ | ----------------------------------------- | -------------------------------------- |
| `Button`                                               | `components/ui/button.tsx`                | 主操作、outline/ghost/destructive 变体 |
| `IconButton`                                           | `components/ui/icon-button.tsx`           | 侧栏/Header 图标按钮                   |
| `Input` / `Textarea`                                   | `components/ui/input.tsx`、`textarea.tsx` | 表单字段                               |
| `Select`                                               | `components/ui/select.tsx`                | 下拉单选（基于 DropdownMenu）          |
| `Label`                                                | `components/ui/label.tsx`                 | 表单标签                               |
| `DropdownMenu`                                         | `components/ui/dropdown-menu.tsx`         | 菜单、Select 底层                      |
| `Tooltip`                                              | `components/ui/tooltip.tsx`               | 悬停提示                               |
| `Toaster`                                              | `components/ui/sonner.tsx`                | 全局 toast（`sonner`）                 |
| `ThemeSwitcher`                                        | `components/theme-switcher.tsx`           | light / dark / system 切换             |
| `SettingsSection` / `SettingsRow` / `SettingsFieldRow` | `components/settings/`                    | 设置页分区、列表行、标签+控件行        |
| `PageShell`                                            | `components/layout/page-shell.tsx`        | 非聊天页统一标题区 + max-w-3xl 内容区  |
| `AuthLayout`                                           | `components/layout/auth-layout.tsx`       | 登录/注册居中卡片壳层                  |

### 可访问性与交互

- 交互控件使用语义化 HTML 与可用的 `aria-*` / 标签关联。
- 复杂交互需考虑键盘可操作性与焦点顺序。

---

## i18n

用户可见文案放在 `packages/shared/src/i18n/locales/<语言>/<命名空间>.json`。组件里用 `const { t } = useTranslation('命名空间')`，以 `t('some.key')` 代替硬编码字符串；新增文案先加 JSON，再在组件中引用。

---

## 架构约束（实现时遵守）

- **Web ↔ CLI**：聊天 SSE **直连 CLI**，不经 server 转发；LLM 请求 **CLI → server → Provider**。
- **Session**：持久化在 CLI 本地 `~/.muse/sessions/`，第一期不上传 server。
- **pi 依赖**：仅 `packages/core` 引用 `@earendil-works/pi-agent-core` 与 `@earendil-works/pi-ai`；**不要**依赖 `@earendil-works/pi-coding-agent`。
- **MCP（第一期）**：不做通用 MCP 框架；tools 内置在 CLI；`~/.muse/mcps/` 仅占位。

详见 [`docs/architecture.md`](./docs/architecture.md)。
