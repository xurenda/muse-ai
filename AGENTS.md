# AI 与贡献者指南

以下约定适用于在本仓库内编写与修改代码的 AI 与人类贡献者。

---

## Monorepo

本仓库为 **pnpm monorepo**：

- `packages/shared`(`@muse-ai/shared`)：跨包共享的常量、类型、协议、公共函数等
- `packages/backend`(`@muse-ai/backend`)：后端
- `packages/cli`(`@muse-ai/cli`)：客户端，提供 agent 运行时
- `packages/desktop`(`@muse-ai/desktop`)：Windows、Mac 桌面应用程序，Electron 主进程
- `packages/web`(`@muse-ai/web`)：独立 Web 端或作为 Electron 渲染进程

说明：

- 根目录 `package.json` 集中安装多包共用的依赖（如 TypeScript、ESLint 等）。`packages/*` 子包**不必**再重复声明这些已在根上声明的依赖。以后新增依赖时，若会被**多个子包**使用，**优先加到根**，不要在多个子包里各写一份相同依赖。
- import **优先使用 `@/`**，对应 `src/` 根目录（需要 `tsconfig.json` 中 `paths` 及 Vite `resolve.alias` 进行配置），避免冗长的 `../../../`；同目录可适当相对导入以保持可读性。

---

## 注释与文档语言

- **代码注释**（`//`、`/* */`、JSDoc 简述等）统一使用 **简体中文**（专业名称等依然保持原样，如：Agent、renderer）。
- 解释「为何这么写」优于重复代码在做什么；公共 API 可辅以简短 JSDoc。
- 单元测试的名称和描述也要优先使用简体中文。

---

## 文件与目录命名

| 类型              | 规范                                                                   | 示例                                               |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| 文件名            | 小写 + 连字符（kebab-case）                                            | `conversation-content.tsx`                         |
| React 组件 `.tsx` | kebab-case；导出组件名为 PascalCase                                    | `message-list.tsx` → `export function MessageList` |
| 类名              | PascalCase                                                             | `class HellWorld`                                  |
| 函数名、变量名    | pascalCase                                                             | `function helloWord()`                             |
| 常量              | UPPER_SNAKE_CASE                                                       | `const API_BASE = ''`                              |
| 枚举              | 枚举名 PascalCase；成员按场景选 **PascalCase** 或 **UPPER_SNAKE_CASE** | -                                                  |
| 测试文件          | 与源文件同基名 + `.test.ts` / `.test.tsx`                              | `message-view-model.test.ts`                       |

- **工具模块、通用函数 / 类型、服务端点封装**等（与产品名无强绑定者）使用**能说明职责**的普适命名即可，例如 `http-request.ts`、`httpRequest`、`joinApiUrl`、`resolveHttpBaseUrl`；**不要**仅为对齐仓库名而加 `muse` / `Muse` 前缀。

---

## 代码风格

- 遵循仓库 **Prettier** 与 **ESLint** 配置；不要为绕过规则而滥用 `eslint-disable`。

TypeScript:

- **禁止使用 `any`**。请改为：
  - 具体类型、接口或类型别名；
  - `**unknown**` 并在使用前收窄；
  - **泛型** 表达可复用约束；
  - **类型推断**（`const`、`satisfies` 等）；
  - 动态键值但结构不明的对象：`**Record<string, unknown>`** 或 **自定义类型** / `**interface`\*\*。
- 与外部库、IPC、JSON 交互时，显式建模边界类型，避免一路 `any` 泄漏进业务层。

---

## UI 基元与设计 Token

可复用的底层交互组件（无障碍、焦点、键盘行为等）采用 **Radix UI** + **Tailwind CSS** + **class-variance-authority（CVA）**：

- **Radix UI**：行为与可访问性基元（按需引入对应包，如 `@radix-ui/react-slot`）。
- **Tailwind CSS**：外观与响应式样式。
- **CVA**：集中描述 `variant` / `size` 等类名组合，避免散落条件样式。

**目录**：此类文件统一放在 `**packages/web/src/components/ui`\*\*。

**变体**：`cva(...)` 及仅用于当前组件的变体相关常量写在 **同一 `.tsx` 文件内**，**不导出**；对外只需导出组件本身以及必要的 `**Props` 类型\*\*（例如配合 `VariantProps`）。

### 设计 Token

定义见 `packages/web/src/styles/index.css`。颜色、字号等全局值用 token + 语义类名（如 `bg-background`、`text-sm`），不要硬编码色值或 `text-[13px]` 这类魔术数字。间距直接用 Tailwind scale（如 `px-3`），不必再包一层 token。

### 已有 UI 基元（复用优先）

**新增可复用基元时，在本节补一行说明**（写清用途与引用方式），方便后续 AI 与贡献者发现。

| 基元 | 位置 | 用法 |
| ---- | ---- | ---- |
| `ui-menu-item` | `index.css` | 列表/菜单行基样式；叠场景色即可 |
| `DropdownMenuItem` 等 | `components/ui/dropdown-menu.tsx` | 下拉菜单，已内置 `ui-menu-item` |
| `Textarea` | `components/ui/textarea.tsx` | 多行输入，样式与 `Input` 一致 |
| 侧栏导航 | `sidebar-nav-link.tsx` | `ui-menu-item` + sidebar 色 token 的参考实现 |

列表/菜单项：**优先用上表基元**，不要手写 `px-3 py-2 text-sm font-medium`。下拉用 `DropdownMenuItem`；侧栏等用 `ui-menu-item` + 场景色。菜单内图标：`size-3.5`、`strokeWidth={2}`。

### 可访问性与交互

- 交互控件尽量使用语义化 HTML 与可用的 `aria-*` / 标签关联（`label`、`button` 等）。
- 键盘可操作性与焦点顺序在复杂交互中需一并考虑。

## i18n

用户可见文案放在 `packages/shared/src/i18n/locales/<语言>/<命名空间>.json`。组件里用 `const { t } = useTranslation('命名空间')`，以 `t('some.key')` 代替硬编码字符串；新增文案先加 JSON，再在组件中引用。
