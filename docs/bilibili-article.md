# 发布信息（复制正文时删掉这一节）

- **标题候选 1（主推）**：喜欢 Codex 的侧边栏分区？我给 DeepSeek Harness 也做了一个
- **标题候选 2**：DSH 新版本刚发布，我顺手让新模型写了个四分区侧边栏插件
- **标题候选 3**：昨天 DSH 更新，今天插件基本完成：Codex 风格对话分区
- **封面**：`docs/bilibili-cover.png`（1146×717，可直接上传）
- **标签**：DeepSeek、DeepSeek Harness、DSH、Codex、开源、效率工具、插件开发
- **正文配图**：`docs/screenshot.png`（多场景拼图）
- **开源地址**：https://github.com/tzhaos/dsh-sidebar-sections

---

# 喜欢 Codex 的侧边栏分区？我给 DSH 也做了一个

一直很喜欢 Codex 左侧边栏那种对话分区管理：置顶、项目、最近、归档各自分开，找东西不用在一条长列表里来回翻。

昨天 DeepSeek Harness 出了新版本，我一时兴起，把自己的几个需求整理了一下，让新模型帮我写了个 DSH 插件。本来只是想试试，结果效果比预期好不少，现在已经基本完成，也开源了。

插件叫 **dsh-sidebar-sections**，做的事情很简单：把 DSH 的侧边栏改成「置顶 / 项目 / 最近 / 归档」四个分区。

- **置顶**：重要对话固定在最上面
- **项目**：按 Workspace 分组，可折叠
- **最近**：按活跃时间排列的时间线
- **归档**：归档对话独立成一个分区

每个分区有自己的菜单，可以单独设置「按项目分组 / 单一列表」和「手动排序 / 最近更新」；项目还可以单独覆盖排序。手动模式下可以直接拖拽会话排序，顺序会写回宿主；右键行、项目或分区标题可以打开菜单，项目菜单里还有「在文件管理器中打开」。搜索、归档、取消归档这些也都保留了。

![dsh-sidebar-sections 2.3.0：四分区侧边栏、分区菜单与项目菜单](screenshot.png)

*图片说明：左侧为四分区侧边栏，中间为分区菜单，右侧为项目菜单。截图对应当前 2.3.0 版本。*

## 安装

```text
git clone https://github.com/tzhaos/dsh-sidebar-sections.git
plugin_manager(action="install_bundle", target="<插件目录的绝对路径>")
```

在启用 Creator 预设的 DSH 会话里执行，`target` 填插件的绝对路径。如果当前 profile 之前已经装过同名插件，会提示 `already-installed`，先 `remove_bundle` 再装即可。

然后在 DSH 的插件设置里启用。需要 DSH **0.2.1-rc.2** 左右的新版本；客户端 API 目前还是 pre-stable，后续 DSH 如果改接口，插件可能需要跟着适配。

目前已知的小限制：拖拽只在同一个列表/项目内生效，搜索只匹配已加载的标题、项目名和目录名，不是消息内容搜索。其他问题欢迎在评论区反馈，或者直接去 GitHub 提 issue。

**仓库**：https://github.com/tzhaos/dsh-sidebar-sections

如果你也喜欢 Codex 那种分区管理，或者单纯想让 DSH 的侧边栏清爽一点，可以试试。

这个插件是我提需求、让新模型写的，我主要负责验收；后续有 bug 或想要的功能，评论区见。
