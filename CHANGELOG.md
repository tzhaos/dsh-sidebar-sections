# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-10-18

Hover polish and project previews.

### Added

- **Project hover preview**: hovering a project row for ~400 ms opens a card with the folder icon
  and project name, the visible conversation count, and the canonical directory path. Project rows
  carry `data-project-label` / `data-project-path` / `data-project-count` for it.

### Fixed

- A row no longer keeps its hover surface after its menu is triggered: the trigger-row background
  rule no longer follows `dshss-menuOpen`, and while a right-click context menu is open the root
  carries `dshss-menuActive`, which cancels row/project hover backgrounds until the menu closes.

### Verified

- `node scripts/check.mjs`: 51 checks green (project hover metadata, context-menu hover
  suppression state, plus the existing context-menu and sorting coverage).

## [1.6.0] - 2026-10-18

Right-click menus and per-project sorting.

### Added

- **Right-click context menus**: right-click a conversation row, a project row, or any section
  heading (Pinned / Projects / Recent / Archived) to open the same menu as its `⋯` button,
  positioned at the pointer. The menu dispatches the same actions as the button menu.
- **Per-project sorting**: every project row's `⋯` (and right-click) menu now carries its own
  **Sort chats by** override (Manual order / Last updated), stored in
  `dsh.sidebarSections.projectSorts`. A project in manual order can be drag-reordered on its own
  even when the section-wide sort is Last updated, and real Workspace groups dispatch
  `workspaces.insertSessionBefore` to persist the Host order.

### Changed

- The Projects section menu keeps its section-wide grouping/sort; per-project overrides take
  precedence for that project.
- Menu labels use the existing localization keys; no new locale keys were required.

### Verified

- `node scripts/check.mjs`: 49 checks green (right-click row/project/section menus dispatch their
  actions, per-project sort override persists, per-project manual drag reorders and writes the
  Host order).

## [1.5.0] - 2026-10-18

True manual ordering and menu/icon cleanup.

### Added

- **Drag-and-drop manual ordering**: when a section's sort is **Manual order**, its rows become
  draggable. Dropping on a row's upper/lower half inserts before/after with a drop line; the order
  is persisted browser-locally (`dsh.sidebarSections.manualOrder`). Real Workspace groups also
  persist the order through `workspaces.insertSessionBefore`.
- Blank draft rows are excluded from dragging.

### Removed

- *Collapse all projects* / *Expand all projects* from the Projects section menu (and their locale
  keys); collapse remains per row/heading.

### Changed

- Project rows keep the folder icon (open/closed) at all times; hovering no longer swaps it for a
  disclosure chevron. Clicking the row still toggles expansion.
- The `SectionMenu` component is now grouping/sort only.

### Verified

- `node scripts/check.mjs`: 45 checks green (drag reorder + persisted manual order, updated-sort
  rows static, folder icon retained, Projects menu exact items).
- Git repository initialized for the plugin workspace so every plugin revision is tracked.

## [1.4.0] - 2026-10-18

Archived conversations become the fourth permanent section.

### Added

- A fourth **Archived** section (filter-independent) listing every archived conversation: grayed
  rows, not openable until restored, **Unarchive** instead of pin/archive, its own count, collapse
  chevron, and persisted order (Manual order / Last updated).
- Empty hint inside the Archived section when nothing is archived.

### Removed

- The standalone "Archived view" control and the archived visibility filter (Hide archived / All
  conversations / Archived only). Archived conversations no longer appear inline under Pinned,
  Projects, or Recent; they are always collected in the Archived section.

### Changed

- `readSectionViews()` also persists `archivedSort`; `hidden` category removed
  (`viewOptions.*`, `archiveView.*`, `empty.archived` locale keys dropped).
- Derivation now returns an ordered archived pool instead of applying an archived filter; the
  Archived section owns its own sort choice.

### Verified

- `node scripts/check.mjs`: 41 checks green (Archived section exclusivity, empty hint, archived
  row actions, sort-only menu, persisted archived sort).
- Live UI Automation: four section headings render (Pinned / Projects / Recent / Archived);
  archived conversations appear only in the Archived section; the archived heading exposes a sort
  menu only.

## [1.3.1] - 2026-10-18

Archived-view placement and tooltip cleanup.

### Changed

- The archived-conversation view is now a **standalone row below the sections** ("Archived view",
  showing the active mode). It is no longer part of any section menu: Pinned keeps only the sort
  order, Projects keeps grouping/sort/collapse-all, Recent keeps grouping/sort.

### Fixed

- Removed every native HTML `title` attribute from conversation rows, row action buttons, project
  rows, rail buttons, the search clear button, and the notice close button. Hovering no longer
  shows the operating system/browser tooltip; buttons rely on the Host's layered `Tooltip`, and
  conversation rows use the plugin's own hover preview card.

### Verified

- `node scripts/check.mjs`: 42 checks green (adds the standalone archived control and a
  no-native-`title` regression check).
- Live UI Automation: the standalone "归档视图" row exposes Hide archived / All conversations /
  Archived only, and section menus no longer contain those items.

## [1.3.0] - 2026-10-18

Per-section menus and a row hover preview.

### Added

- Pinned's `⋯` menu now offers the sort order only: **Manual order** (Host pin order) or
  **Last updated**.
- Projects' `⋯` menu offers **Group chats by** (By project / In one list), **Sort chats by**
  (Manual order / Last updated), the archived filter, and *Collapse all projects* /
  *Expand all projects*.
- Recent's `⋯` menu offers the same grouping and sort choices plus the archived filter.
- Every grouping/sort choice is remembered browser-locally (never written to the Host).
- Hovering a conversation row for ~400 ms opens a floating card with the conversation title, the
  owning project (folder icon), and the row time.

### Changed

- Manual order follows the Host's saved Workspace order and per-Workspace session order; updated
  order keeps the derived recency order.
- Projects in one-list mode render a flat row list; Recent in by-project mode renders per-project
  subgroup headings.

### Verified

- Live UI Automation: Projects menu exposes 分组方式 (按项目 / 单一列表), 排序方式 (手动排序 /
  最近更新), 归档会话, 收起/展开全部项目; Recent menu exposes the same grouping/sort/archive
  groups; Pinned exposes sort order only.
- `node scripts/check.mjs`: 40 checks green (adds pinned sort persistence, Projects one-list
  flattening, Recent by-project subgroups, and row project metadata for the hover preview).

## [1.2.1] - 2026-10-18

Section-heading refinements.

### Fixed

- The section disclosure chevron moved to the right of the title and now uses the Host's
  `IconChevronDownOutlineRegular`, rotating down when expanded and right when collapsed.
- Pinned no longer exposes an overflow menu: the archived filter only lives on Projects and
  Recent.
- The `⋯` button is always the rightmost section action (Projects: `＋` then `⋯`; Recent:
  `✎` then `⋯`), so every ellipsis lines up at the same x.
- New Session from Recent's `✎`, its overflow menu, and rail mode now targets the Host's
  first-use default workspace instead of inheriting the current/most recent workspace.

### Verified

- Live UI Automation: Pinned exposes only its collapse header, Projects/Recent ellipses share
  the same right edge, and the chevron renders to the right of each title.

## [1.2.0] - 2026-10-18

Sidebar shell redesign.

### Added

- Search now owns a full-width row above the sections; the standalone "Workspaces" label is gone.
- Section headings are larger and bold, with a collapse chevron: clicking (or `Enter` / `Space`
  on) a heading collapses/expands its section, remembered browser-locally. An active filter
  auto-expands the sections so results stay visible.
- Always-visible right-side section buttons, matching the shipped browser's pattern: a `⋯` menu on
  every section (archived filter; plus *Collapse all projects* / *Expand all projects* on
  Projects), `＋` on Projects (add workspace), and `✎` on Recent (new session in the current or
  most recent workspace).
- Rail mode exposes a third button for New session.

### Changed

- The archived filter moved from a toolbar view-options menu into each section's `⋯` menu.
- The sidebar no longer renders a separate header row: search, then section headers, then rows.

## [1.1.0] - 2026-10-18

Feature restoration: the sectioned browser now keeps the shipped sidebar's management surface
instead of dropping it.

### Added

- Reuse of the Host's shared `ui-primitives` module-table row for every glyph and control:
  icons, `StateDot`, `Menu`, `MenuItemButton`, `Tooltip`, `Button`, `Modal`, `writeClipboard`,
  and `relativeTime`. The plugin no longer hand-copies SVG artwork.
- View-options menu with the archived-conversation filter (Hide archived / All conversations /
  Archived only), plus archived-row rendering, the not-openable guard, and Unarchive.
- Conversation row management strip: archive/unarchive, pin/unpin, and the full **⋯** menu
  (pin/unpin, rename session, fork session, archive/unarchive, copy Session ID).
- Session rename dialog through `sessions.using`, and the Host stop-and-archive confirmation
  (with the activity list) when archiving a conversation that still has running work.

### Changed

- Row action hover/focus is a tertiary-to-primary brightness step, matching the Host's row icon
  buttons, instead of a background fill.
- Conversation rows keep the shipped UI in every section (status, title, time, and the
  archive/row-menu actions); rows no longer carry a plugin-added project badge.
- The shipped pin button now means a **section-level pin**: pinning moves the conversation into
  the Pinned section and removes it from its Projects group and Recent; unpinning returns it.
- Package renamed to the unscoped `dsh-sidebar-sections` and moved to its own
  `dsh-sidebar-sections/` folder in the plugin workspace.

### Fixed

- Folder, pin, and project-add glyphs now render the complete Host artwork (the first port had
  dropped sub-paths, producing deformed icons).
- Project and session row menus dispatch to their own callbacks (a shared prop name previously
  routed a session menu action to workspace deletion).
- Row titles flex over the free width again, so the trailing time and hover actions stay
  right-aligned to the row edge.

## [1.0.0] - 2026-10-18

Initial release for DeepSeek Harness `0.2.1-rc.2`.

### Added

- A replacement conversation browser for the `sidebar.workspaces` slot, split into
  **Pinned**, **Projects**, and **Recent** sections.
- Pin / unpin on every conversation row, backed by the Host-durable Workspace pin set
  (`uiWorkspace.pinSession` / `unpinSession`); pinned rows also carry a resting pin marker.
- Collapsible Project groups with browser-local persistence, per-project new-session action, and
  workspace rename / delete through the shell overlay seat.
- Add-workspace action (Host directory picker) and a local conversation filter (`Esc` clears it).
- Host-matching status cells (running / waiting / completed), selected-row state, loading
  skeletons, empty states, and inline failure notices.
- Simplified Chinese and English dictionaries; localized plugin-manager metadata and an original
  icon.
- Zero-dependency verification suite (`node scripts/check.mjs`).

### Verified

- Installed live into a running DSH Desktop `0.2.1-rc.2` profile without restart or page reload;
  pin and unpin were exercised end-to-end through the live UI accessibility tree, and the state
  was restored afterwards.
