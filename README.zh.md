# dsh-sidebar-sections

[English](README.md) | 简体中文

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 客户端插件：
把左边栏的对话列表重排为 **置顶 / 项目 / 最近 / 归档** 四个大分区，并为每个对话提供
**置顶 / 取消置顶、归档 / 取消归档、完整行菜单** 等管理入口。

![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4D6BFE)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)

- **无需构建、零运行时依赖**：浏览器半部是纯 JavaScript，只从 Harness 冻结的平台模块表
  `require`（`react`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-store`），
  不会因为依赖解析失败而装不上。
- **置顶由宿主持久化**：pin 集合属于宿主 Workspace Controller，不属于本插件。图钉按钮的语义是
  **分区置顶**：点图钉后对话进入「置顶」区，同时离开所属项目与「最近」；取消置顶即回到原分组。
- **原生观感与行为**：图标与控件全部复用宿主共享的 `ui-primitives` 模块表（icons、`StateDot`、
  `Menu`、`MenuItemButton`、`Tooltip`、`Button`、`Modal`、`writeClipboard`、`relativeTime`），
  插件不手绘任何图形；对话行、工作区行保持宿主原生 UI。
- **保留宿主的管理入口**：每个对话的归档/取消归档与置顶/取消置顶、完整行菜单（置顶、重命名、
  分叉、归档/取消归档、复制 Session ID）、归档分区、以及工作区的新建会话/
  重命名/删除都保留。
- **加载失败可回退**：插件通过 slot priority 遮蔽宿主浏览器；一旦本插件加载失败或渲染崩溃，
  宿主浏览器会自动接管该位置，侧边栏不会留白。

```
🔍 筛选会话和工作区…
置顶  ⌄
  ● 发布前检查清单              dsh-plugins   3分钟   📌
  ● 设计评审记录                lore-gpui     2小时   📌
项目  3  ⌄                              ＋  ⋯
  ▾ 📂 dsh-plugins
      ○ 重排侧边栏                              1分钟
  ▸ 📂 lore-gpui
  ▸ 📂 未分组
最近  4  ⌄                                ✎  ⋯
  ● 重排侧边栏                  dsh-plugins   1分钟
  ● 构建笔记                    lore-gpui     刚刚
  … 显示更多
归档  1  ⌄                                  ⋯
  ○ 旧草稿                      dsh-plugins   5分钟
```

搜索控件独占首行。四个分区标题更大更粗，折叠箭头位于标题右侧；项目与最近区先放直接操作
（`＋` / `✎`），再把 `⋯` 溢出菜单放在最右，因此所有省略号位置一致。置顶与归档区只有排序
菜单；`✎` 在宿主默认工作区中新建会话。

## 1. 功能

| 区域 | 行为 |
|---|---|
| 置顶 | 来自宿主 pin 集合，最近置顶的在前。悬停或键盘聚焦出现**取消置顶**，静止时显示 📌 标记。行保持宿主原生的对话 UI（状态、标题、时间、操作）。标题右侧的箭头可折叠分区；`⋯` 菜单只提供排序方式（**手动排序** / **最近更新**）。 |
| 项目 | 每个已登记 Workspace 一个分组，顺序与宿主一致，内部嵌套未置顶、未归档的对话。分组可折叠（浏览器本地记忆，默认展开）。悬停项目行出现**新建会话**与 **⋯** 菜单（**重命名工作区** / **删除工作区**）。项目行左侧始终是文件夹图标（展开/收起），点击行本身切换展开状态。分区标题右侧依次为 `＋`（添加工作区）与最右的 `⋯`：**分组方式**（按项目 / 单一列表）与**排序方式**（手动排序 / 最近更新）。每个项目行自己的 `⋯`（或右键）菜单还带**独立的排序方式**，可以单独把某个项目设为手动/最近更新。 |
| 最近 | 所有项目下未置顶的对话，按最近活跃倒序。默认 8 条，每次**显示更多**增加 20 条；行内只显示标题与时间。分区标题右侧依次为 `✎`（在宿主默认工作区新建会话）与最右的 `⋯`：同样的**分组方式**（按项目 / 单一列表）与**排序方式**（手动排序 / 最近更新）。 |
| 右键菜单 | 在对话行、项目行或任意分区标题上右键，会在鼠标位置打开与该处 `⋯` 按钮相同的菜单（行操作 / 项目排序 + 工作区操作 / 分区分组与排序）；菜单打开时触发行的 hover 背景会消失。 |
| 项目悬停 | 在项目行停留片刻弹出预览卡片：文件夹图标 + 项目名、可见对话数量、项目目录路径。 |
| 每个对话 | 悬停或键盘聚焦对话行出现**归档/取消归档**、**置顶/取消置顶**，以及 **⋯** 行菜单：置顶/取消置顶、重命名会话、分叉会话、归档/取消归档、复制 Session ID。在行上停留片刻会弹出预览卡片，显示对话标题、所属工作区与时间。 |
| 搜索行 | 独占首行的全宽筛选控件（按对话标题或项目名；`Esc` 清除并收起）。 |
| 分区标题 | 更大、更粗的分区标题；折叠箭头位于标题右侧，展开时向下、折叠时向右旋转。点击标题（或聚焦后按 `Enter` / `Space`）折叠/展开分区。折叠状态浏览器本地记忆；有筛选条件时分区自动展开以保证结果可见。`⋯` 始终是分区标题最右的按钮，保证各分区的省略号位置一致。 |
| 归档 | 固定的第四个分区，汇总所有项目下的归档对话（默认按宿主手动顺序）。归档行灰显、恢复前不可打开，提供**取消归档**（不提供置顶/归档）；标题 `⋯` 只提供排序方式（**手动排序** / **最近更新**），没有归档会话时显示空提示。归档对话不再出现在置顶、项目或最近区。归档仍有运行中工作的会话会弹出宿主的「停止并归档」确认，并列出将被停止的工作。 |
| 收起态 | 侧边栏收起时该区域变为三个 36px 图标按钮（筛选、添加工作区、新建会话）；点击筛选会展开侧边栏并聚焦输入框。 |
| 状态 | 每个对话的实时状态格：运行中旋转环、等待审批 / 计划待审 / 待回答的警告点与紧凑标签、已完成点、选中行高亮。 |
| 状态页 | 首屏骨架行、各分区空状态提示、空安装引导、操作失败的行内临时提示。 |
| 可访问性 | 分区使用 `section` + `h2`，标题行为 `button` 语义并带 `aria-expanded`；项目行与对话行为 `treeitem`（`aria-expanded` / `aria-selected`）；图标按钮带 `aria-label` 与宿主 tooltip；状态点带隐藏文本；对话行可用键盘操作（`Enter` / `Space` 打开，`Tab` 可达行内按钮）；焦点环使用宿主 focus token。 |

暂不实现的范围见 [§8](#8-已知限制)。

## 2. 安装

这是一个本地 bundle 包，未发布到 registry。推荐的安装方式是通过 Harness 的
Plugin Manager（由它写入 profile 清单、安装包、选中 bundle 并重组配置）：

```text
plugin_manager(action="install_bundle", target="<本目录的绝对路径>")
```

该工具在启用它的 Agent 预设（Creator 模式）里可用；Web 界面的 **插件** 页也提供同一操作。
向运行中的 profile 安装 bundle 可以通过 HMR 直接生效（无需重启）；否则重启 DeepSeek Harness。

### 本地开发安装（手工）

`plugin_manager` 不可用时，可以手工接通 profile。这正是 Plugin Manager 执行的机制，只是省去了
它的写锁与 pnpm 步骤，因此请仅作为开发路径使用：

1. 让包能从 profile 目录解析到 —— Windows 目录 junction（或符号链接）即可：

   ```powershell
   $profile = "$env:USERPROFILE\.dsh\profiles\desktop"
   New-Item -ItemType Directory -Force -Path "$profile\node_modules" | Out-Null
   New-Item -ItemType Junction -Path "$profile\node_modules\dsh-sidebar-sections" `
            -Target "<本目录的绝对路径>"
   ```

2. 用一次原子写入，在 profile 的 `package.json` 中加入 `link:` 依赖，**同时**把包名追加到
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

   只有有序 bundle 列表变化才会触发实时重组；只改 `dependencies` 会被 profile watcher 忽略。

3. 运行中的应用约 2 秒后生效。之后修改 `client.js` 会由 client HMR 在约半秒内热更新（组件重挂载）；
   修改 `index.js` 则在下次重组或重启时生效。

### 卸载

从 `dsh.profile.bundles` 中移除 `dsh-sidebar-sections`（宿主浏览器立即恢复），
再移除依赖项与 junction。使用 `plugin_manager` 时对应 `remove_bundle` 操作。

## 3. 使用

- **置顶对话**：悬停（或用 `Tab` 聚焦）任意对话行，点击宿主的图钉按钮。其语义是
  **分区置顶**：对话进入**置顶**区，同时离开所属项目分组与**最近**列表，重启后仍然保留；
  行本身保持宿主原生的对话 UI。取消置顶后回到原分组与最近区。
- **归档对话**：使用行内归档按钮或行菜单。归档后对话进入第四个**归档**分区（灰显、恢复前
  不可打开），在归档区用**取消归档**恢复。若对话仍有运行中的工作，宿主会先要求确认
  「停止并归档」，并列出将被停止的工作。
- **管理对话**：**⋯** 行菜单提供置顶/取消置顶、重命名、分叉、归档/取消归档、复制 Session ID，
  调用与宿主侧边栏相同的 Host 命令与失败提示。
- **查找**：在首行搜索框输入标题或项目名的一部分；匹配的项目分组会自动展开；`Esc` 清除。
- **折叠分区**：点击分区标题（或聚焦后按 `Enter` / `Space`）；选择会被记住。项目区 `⋯` 菜单
  按钮只使用宿主的浮层 tooltip——侧边栏不再出现原生 HTML/系统 tooltip。
- **排序与分组**：每个分区的 `⋯` 菜单提供各自的选项。置顶与归档区按**手动排序**（宿主
  保存/ pin 顺序）或**最近更新**排序；项目与最近区还可切换**按项目** / **单一列表**。所有选择
  记在浏览器本地。
- **手动排序（拖拽）**：把分区切到**手动排序**（或把某个项目的项目菜单排序设为手动）后，行可
  直接拖拽——拖到另一行的上半/下半即插入其前/后，并有插入线提示。排序结果保存在浏览器本地
  （`dsh.sidebarSections.manualOrder`）；真实 Workspace 分组还会通过
  `workspaces.insertSessionBefore` 写回宿主。项目级排序偏好存于
  `dsh.sidebarSections.projectSorts`。空白草稿行与跨分组拖动不可用。
- **右键菜单**：在任意对话行、项目行或分区标题上右键，打开与对应 `⋯` 相同的操作菜单。
- **分区快捷按钮**：项目区 `＋` 通过宿主目录选择器添加工作区；最近区 `✎` 在宿主默认工作区
  新建会话（显示为 `workspace.defaultName` 的本地化名称）。
- **悬停预览**：在对话行上停留片刻，会弹出包含标题、所属工作区与时间的浮动卡片；在项目行停留则显示项目名、可见对话数与目录路径。
- **整理项目**：悬停项目行使用*新建会话*与 *⋯*；菜单可重命名或删除 Workspace 登记。
  删除 Workspace 不会删除对话 —— 它们会进入**未分组**。
- **添加项目**：使用项目区标题右侧的 `＋`；宿主打开目录选择器，登记该目录并在其中新建会话。
- **折叠项目**：点击项目行。折叠状态记在浏览器 `localStorage` 中，仅是视图状态，不写入宿主。

## 4. 实现原理

`sidebar.workspaces` 是 `ui-sidebar` 声明的 root `single` slot。宿主
`@deepseek-ai/dsh-client-ui-workspace` 以默认优先级 `0` 注册原生浏览器；本插件以优先级 `-1`
注册替代实现。slot 渲染优先级最低的存活注册，因此与插件加载顺序无关。被遮蔽的注册仍留在
ledger 上（并继续持有它的子 slot 声明），所以本插件**不声明任何 children**，菜单、行内按钮与
对话框全部自绘。

```
sidebar.workspaces (single, root)
├── @deepseek-ai/dsh-client-ui-workspace   优先级  0   宿主原生浏览器
└── dsh-sidebar-sections                    优先级 -1   本插件（实际渲染）
```

- **读**：`useSessions`（会话目录与持有关系）、`useWorkspaces`（工作区行、pin/归档集合）、
  `useSessionStatus`（运行中 / 等待交互 / 未读完成）、`usePanelInfo`（全局面板激活时抑制选中态）。
  组件自身不订阅任何 store。
- **写**：`ctx.get('uiWorkspace')` 负责导航、置顶、归档、分叉与目录选择（`openSession`、
  `startSession`、`pinSession`、`unpinSession`、`archiveSession`、`unarchiveSession`、
  `forkSession`、`pickDirectory`）；`ctx.get('workspaces')` 负责工作区管理（`create`、`rename`、
  `delete`）；会话重命名通过 `ctx.get('sessions').using()`。失败会以行内提示呈现，不会静默丢弃。
- **复用**：图形与控件全部来自共享的 `ui-primitives`：`Menu` / `MenuItemButton` / `Tooltip`
  构建行、项目与分区菜单，`StateDot` 渲染状态格，`Modal` + `Button` 渲染全部对话框，
  `writeClipboard` 复制 Session ID，`relativeTime` 提供行时间桶。插件自己的样式表只负责布局
  与插件特有外壳。
- **对话框**：工作区重命名/删除、会话重命名与「停止并归档」注册到 root `shell.overlay` 列表，
  因此渲染在整个 frame 之上，不会被侧边栏裁剪。侧边栏与 overlay 之间通过注册 `inject` 面上的
  一个裸 observable 通信。
- **派生**：一个纯函数把快照折叠成渲染节点：隐藏子智能体会话、非当前空白会话；归档会话
  单独汇总为归档池，不进入其它分区；置顶行按 pin 数组顺序；项目成员按最近活跃排序且当前
  空白会话置顶；未归属会话进入末尾分组；最近区按 `updatedAt` 排序并与置顶区去重。
- **样式**：一个 `<style>` 元素持有全部类名（`dshss-` 前缀）；颜色与尺寸全部来自宿主 token 与
  宿主测量值，图形来自 `ui-primitives`。
- **模块格式**：浏览器半部是 classic script，调用
  `window.__ModuleLoader__.load({ id: '<包名>', factory })` 并返回 Cordis 插件（`{ inject, apply }`）。
  Host 半部是一个空的 `apply`，仅用于让包成为 Loader entry —— 客户端模块注册表正是通过它发现
  浏览器 bundle 的。

## 5. 兼容性

| 组件 | 版本 |
|---|---|
| DeepSeek Harness | `0.2.1-rc.2`（源码 tag `dsh-v0.2.1-rc.2`） |
| Client slot API | 预稳定（pre-stable）；已对照宿主 `ui-slots` / `ui-workspace` / `ui-sidebar` 契约验证 |
| 运行时 | DSH Desktop / Web 自带 Node，无外部 Node 依赖 |
| 平台 | Web 与 Desktop 的 Web 界面（已在 Windows 验证；无平台相关代码） |

Harness 客户端 API 明确标注为预稳定。DSH 升级后请重新运行 `node scripts/check.mjs` 并复查实机
界面；slot 契约变化可能需要同步更新本插件。

## 6. 验证

`scripts/check.mjs` 是一个零依赖测试套件（53 项），直接使用 Node 运行：

```sh
node scripts/check.mjs
```

覆盖内容：

- 包清单、exports、`files`、bundle patch、插件管理器显示元数据、图标尺寸与格式、仅使用平台模块，
  以及“禁止手抄 SVG 路径数据（图形必须复用 ui-primitives）”规则；
- `apply` 恰好注册一个获胜优先级的 `sidebar.workspaces` 替代实现，以及一个 `shell.overlay`
  对话框，并注册完整的中英文字典；
- 从 fixture 快照派生的区块：置顶顺序、项目嵌套、最近区排序（保持宿主行 UI、无行徽标）、
  子智能体/非当前空白会话的隐藏、当前空白会话的位置、归档池的独立汇总；
- 归档分区：归档行只出现在归档区（不出现在置顶/项目/最近），灰显、以「取消归档」代替置顶，
  无归档时显示空提示；
- 每个分区的 `⋯` 菜单：置顶与归档只有排序方式；项目 / 最近提供分组方式与排序方式（没有
  收起/展开全部项目项），且选择会浏览器本地持久化；对话行带有供悬停预览使用的工作区信息；
  行与按钮不输出原生 `title` tooltip；
- 手动排序：手动模式下行为可拖拽，放下后重排并持久化手动顺序；最近更新模式下不可拖拽；
  项目行保持文件夹图标，不会在悬停时变成箭头；
- 项目级排序：单个项目的排序偏好只重排该分组并持久化，真实 Workspace 分组同时派发宿主
  `insertSessionBefore`；
- 右键菜单：对话行、项目行、分区标题都能打开对应菜单并派发相同操作（归档行右键只有取消归档、
  没有置顶）；右键菜单打开时根节点带 `dshss-menuActive`（抵消 hover 背景）；
- 悬停预览：对话卡片渲染标题/项目/时间并在移出后清除；项目卡片从行的 data 属性渲染名称/
  可见对话数/路径；
- 拖拽手动排序还覆盖「上半部插入到前面」的落点，并禁止拖拽空白草稿行；
- 静态检查：菜单打开样式不再绘制 hover 背景；
- 新侧边栏外壳：搜索控件独占一行、独立的「工作区」标题已移除、折叠箭头在标题右侧、
  四个分区折叠/展开并持久化、项目/最近区的 `⋯` 位于最右、项目区 `＋` 添加工作区、
  最近区 `✎` 在宿主默认工作区新建会话、`⋯` 菜单提供分区专属项；
- 交互派遣：置顶/取消置顶、归档（含「停止并归档」拒绝路径）、取消归档、完整会话行菜单
  （重命名请求、分叉、归档、复制 Session ID）、打开、新建会话、添加工作区（选择器 → 登记 →
  开会话）、项目重命名/删除请求、本地筛选与 `Esc`、折叠持久化、收起态；
- 对话框提交：工作区重命名、会话重命名（经 `sessions.using`）、删除文案与保留边界、
  「停止并归档」及其活动列表。

测试套件用迷你 React/hooks 运行时驱动真实组件函数（含状态、effects 与合成事件），
宿主 `ui-primitives` 由 host-shaped fake 替代（菜单、Modal、Button、剪贴板、相对时间、图标占位）。

已在运行中的 DSH Desktop `0.2.1-rc.2` profile 做实机验证：新 UI 热更新后，搜索独占首行、
四个分区标题（含归档）加大加粗，折叠箭头在标题右侧，`⋯` 统一位于最右；点击分区标题可
折叠/展开（`Enter` 亦可）；归档区 `⋯` 只有排序方式，项目/最近区 `⋯` 提供分组与排序、
无收起/展开全部项目项；最近区 `✎` / `⋯` 可用；此前已实机验证置顶/取消置顶的分区联动与
归档恢复，测试状态均已复原。

## 7. 开发

```
dsh-sidebar-sections/
├── package.json              # bundle patch + dsh.client 清单、exports、files
├── cordis.patch.yml          # 插入 `sidebar-sections` Loader 行
├── index.js                  # Host 半部：空 apply（用于发现浏览器 bundle）
├── client.js                 # 浏览器半部：纯 JS，无构建步骤
├── icon.svg                  # 插件管理器图标（原创）
├── locale/                   # 插件管理器标题/描述（en、zh）
├── scripts/check.mjs         # 零依赖验证套件
├── README.md / README.zh.md  # 英文文档与本文
├── CHANGELOG.md
└── LICENSE
```

开发内环：

1. 把包链接进一个开发用 profile（见 [§2](#2-安装)）。
2. 每次修改后运行 `node scripts/check.mjs`。
3. 修改 `client.js`，运行中的页面约半秒内重挂载浏览器（client HMR 轮询产物；若窗口被遮挡，
   前台化后 HMR 会应用积压的更新）。
4. 只有改 Host 行时才需要改 `index.js` / `package.json`；它们在下次重组或重启时生效。

贡献约定：

- 浏览器半部保持零依赖：只允许 `require` 平台模块表中的模块；图标/控件复用 `ui-primitives`。
- 不要声明任何 `sidebar.workspaces.*` 子 slot —— 被遮蔽的宿主注册仍持有它们；改为自绘 UI。
- 使用主题 token，不要写死颜色；行与控件沿用宿主测量值。
- 所有用户可见文案走插件自己的 locale 命名空间（中英双语齐全）。
- 保持 `README.md` 与 `README.zh.md` 同步，并在 `CHANGELOG.md` 记录用户可见变更。

## 8. 已知限制

- **归档分区固定存在**：第四个分区始终显示（无归档时显示空提示），不再提供可切换的
  归档视图，也不支持把归档行混排进项目/最近区。

- **分组/排序为分区级**：宿主的全局 *分组方式*（工作区树 / 单列表）与 *排序方式* 被替换为
  各分区 `⋯` 菜单中的 *按项目 / 单一列表* 与 *手动排序 / 最近更新*；祖先目录下的工作区树
  嵌套未复刻。
- **手动排序范围**：拖拽只在单个列表/分组内生效（不支持跨项目移动）；真实 Workspace 分组之外
  的顺序保存在浏览器存储中，而不是宿主数据。
- **仅本地筛选**：只匹配已加载的对话标题与项目名，不使用宿主消息内容检索；
  宿主原生的 `Ctrl+K` 搜索命令不再驱动本浏览器。
- **添加工作区依赖原生目录选择器**：本地 Desktop/Web 组合提供原生选择器；
  若部署只组合了浏览式 picker，会显示不可用提示而不是选择流程。
- **未复刻**：子智能体运行数、hover 卡片、计划任务标记、工作区树在祖先目录下的嵌套、
  带消息摘要的搜索结果列表。

## 9. 排障

| 现象 | 可能原因 / 处理 |
|---|---|
| 安装后侧边栏没变化 | bundle 未被选中，或 profile 未重组。确认 `dsh.profile.bundles` 含 `dsh-sidebar-sections`，然后重启 DSH。 |
| 又变回宿主 Workspace 浏览器 | 插件未激活（被卸载、加载失败或渲染崩溃）。slot 回退会恢复宿主浏览器，这是设计行为。检查设置 → 插件与浏览器控制台。 |
| 没有置顶/项目/最近标题，侧边栏空白 | 插件在等待服务（`inject: slots, locale, uiWorkspace, workspaces, sessions`）；确认宿主的 sidebar/workspace/layout bundle 已启用。 |
| 窗口在后台时改了代码没生效 | 页面被遮挡会节流 HMR 轮询；把 DSH 窗口切到前台后会自动应用。 |
| 添加工作区提示不可用 | 当前组合的目录选择器后端不提供原生系统选择框。 |
| 点置顶没有反应 | 对未知/已归档会话的 pin 会被拒绝；行内提示会带宿主的错误码与信息。 |
| 最近区为空 | 所有可见对话要么已置顶，要么已归档。 |

## 10. 路线图

- 本地筛选支持模糊标题匹配。
- 筛选可选用宿主内容检索。
- 在保留分区结构的前提下提供分组/排序视图模式（例如工作区树嵌套）。
- 行 hover 卡片与计划任务/子智能体标记。
- 通过插件的 `Config` schema 提供配置行（最近条数、分区显隐）。

## 11. 许可证

[MIT](LICENSE)

图标与控件在运行时解析自 DeepSeek Harness 仓库的 `ui-primitives` 包（同为 MIT），
本插件不复制其源码。主题 token 与行测量值遵循宿主 `ui-sidebar` / `ui-workspace` / `ui-theme` 包。
