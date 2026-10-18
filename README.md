# dsh-sidebar-sections

简体中文 | [English](README.en.md)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 客户端插件：把侧边栏
变成 **置顶 / 项目 / 最近 / 归档** 四个分区的对话浏览器，带分区菜单、拖拽排序、右键菜单、安全删除、插件设置与文件管理器快捷入口。

![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4D6BFE)
![Version](https://img.shields.io/badge/version-2.3.0-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![Checks](https://img.shields.io/badge/checks-67-brightgreen)

![侧边栏分区、分区菜单与项目菜单](docs/screenshot.png)

## 目录

- [为什么](#为什么)
- [功能](#功能)
- [安装](#安装)
- [使用](#使用)
- [实现原理](#实现原理)
- [兼容性](#兼容性)
- [开发](#开发)
- [测试](#测试)
- [排障](#排障)
- [已知限制](#已知限制)
- [贡献](#贡献)
- [许可证](#许可证)

## 为什么

宿主侧边栏把对话嵌在 Workspace 分组里，归档对话藏在一个可切换的视图中。长期使用的项目往往
需要同一批对话同时出现在多个位置：置顶区、项目树、按时间排序的最近区，以及独立的归档区。

本插件的原则是**只改布局、不丢宿主能力**：

- **置顶 / 归档**成为正式分区，而不是可切换的过滤视图。
- **项目**保留可编辑的 Workspace 分组，分组方式与排序可以按分区、按项目分别设置。
- **最近**是不受历史长度限制的时间线。
- 所有管理动作（置顶、归档、重命名、分叉、复制 Session ID、调整顺序）都仍然走宿主 API，
  关键数据不会只存在插件内存里。
- 安全删除只移除侧边栏视图记录，并在插件设置里提供恢复；不会静默修改宿主数据。

## 功能

### 四个分区

| 分区 | 内容 |
|---|---|
| **置顶** | 宿主 pin 集合，最近置顶的在前；行保持宿主原生对话 UI，静止时显示 📌。 |
| **项目** | 每个已登记 Workspace 一个可折叠分组（折叠状态浏览器本地记忆），保留文件夹图标；每个项目可独立排序。 |
| **最近** | 未置顶对话，按最近活跃倒序（默认 8 条，每次「显示更多」+20 条）；可选按项目分组。 |
| **归档** | 所有归档对话，灰显、恢复前不可打开；可在插件设置里关闭；空时显示提示。 |

标题为大号加粗行，带折叠箭头与右侧按钮；`⋯` 永远是分区标题最右侧的按钮，各分区对齐。

### 对话行

- 悬停或键盘聚焦出现**归档/取消归档**、**置顶/取消置顶**与 **⋯** 行菜单（置顶/取消置顶、重命名、
  分叉、归档/取消归档、复制 Session ID）。
- **右键**或按 `Shift+F10` / Context Menu 键，在鼠标位置或聚焦元素处打开同样的菜单。
- 悬停约 400ms 显示预览卡片：标题、所属项目与时间。鼠标可以顺着移动到卡片上；只有同时离开
  行与卡片后卡片才消失。
- 归档行提供**取消归档**与**删除会话（安全）**，且不可打开。

### 排序

| 选项 | 作用域 |
|---|---|
| **手动排序** | 在分区/项目内拖拽行，拖到目标上半/下半即插入其前/后，有插入线提示，靠近列表边缘自动滚动。 |
| **最近更新** | 只读的时间顺序。 |
| **按项目 / 单一列表** | 项目、最近的分组方式。 |

- 顺序保存在浏览器本地，刷新后保持。
- 真实 Workspace 分组还会通过 `workspaces.insertSessionBefore` 写回宿主；写回失败显示行内提示。
- 项目菜单提供 **跟随分区排序 / 手动排序 / 最近更新**，可恢复默认。
- 空白草稿行、跨分组拖动、以及筛选状态下不允许拖拽。

### 右键与键盘

- 右键对话行、项目行或任意分区标题均可打开对应菜单。
- 键盘：`Shift+F10` / Context Menu 打开菜单；`Enter`/`Space` 激活行；`Tab` 到达行内操作；
  `Esc` 关闭菜单或清空筛选。

### 插件设置与安全删除

打开 **设置 → 插件（内置插件）→ 侧边栏分区**：

- **显示归档分区**：开启/关闭归档分区；关闭后归档会话仍保留在宿主中。
- **已移除的会话**：安全删除的会话会列在这里，可一键恢复。

安全删除入口在归档行的右键/`⋯` 菜单里。删除前会弹确认框；操作只把会话从本插件的侧边栏
视图中移除，并在浏览器本地记录一个可恢复的 tombstone，不会调用宿主删除 API，也不会修改磁盘上
的会话记录。恢复后会话回到原来的分区。

### 搜索与视图状态

- 独占首行的全宽搜索框，按对话标题、项目名或目录名筛选；匹配的分组自动展开；`Esc` 清除并收起。
- 视图状态全部存于 `localStorage` 的 `dsh.sidebarSections.*`：折叠状态、分组/排序、项目级排序
  覆盖、拖拽顺序、归档分区显隐与安全删除列表；宿主数据（pin/归档集合、会话标题）不会在本地复制。

## 安装

### Plugin Manager（推荐）

在启用 Creator 预设的会话中执行：

```text
plugin_manager(action="install_bundle", target="<本目录的绝对路径>")
```

Plugin Manager 会写入 profile 清单、安装/链接 bundle、选中并重组配置。安装进运行中的 profile 可
通过 HMR 直接生效，无需重启。

> 注意：`install_bundle` 只在 Creator 预设的会话中可用，每次调用需要 Full Access 或审批；`target`
> 必须是绝对路径。如果当前 profile 已经装过同名插件（例如之前手工 link 过），会返回
> `already-installed`，请先 `remove_bundle` 再安装，或继续使用下面的手工安装方式开发。

### 手工安装（开发用）

1. 让包能从 profile 目录解析到：

   ```powershell
   $profile = "$env:USERPROFILE\.dsh\profiles\desktop"
   New-Item -ItemType Directory -Force -Path "$profile\node_modules" | Out-Null
   New-Item -ItemType Junction -Path "$profile\node_modules\dsh-sidebar-sections" `
            -Target "<本目录的绝对路径>"
   ```

2. 一次原子写入 profile 的 `package.json`：加入 `link:` 依赖，**同时**把包名追加到
   `dsh.profile.bundles`：

   ```json
   {
     "dependencies": {
       "dsh-sidebar-sections": "link:<本目录的绝对路径>"
     },
     "dsh": {
       "profile": {
         "bundles": ["…原有 bundles…", "dsh-sidebar-sections"]
       }
     }
   }
   ```

   只有有序 bundle 列表变化才会触发实时重组；只改 dependencies 会被 profile watcher 忽略。

3. 运行中的应用约 2 秒后生效；之后修改 `client.js` 会由 client HMR 在约半秒内热更新。

### 卸载

从 `dsh.profile.bundles` 移除 `dsh-sidebar-sections`（宿主浏览器立即恢复），再移除依赖与
junction；使用 Plugin Manager 时对应 `remove_bundle`。

### 环境要求

- DeepSeek Harness `0.2.1-rc.2`（Web 或 Desktop Web 界面）。
- 无需构建、无需安装依赖、零运行时依赖。

## 使用

1. **置顶对话**：悬停行按图钉。对话进入**置顶**区，同时离开项目分组与**最近**；取消置顶恢复。
2. **归档对话**：使用行内归档按钮或菜单。对话进入**归档**区，在那里用**取消归档**恢复；仍有运行
   中工作时会弹出宿主的「停止并归档」确认。
3. **排序与分组**：打开分区 `⋯` 菜单。置顶/归档只有排序；项目/最近提供分组与排序；每个项目行
   的 `⋯` 菜单额外提供项目级排序覆盖。
4. **手动排序**：切到手动排序后拖拽行；项目级手动排序在分区仍是「最近更新」时也生效。
5. **打开项目目录**：右键项目行（或点 `⋯`）选择**在文件管理器中打开**。
6. **查找**：在搜索行输入；匹配分组自动展开；`Esc` 关闭。
7. **不用鼠标打开菜单**：聚焦行/项目/分区标题后按 `Shift+F10`。

## 实现原理

`sidebar.workspaces` 是 `ui-sidebar` 声明的 root `single` slot。宿主
`@deepseek-ai/dsh-client-ui-workspace` 以默认优先级 `0` 注册；本插件以优先级 `-1` 注册。slot
渲染优先级最低的存活注册，因此与加载顺序无关。被遮蔽的注册仍留在 ledger 上（并继续持有其子
slot 声明），所以本插件**不声明任何 children**，自行渲染行、菜单与对话框。

```
sidebar.workspaces (single, root)
├── @deepseek-ai/dsh-client-ui-workspace   优先级  0   宿主浏览器
└── dsh-sidebar-sections                    优先级 -1   本插件（实际渲染）
```

```
ui-sidebar slot
   └─ Browser (client.js)
        ├─ deriveSections()  纯函数：快照 → pinned / projects / recent / archived
        ├─ Browser state     搜索、折叠、视图、手动顺序、拖拽/悬停/右键状态
        ├─ shell.overlay     工作区重命名/删除、会话重命名、停止并归档对话框
        └─ uiWorkspace / workspaces / sessions   所有宿主写入
```

- **读**：`useSessions`、`useWorkspaces`、`useSessionStatus`、`usePanelInfo`（由 slot 渲染器注入，
  组件不直接订阅 store）。
- **写**：`ctx.get('uiWorkspace')`（`openSession`、`startSession`、`pinSession`、`unpinSession`、
  `archiveSession`、`unarchiveSession`、`forkSession`、`pickDirectory`）、
  `ctx.get('workspaces')`（`create`、`rename`、`delete`、`insertSessionBefore`）、
  `ctx.get('sessions').using()`（会话重命名）。失败以行内提示呈现。
- **复用**：图标、`StateDot`、`Menu`、`Tooltip`、`Button`、`Modal`、`writeClipboard`、
  `relativeTime` 全部来自共享的 `ui-primitives` 模块；插件不绘制图形。
- **文件管理器**：项目菜单通过 `remote.session.openWorkspacePath({ path })`
  让宿主在系统文件管理器中定位项目目录（未分组没有路径，不显示该项）。
- **对话框**：注册到 root `shell.overlay`，渲染在整个 frame 之上，不会被侧边栏裁剪；侧边栏与
  overlay 之间通过注册 `inject` 面上的一个裸 observable 通信。
- **模块格式**：classic script 调用
  `window.__ModuleLoader__.load({ id: '<包名>', factory })`；factory 返回 Cordis 插件
  （`{ inject, apply }`）。Host 半部是空 `apply`，仅用于让包成为 Loader entry，使客户端模块
  注册表发现浏览器 bundle。

### 浏览器本地状态

| Key | 内容 |
|---|---|
| `dsh.sidebarSections.collapsed` | 折叠的 Workspace 分组。 |
| `dsh.sidebarSections.collapsedSections` | 折叠的置顶/项目/最近/归档分区。 |
| `dsh.sidebarSections.sectionViews` | 各分区分组与排序选择。 |
| `dsh.sidebarSections.projectSorts` | 项目级排序覆盖。 |
| `dsh.sidebarSections.manualOrder` | 拖拽产生的手动顺序。 |

## 兼容性

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `0.2.1-rc.2`（源码 tag `dsh-v0.2.1-rc.2`） |
| Client slot API | 预稳定；已对照宿主 `ui-slots` / `ui-workspace` / `ui-sidebar` 契约验证 |
| 运行时 | DSH Desktop / Web 自带 Node，无外部依赖 |
| 平台 | Web 与 Desktop 的 Web 界面（已在 Windows 验证；无平台相关代码） |

Harness 客户端 API 明确标注为预稳定。DSH 升级后请重新运行 `node scripts/check.mjs` 并复查实机
界面；slot 契约变化可能需要同步更新本插件。

## 开发

本插件是一个独立的 Git 仓库。上层的集合目录只是用来并列放置多个独立插件仓库的
工作区；CI、编辑器配置与贡献规范都由本仓库自己维护。

```
dsh-sidebar-sections/         # 仓库根目录
├── package.json              # bundle patch + dsh.client 清单、exports、files
├── cordis.patch.yml          # 插入 `sidebar-sections` Loader 行
├── index.js                  # Host 半部：空 apply（用于发现 bundle）
├── client.js                 # 浏览器半部：纯 JS，无构建步骤
├── icon.svg                  # 插件管理器图标
├── locale/                   # 插件管理器标题/描述（en、zh）
├── docs/screenshot.png       # README 实机截图
├── scripts/check.mjs         # 零依赖验证套件
├── .github/workflows/check.yml  # CI：node scripts/check.mjs
├── .editorconfig / .gitattributes / .gitignore
├── README.md / README.en.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

开发内环：

1. 把包链接进开发用 profile（见 [安装](#安装)）。
2. 每次修改后运行 `node scripts/check.mjs`。
3. 修改 `client.js`，运行中的页面约半秒内热更新浏览器挂载。
4. 只有 `index.js` / `package.json` 变更才需要重组或重启。

贡献约定见 [CONTRIBUTING.md](CONTRIBUTING.md)，要点：浏览器半部保持零依赖且只允许平台
模块表；不声明子 slot；复用 `ui-primitives`；只使用主题 token；中英字典保持同步；用户可见变更
写入 `CHANGELOG.md`。

## 测试

`scripts/check.mjs` 是零依赖 Node 套件（67 项），覆盖：

- 包清单、exports、`files`、bundle patch、插件管理器显示元数据、图标、仅平台模块，以及
  「禁止手抄 SVG 路径」的复用规则；
- `apply` 注册（一个 `sidebar.workspaces` 替代 + 一个 `shell.overlay` 对话框）与中英文字典一致；
- 纯派生：置顶顺序、项目嵌套、最近排序、归档独占、隐藏子智能体/空白行、折叠与筛选状态；
- 四个分区菜单、项目菜单（含项目级排序重置）、鼠标/键盘右键菜单、悬停预览、拖拽前/后落点、
  空白行与筛选状态的拖拽保护；
- 宿主动作派发（置顶、归档含 stop-and-archive 拒绝、取消归档、分叉、复制 ID、工作区
  添加/重命名/删除、会话重命名、顺序写回、打开项目目录）与失败提示；
- 静态卫生：无 DOM `title` 原生 tooltip、无字面量颜色、菜单打开不绘制 hover 背景。

套件通过迷你 React/hooks 运行时与 host-shaped 的 `ui-primitives` fake 驱动真实组件函数，无需
安装依赖。

不自动化（设计边界）：真实浏览器中的 HTML5 拖拽/右键/悬停计时、像素级布局，以及宿主
预稳定 UI 的契约之外行为。

## 排障

| 现象 | 可能原因 / 处理 |
|---|---|
| 安装后侧边栏没变化 | bundle 未被选中或 profile 未重组；确认 `dsh.profile.bundles` 含 `dsh-sidebar-sections`，然后重启 DSH。 |
| 又变回宿主 Workspace 浏览器 | 插件未激活（被移除、加载失败或渲染崩溃）；slot 回退是设计行为，检查设置 → 插件与浏览器控制台。 |
| 没有分区标题，侧边栏空白 | 插件在等待服务（`inject: slots, locale, uiWorkspace, workspaces, sessions`）；确认宿主 sidebar/workspace/layout bundle 已启用。 |
| 代码修改没生效 | 窗口在后台会节流 client HMR；把 DSH 窗口切到前台。 |
| 添加工作区提示不可用 | 当前组合的目录选择器后端没有原生选择框。 |
| 点置顶没反应 | 宿主拒绝未知/已归档会话的 pin；行内提示会带宿主错误码与信息。 |
| 最近区为空 | 所有可见对话要么已置顶，要么已归档。 |
| 提示「调整排序失败」 | 宿主拒绝了顺序写回（例如 Workspace 并发变更）；界面保留最后确认的顺序。 |

## 已知限制

- **分组/排序为分区级**：宿主全局的分组/排序模式被替换为各分区选项；不支持祖先目录下的
  工作区树嵌套。
- **归档分区可关闭**：设置里可隐藏归档分区；归档行不会混排进项目/最近，关闭后仍保留在宿主中。
- **安全删除不是磁盘清除**：只从侧边栏移除并保留可恢复记录，宿主会话日志仍在磁盘上；如需彻底清除，需要宿主层面的删除能力。
- **手动排序范围**：拖拽只在单个列表/分组内生效（不支持跨项目移动）；真实 Workspace 分组之外的
  顺序保存在浏览器存储中。
- **仅本地筛选**：只匹配已加载的标题/项目名，不使用宿主消息内容检索与 `Ctrl+K` 入口。
- **未复刻**：子智能体运行数、消息 hover 卡片、计划任务标记、工作区树嵌套、带消息摘要的
  搜索结果列表。
- **预稳定 API**：DSH 升级可能改变 slot/service 契约。

## 贡献

欢迎 issue 与 pull request。动手前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，并在提交前
运行 `node scripts/check.mjs`；保持中英 README 与 `CHANGELOG.md` 同步。

## 许可证

[MIT](LICENSE)

图标与控件在运行时解析自 DeepSeek Harness 仓库的 `ui-primitives` 包（同为 MIT），本插件不复制
其源码。主题 token 与测量值遵循宿主 `ui-sidebar` / `ui-workspace` / `ui-theme` 包。
