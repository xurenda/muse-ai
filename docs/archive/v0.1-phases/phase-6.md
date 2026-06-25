# 阶段 6：Web UI 改版

**状态**：✅ 已完成  
**完成日期**：2026-06-16  
**Commit**：`db0e437`  
**预估周期**：~2 周

> **协作说明**：进行本阶段时，在此期间有什么问题，我们都可以进行讨论。  
> 若单个子阶段工作量过大，可再拆 **6.x.y**（例如 6.2.1 仅做左栏 Session 列表样式）。

---

## 目标

将 `packages/web` 从阶段 5 的「功能可用、视觉粗糙」提升到接近参考仓库 [`/Users/kingen/code/muse-ai`](file:///Users/kingen/code/muse-ai) 的 UI 品质：**统一设计系统、应用壳层、聊天与设置页视觉**，同时**不改变** v0.1 已有业务链路（Backend 登录 / 设备配对 / Web 直连 CLI SSE）。

**不做**：参考仓库中尚未纳入 v0.1 的产品能力（工作区目录选择、附件上传、Trace 右栏、Skills 占位页、Models 设置页等）——仅借鉴布局与组件样式，不照搬路由与 API。

---

## 参考与现状对比

| 维度        | 参考仓库 `code/muse-ai`                              | 当前 `code2/muse-ai`（阶段 5）                 |
| ----------- | ---------------------------------------------------- | ---------------------------------------------- |
| 设计 token  | oklch 语义变量 + light/dark + sidebar 专用色         | 硬编码深色 hex，`@theme` 无主题切换            |
| 应用壳层    | `AppLayout` + 可拖拽三栏（`react-resizable-panels`） | 各页自带 header，聊天页三栏写死在 `ChatPage`   |
| 侧栏        | `AppSidebar` + `SessionList` + 导航项（lucide 图标） | `SessionSidebar` 功能有，样式简陋              |
| 聊天消息    | `ChatViewList`、tool/thinking 分组块、Shiki 高亮     | `ChatMessageList` + 基础 Markdown              |
| 输入区      | `ChatComposer`（多行、模式切换）                     | `ChatInput` 单行为主                           |
| 设置        | `SettingsLayout` + 侧栏导航 + 表单行组件             | `/settings/providers` 单页表单                 |
| 认证 / 设备 | （参考仓库流程不同，**不照搬**）                     | `/login`、`/register`、`/devices` 需保留并美化 |
| 依赖        | lucide、shiki、sonner、zustand、radix 更多基元       | 仅 button/input/label                          |

---

## 子阶段拆分

| 子阶段  | 名称                          | 交付物                                                                                       | 依赖                     |
| ------- | ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------ |
| **6.1** | 设计系统与 UI 基元            | token、主题切换、Typography、Button/Input/Select/Textarea/Tooltip 等；`cn()` 与 CVA 对齐参考 | 无                       |
| **6.2** | 应用壳层与路由整合            | `AppLayout`、可伸缩侧栏、统一 `MainHeader`；登录后页面纳入壳层；保留 Guest 布局              | 6.1                      |
| **6.3** | 聊天页视觉                    | 消息列表/Composer/Session 树/顶栏设置条样式；Shiki 代码块；thinking & tool 卡片对齐参考      | 6.2；阶段 5 聊天逻辑不变 |
| **6.4** | 设置 / 认证 / 设备 / Agent 页 | Providers、Devices、Login/Register、Agents 页视觉统一；可选 `SettingsLayout` 侧栏            | 6.1–6.2                  |

建议实施顺序：**6.1 → 6.2 → 6.3 → 6.4**。6.3 与 6.4 可在 6.2 完成后并行，但 **6.3 优先**（聊天是主路径）。

---

## 任务清单

### 6.1 设计系统与 UI 基元

- [x] 对齐参考 `styles/index.css`：`:root` / `.dark` oklch 变量、`@theme inline`、scrollbar、markdown 基样式
- [x] `ThemeProvider`：**默认 `system`（跟随系统）**；`matchMedia` 监听系统主题变化；Header 可选 light / dark / system 覆盖；偏好 localStorage 持久化
- [x] 引入 `@tailwindcss/typography`（若聊天 prose 需要）
- [x] 补齐/改版 UI 基元：`button`、`input`、`textarea`、`select`、`icon-button`、`tooltip`、`dropdown-menu`；toast 用 `sonner`
- [x] 引入 `lucide-react` 作为侧栏/Header 图标
- [x] 根依赖声明：参考仓库已有、本包缺失的包加到 `packages/web` 或 monorepo 根（遵循 AGENTS.md）
- [x] 更新 `AGENTS.md`「已有 UI 基元」表格

### 6.2 应用壳层与路由整合

- [x] 新增 `layouts/app-layout.tsx`（或等价目录），`react-resizable-panels` 三栏：左 Session、主内容、右 Session 树（聊天路由）
- [x] `MainHeader`：侧栏折叠、主题/语言、设备连接态、用户菜单（登出、设置）
- [x] 侧栏导航：**新对话**、Session 列表、**设备**、Agents、Providers（lucide 图标）；设备页从独立 landing 改为侧栏入口
- [x] **路由调整**（见下方「已确认决策」）：`/` → `/chat`；聊天 `/chat`（新对话）+ `/chat/:sessionId`；`/devices` 保留但仅侧栏进入
- [x] **移除 `DeviceRequiredLayout` 全站拦截**：登录后默认可进 `/chat`；未连接设备时在聊天页占位（**具体引导文案/交互阶段 6 暂不定**）
- [x] `ProtectedLayout` + `AppLayout` 包裹登录后主要页面；Guest 布局仅 login/register
- [x] 非聊天页（Devices、Agents、Providers）共用 AppLayout 主内容区，去掉每页重复顶栏

### 6.3 聊天页视觉

- [x] 重构 `ChatPage`：布局由 `AppLayout` 承担；**路由参数 `sessionId`** 驱动当前 Session（创建/切换时 `navigate('/chat/:sessionId')`）
- [x] `/chat`（无 id）：新对话入口；选中 Session 或创建后跳转 `/chat/:sessionId`
- [x] 用户消息 / Assistant 答案块样式（参考 `user-message`、`answer-block`）
- [x] thinking 折叠块（参考 `thinking-block` / `process-block-header`）
- [x] tool call 分组卡片（参考 `tool-group-block`、`tool-row`；**数据仍来自阶段 5 SSE**）
- [x] Markdown + **Shiki** 代码高亮（参考 `code-block`、`shiki-highlighter`）
- [x] `ChatComposer`：多行输入、Prompt / Steer / Follow-up 模式 UI 对齐参考；保留现有 `useChatSession` 行为
- [x] `ChatSessionBar`（Agent / model / thinking）视觉嵌入 Header 或 Composer 上方，交互不变
- [x] Session 树面板样式（参考右栏密度与节点样式）；fork / navigate 行为不变
- [x] 空态、loading、错误条样式统一（destructive / muted 语义色）

### 6.4 设置 / 认证 / 设备 / Agent 页

- [x] **Providers**：参考 `providers-settings-page` + `settings-section` / `settings-field-row` 布局；CRUD 逻辑不变
- [x] **Devices**：配对码、设备列表、连接 CLI 卡片式布局；保留 health check 与 credentials 流程
- [x] **Login / Register**：居中卡片、品牌区、表单间距；保留 Backend JWT 流程
- [x] **Agents**：列表 + 创建表单分区（Persona / Skills / Tools 勾选）；逻辑不变
- [x] **`SettingsLayout` 侧栏**：`/settings/providers` 扩展为 `/settings/*` 子路由，General 占位

---

## 已确认决策（2026-06-16）

| 项                 | 决策                                           | 说明                                                                              |
| ------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| 参考来源           | 只读 `/Users/kingen/code/muse-ai/packages/web` | **适配** v0.1 API，不复制 reference 专用 store/API                                |
| **主题**           | **默认跟随系统**                               | `colorMode: 'system'` + `prefers-color-scheme`；Header 可选手动 light/dark/system |
| **登录后 landing** | **`/chat`**                                    | 不再默认进 `/devices`；未连接设备时仍进聊天壳层，**引导方式后续再定**             |
| **聊天 URL**       | **`/chat` + `/chat/:sessionId`**               | Session 创建/切换同步 URL；刷新可恢复当前 Session                                 |
| **设备页**         | **侧栏「设备」入口**                           | `/devices` 路由保留，纳入 AppLayout；非 onboarding 全屏                           |
| **右栏**           | Session 树                                     | 参考 Trace 右栏 v0.1 不做，仅复用可伸缩面板                                       |
| **i18n**           | `packages/shared` + react-i18next              | 不切换 reference 的 locale store                                                  |
| **实施顺序**       | **6.1 → 6.2 → 6.3 → 6.4**                      | 6.3 优先于 6.4                                                                    |
| **状态管理**       | 侧栏开合等用 zustand                           | 聊天状态仍用现有 hooks                                                            |
| **测试**           | 保留 `chat-reducer` 等                         | UI 改版不破坏 reducer / API client                                                |

---

## 路由映射（目标）

| 页面        | 路径                                                     | 壳层                  | 备注                                                        |
| ----------- | -------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| 登录 / 注册 | `/login`、`/register`                                    | Guest                 | 无 AppLayout                                                |
| 新对话      | `/chat`                                                  | Protected + AppLayout | 无 `sessionId`；未连设备时占位（引导待定）                  |
| 聊天        | `/chat/:sessionId`                                       | Protected + AppLayout | 三栏：Session 列表 / 消息 / Session 树                      |
| 设备        | `/devices`                                               | Protected + AppLayout | **侧栏导航进入**，非默认 landing                            |
| Agents      | `/agents`                                                | Protected + AppLayout | 仍需已选设备才能调 CLI（页内或进入前校验，与 5.x 行为一致） |
| Providers   | `/settings` → `/settings/general`、`/settings/providers` | Protected + AppLayout | Settings 侧栏（General 占位 + Providers）                   |
| 根 / 未知   | `/`、`/*`                                                | —                     | **`Navigate` → `/chat`**                                    |

**相对阶段 5 的守卫变化：** 去掉 `DeviceRequiredLayout` 拦截 `/chat`；Agents 等依赖 CLI 的页面保留「需 deviceSession」校验（实现细节在 6.2/6.4）。

---

## 设计决策（实现）

| 项               | 决策                             | 说明                                                           |
| ---------------- | -------------------------------- | -------------------------------------------------------------- |
| 参考来源         | 只读 `code/muse-ai/packages/web` | 布局与样式借鉴；API / store / 路由按 v0.1 适配                 |
| 主题             | 默认 `system`                    | `ThemeProvider` + localStorage；Header `ThemeSwitcher`         |
| 壳层             | `react-resizable-panels`         | 左 AppSidebar / SettingsSidebar + 主区 + 聊天内 Session 树右栏 |
| Session URL      | `/chat` + `/chat/:sessionId`     | `useChatSession` + `ChatSessionProvider` URL 驱动              |
| 设置路由         | `/settings/*` 嵌套路由           | 进入 settings 时左栏切 `SettingsSidebar`；General 占位         |
| 侧栏状态         | zustand + persist                | `sidebar`、`session-tree-panel` store                          |
| i18n             | `layout` 命名空间                | 侧栏/Header 文案；`dev:web` 启动前 build `@museai/shared`      |
| Session 树 Panel | 始终挂载                         | 避免条件渲染时 `panel.isCollapsed()` 在 Group 注册前抛错       |
| 业务逻辑         | 不改阶段 5 链路                  | SSE / reducer / Backend CRUD / fork-navigate 行为保持          |

---

## 实际产出

### 1. `@museai/shared`

| 模块                                 | 变更                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `i18n/locales/{zh,en}/layout.json`   | 侧栏、Header 文案（`sidebar.*`、`header.*`）                              |
| `i18n/locales/{zh,en}/chat.json`     | `newChatHint`、`startNewSession`、`thinking.*`、`explore.*`、`input.*` 等 |
| `i18n/locales/{zh,en}/settings.json` | `nav.general`、`nav.providers`、`back`、`listTitle`                       |
| `i18n/locales/{zh,en}/common.json`   | `underDevelopment`                                                        |
| `i18n/locales/{zh,en}/device.json`   | `listTitle`                                                               |
| `i18n/resources.ts`                  | 注册 `layout` 命名空间                                                    |

### 2. `@museai/web` — 设计系统（6.1）

| 模块                                                  | 说明                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `styles/index.css`                                    | oklch token、light/dark、sidebar、scrollbar、prose                          |
| `components/theme-provider.tsx`、`theme-switcher.tsx` | 主题跟随系统 + 手动覆盖                                                     |
| `stores/theme.ts`、`utils/apply-theme.ts`             | 偏好持久化                                                                  |
| `components/ui/*`                                     | Button、Input、Textarea、Select、IconButton、Tooltip、DropdownMenu、Toaster |
| 依赖                                                  | `lucide-react`、`sonner`、`zustand`、`shiki`、`@tailwindcss/typography`     |

### 3. `@museai/web` — 应用壳层（6.2）

| 模块                               | 说明                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `layouts/app-layout.tsx`           | 可拖拽左栏 + 主区；聊天路由嵌套 Session 树右栏                              |
| `layouts/settings-layout.tsx`      | Settings 子路由 `<Outlet />`                                                |
| `components/layout/*`              | `AppSidebar`、`MainHeader`、`SessionList`、`SettingsSidebar`、resize handle |
| `context/chat-session-context.tsx` | URL 级 ChatSession 共享                                                     |
| `hooks/use-session-list.ts`        | 侧栏 Session 列表                                                           |
| `routes/guards.tsx`                | 移除 `DeviceRequiredLayout`                                                 |
| `app.tsx`                          | `/` → `/chat`；`/chat/:sessionId`；`/settings/*`                            |

**删除：** `session-sidebar.tsx`、`DeviceRequiredLayout` 用法

### 4. `@museai/web` — 聊天视觉（6.3）

| 模块                                                                                | 说明                                |
| ----------------------------------------------------------------------------------- | ----------------------------------- |
| `pages/chat-page.tsx`                                                               | 布局交 AppLayout；空态 / 无设备占位 |
| `components/chat/user-message.tsx`                                                  | 用户消息块                          |
| `components/chat/assistant-thinking-block.tsx`                                      | thinking 折叠                       |
| `components/chat/assistant-tool-group.tsx`、`tool-row.tsx`、`tool-detail-panel.tsx` | tool 分组卡片                       |
| `components/chat/chat-composer.tsx`                                                 | 多行输入 + Prompt/Steer/Follow-up   |
| `components/chat/code-block.tsx`、`utils/shiki-highlighter.ts`                      | Shiki 高亮                          |
| `components/chat/markdown-content.tsx`                                              | prose + 代码块                      |
| `components/chat/chat-session-tree-panel.tsx`                                       | 右栏 Session 树                     |

**删除：** `chat-input.tsx`、`message-parts.tsx`

### 5. `@museai/web` — 设置 / 认证 / 设备 / Agent（6.4）

| 模块                                         | 说明                                                 |
| -------------------------------------------- | ---------------------------------------------------- |
| `components/settings/*`                      | `SettingsSection`、`SettingsRow`、`SettingsFieldRow` |
| `pages/settings/general-settings-page.tsx`   | General 占位                                         |
| `pages/settings/providers-settings-page.tsx` | Provider CRUD（Backend 逻辑不变）                    |
| `components/layout/auth-layout.tsx`          | 登录/注册居中卡片                                    |
| `components/layout/page-shell.tsx`           | Devices / Agents / Settings 统一标题区               |
| `pages/login-page.tsx`、`register-page.tsx`  | AuthLayout                                           |
| `pages/devices-page.tsx`、`agents-page.tsx`  | Settings 卡片式分区                                  |

**删除：** `providers-page.tsx`、`page-content.tsx`

### 6. 根目录 / 工具链

| 变更                                         | 说明                                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| `package.json` / `packages/web/package.json` | `dev:web` 启动前 `pnpm --filter @museai/shared build` |
| `AGENTS.md`                                  | UI 基元表补充 Settings / PageShell / AuthLayout       |
| `test/utils/apply-theme.test.ts`             | 主题应用单元测试                                      |

---

## 验收

```bash
# 1. 类型与测试（web 需先 build shared，dev 脚本已内置）
pnpm --filter @museai/shared build
pnpm --filter @museai/web typecheck
pnpm --filter @museai/web test:run

# 2. 构建
pnpm --filter @museai/web build

# 3. 手动（pnpm dev:web + CLI + Server 联调）
# - 主题默认跟随系统；切换 light/dark/system 后刷新仍生效
# - 登录后进入 /chat；/chat/:sessionId 与 Session 切换同步；直链 session 无 Panel 报错
# - 侧栏 i18n 正常（非 raw key）；可进「设备」「设置」
# - 三栏可拖拽、Session 列表/树/Composer 视觉接近参考
# - thinking / tool call / Markdown 代码块渲染正常
# - /settings/general 占位、/settings/providers CRUD；Agents / 登出 路径可用
```

**2026-06-16 自动化验收：**

- `pnpm --filter @museai/web typecheck` — 通过
- `pnpm --filter @museai/web test:run` — **4 passed**（`apply-theme` 2、`chat-reducer` 2）
- `pnpm --filter @museai/web build` — 通过

**联调注意：**

- 修改 `packages/shared` 的 i18n JSON 后需 rebuild shared，或重启 `dev:web`（已自动 build）
- Session 树右栏在 `/chat/:sessionId` 首次进入时 Panel 须已挂载（见 `app-layout` 安全 imperative 调用）

---

## 未做 / 留到后续

| 能力                         | 阶段   | 说明                                                             |
| ---------------------------- | ------ | ---------------------------------------------------------------- |
| Trace / JSON 调试右栏        | v0.2+  | 参考 `trace-panel`，v0.1 不做                                    |
| 工作区目录、附件 chips       | v0.2+  | 参考 `workspace-chip`、`attachment-chips`                        |
| Skills 独立页                | v0.2+  | 参考占位 `/skills`                                               |
| Models 设置页                | v0.2+  | 参考 `models-settings-page`；v0.1 会话级 model 在 ChatSessionBar |
| Session compact / token 统计 | 7      | 见 [phase-7.md](./phase-7.md)                                    |
| 断线重连完善                 | 7      | 见 [phase-7.md](./phase-7.md)                                    |
| 未连设备时的聊天引导         | 6+ / 7 | 阶段 6 仅占位；文案与 CTA 后续迭代                               |

---

## 下一阶段

[阶段 7：打磨与自用](./phase-7.md) — 断线重连、Session compact、token 统计、文档与连续自用验收。
