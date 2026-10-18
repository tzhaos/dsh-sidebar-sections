# dsh-sidebar-sections

English | [简体中文](README.zh.md)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI plugin that
reorganizes the sidebar conversation list into **Pinned / Projects / Recent / Archived** sections,
and adds **pin / unpin** to every conversation row.

![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.1--rc.2-4D6BFE)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)

- **Zero build, zero runtime dependencies** — the browser half is plain JavaScript; it only
  `require`s modules from Harness's frozen platform table (`react`,
  `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-store`), so installation
  cannot fail on an unresolved package.
- **Pinning is Host-durable** — the pin set belongs to the shipped Workspace controller, not to
  this plugin. Pin a conversation here, and the state survives reloads, restarts, and any other
  surface that reads the same set.
- **Native look, feel, and behavior** — every glyph and control is reused from the Host's shared
  `ui-primitives` module-table row (icons, `StateDot`, `Menu`, `MenuItemButton`, `Tooltip`,
  `Button`, `Modal`, `writeClipboard`, `relativeTime`); the plugin hand-draws no artwork. Colors
  are `--dsw-alias-*` theme tokens (light and dark), and rows, menus, dialogs, and status cells
  follow the shipped sidebar's measurements and behavior.
- **The shipped management surface is kept** — per-conversation archive/unarchive and pin/unpin,
  the full row menu (pin, rename, fork, archive/unarchive, copy Session ID), the Archived section,
  and workspace new-session/rename/delete all remain available.
- **Load-failure safe** — the plugin shadows the shipped browser through slot priority. If it
  ever fails to load or crashes, the shipped browser takes the slot back; the sidebar never goes
  blank.

```
🔍 Filter conversations…
Pinned  ⌄
  ● Release checklist           dsh-plugins   3 min   📌
  ● Design review notes         lore-gpui     2 h     📌
Projects  3  ⌄                            ＋  ⋯
  ▾ 📂 dsh-plugins
      ○ Reorganize the sidebar                  1 min
  ▸ 📂 lore-gpui
  ▸ 📂 Ungrouped
Recent  4  ⌄                              ✎  ⋯
  ● Reorganize the sidebar      dsh-plugins   1 min
  ● Build notes                 lore-gpui     just now
  … Show more
Archived  1  ⌄                              ⋯
  ○ Old scratch notes           dsh-plugins   5 min
```

The search control owns the top row. Each section heading is a larger, bold row; its collapse
chevron sits to the right of the title. Projects and Recent put their direct action first
(`＋` / `✎`) and the `⋯` overflow menu last, so every ellipsis shares the same rightmost
position. Pinned and Archived expose only their sort menu; Projects and Recent add grouping and
their direct action.

## 1. Features

| Area | Behavior |
|---|---|
| Pinned | Host pin set, most recently pinned first. Hovering or keyboard-focusing a row reveals **Unpin**, and a resting 📌 marks pinned rows. Rows keep the shipped conversation UI (status, title, time, actions). The section collapses from its right-side chevron; its `⋯` menu offers only the sort order (**Manual order** / **Last updated**). |
| Projects | One group per registered Workspace, in Host order, with unpinned and unarchived conversations nested inside. Groups collapse (browser-local, remembered) and default to expanded. Hovering a project reveals **New session** and a **⋯** menu with **Rename workspace** / **Delete workspace**. The folder icon on a project row stays a folder (open/closed); clicking the row itself toggles it. The section header carries `＋` (add workspace) and, rightmost, `⋯`: **Group chats by** (By project / In one list) and **Sort chats by** (Manual order / Last updated). Each project row's `⋯` (or right-click) menu additionally carries its own **Sort chats by** choice — **Use section order** (default), Manual order, or Last updated — so one project can override the section and reset back later. |
| Recent | Unpinned conversations across all projects, newest activity first. Eight rows initially, with **Show more** in steps of twenty. Rows show title and recency only. The section header carries `✎` (new session in the Host default workspace) and, rightmost, `⋯`: the same **Group chats by** / **Sort chats by** choices (By project / In one list, Manual order / Last updated). |
| Context menus | Right-click a conversation row, a project row, or any section heading to open the same menu that its `⋯` button opens (row actions / project sort + workspace actions / section grouping and sort), positioned at the pointer. The same menus open from the keyboard with the Context Menu key or `Shift+F10`. While such a menu is open the triggering row drops its entire hover surface (background, time swap and action reveal). |
| Project hover | Hovering a project row for a moment shows a preview card: folder icon + project name, the visible conversation count, and the canonical directory path. |
| Every conversation | Hovering or keyboard-focusing a row reveals **archive/unarchive**, **pin/unpin**, and the **⋯** row menu: pin/unpin, rename session, fork session, archive/unarchive, copy Session ID. Hovering the row for a moment opens a preview card with the conversation title, its owning project, and the time. |
| Search row | A full-width filter control on its own row above the sections (conversation title or project name; `Esc` clears and collapses it). |
| Section headers | Larger, bold section titles; the disclosure chevron sits to the right of the title and rotates down/right as the section expands/collapses. Clicking (or `Enter`/`Space` on) the header toggles it, the state is remembered browser-locally, and any active filter expands the sections so results stay visible. The `⋯` button is always the rightmost action so the ellipses line up across sections. |
| Archived | A permanent fourth section for archived conversations across all projects (manual Host order by default). Rows render grayed, cannot be opened until restored, and expose **Unarchive** instead of pin/archive; its `⋯` menu offers only the sort order (**Manual order** / **Last updated**) and an archive empty hint appears when nothing is archived. Archived conversations never appear under Pinned, Projects, or Recent. Archiving running work asks for the shipped stop-and-archive confirmation and lists what will be stopped. |
| Rail mode | With the sidebar collapsed, the region becomes three 36 px icon buttons (filter, add workspace, new session); activating filter expands the sidebar and focuses the field. |
| Status | Live status cell per conversation: running spinner, waiting-for-approval / plan-review / answer warning dot with compact trailing label, completed dot, selected-row highlight. |
| States | First-paint skeleton rows, per-section empty hints, empty-installation call to action, inline transient notices for failed operations. |
| Accessibility | Sections are `section` + `h2`; project and conversation rows are `treeitem`s with `aria-expanded` / `aria-selected`; icon buttons carry `aria-label` and native tooltips; status cells expose hidden text; rows are keyboard operable (`Enter` / `Space` open, `Tab` reaches the row actions); focus rings use the Host focus tokens. |

Non-goals are listed in [§8](#8-known-limitations).

## 2. Install

This is a local bundle package, not published to a registry. The supported install route is the
Harness Plugin Manager, which writes the profile manifest, installs the package, selects the
bundle, and recomposes the configuration:

```text
plugin_manager(action="install_bundle", target="<absolute path to this directory>")
```

The tool is available in a session whose preset enables it (Creator mode); in the Web UI the same
operation is available from the **Plugins** page. Installing a bundle into a running profile can
activate it through HMR, in which case no restart is needed; otherwise restart DeepSeek Harness.

### Local development install (manual)

When `plugin_manager` is unavailable, a profile can be wired by hand. This is the same mechanism
the Plugin Manager performs, without its writer lock and pnpm step, so treat it as a development
path:

1. Make the package resolvable from the profile directory — a directory junction (Windows) or
   symlink is enough:

   ```powershell
   $profile = "$env:USERPROFILE\.dsh\profiles\desktop"
   New-Item -ItemType Directory -Force -Path "$profile\node_modules" | Out-Null
   New-Item -ItemType Junction -Path "$profile\node_modules\dsh-sidebar-sections" `
            -Target "<absolute path to this directory>"
   ```

2. In one atomic write, add a `link:` dependency **and** append the bundle name to
   `dsh.profile.bundles` in the profile's `package.json`:

   ```json
   {
     "dependencies": {
       "dsh-sidebar-sections": "link:<absolute path to this directory>"
     },
     "dsh": {
       "profile": {
         "bundles": ["…existing bundles…", "dsh-sidebar-sections"]
       }
     }
   }
   ```

   Only the ordered bundle list triggers a live recomposition; a dependency-only edit is ignored
   by the profile watcher.

3. The running app applies the change in about two seconds. Editing `client.js` afterwards is
   picked up by client HMR (about half a second, remounts the browser); changes to `index.js`
   apply on the next recomposition or restart.

### Uninstall

Remove `dsh-sidebar-sections` from `dsh.profile.bundles` (the shipped browser returns
immediately), then remove the dependency entry and the junction. With `plugin_manager`, removal
is the `remove_bundle` operation.

## 3. Usage

- **Pin a conversation**: hover — or tab to — any conversation row and press the shipped pin
  button. Its meaning is now section-level: the conversation joins **Pinned**, leaves its project
  group and the **Recent** list, and survives restarts; the row itself keeps the shipped
  conversation UI (status, title, time, archive/menu actions). Unpin returns it to its group and
  Recent.
- **Archive a conversation**: use the row's archive button or menu. The conversation moves to the
  **Archived** section (grayed, not openable until restored); restore it there with **Unarchive**.
  If the conversation still has running work, the Host asks to stop and archive it and names what
  will stop.
- **Manage a conversation**: the **⋯** menu offers pin/unpin, rename, fork, archive/unarchive, and
  copy Session ID, with the same Host commands and failure messages as the shipped sidebar.
- **Find things**: use the full-width search row, type part of a title or project name. Matching
  project groups expand; `Esc` clears.
- **Collapse sections**: click a section heading (or focus it and press `Enter` / `Space`); the
  choice is remembered. Buttons use the Host's layered tooltip only — the sidebar never shows native
  HTML/OS tooltips.
- **Sort and group**: each section's `⋯` menu carries its own choices. Pinned and Archived sort by
  **Manual order** (Host saved/pin order) or **Last updated**. Projects and Recent additionally
  group **By project** or **In one list**; all choices are remembered browser-locally.
- **Manual ordering by drag**: in any section set to **Manual order** (or any single project whose
  row menu is set to Manual order), rows become draggable — drag a row onto another row's
  upper/lower half to insert it before/after; a line marks the drop position and the list
  auto-scrolls when the pointer nears its top/bottom edge. The resulting order is stored
  browser-locally (`dsh.sidebarSections.manualOrder`), and real Workspace groups also persist it
  to the Host through `workspaces.insertSessionBefore`; a rejected Host write shows an inline
  notice. Project sort overrides are stored in `dsh.sidebarSections.projectSorts`. Blank draft
  rows, cross-group moves and drag-while-filtering are disabled.
- **Right-click menus**: right-click any row, project row, or section heading to open the same
  actions menu as its `⋯` button.
- **Section shortcuts**: `＋` next to Projects adds a workspace through the Host directory picker;
  `✎` next to Recent starts a session in the Host's default workspace (its localized name).
- **Peek at a row**: hover a conversation row to see its title, owning project, and time in a
  floating card; hover a project row to see its name, visible conversation count, and path.
- **Organize projects**: hover a project row for *New session* and *⋯*; the menu renames or deletes
  the Workspace registration. Deleting a Workspace never deletes conversations — they move to the
  **Ungrouped** group.
- **Add a project**: use the `＋` button next to Projects; the Host opens its directory picker, adopts the
  folder, and starts a session there.
- **Collapse**: click a project row. The choice is remembered in the browser (`localStorage`); it
  is view state only, never written to the Host.

## 4. How it works

`sidebar.workspaces` is a root-scoped `single` slot declared by `ui-sidebar`. The shipped
`@deepseek-ai/dsh-client-ui-workspace` registers its browser there at the default priority `0`.
This plugin registers a replacement at priority `-1`; slots render the lowest live priority, so
the replacement wins regardless of plugin load order. The losing entry stays on the ledger (and
keeps owning its child-slot declarations), which is why this plugin **declares no children** and
renders its own rows, menus, and dialogs.

```
sidebar.workspaces (single, root)
├── @deepseek-ai/dsh-client-ui-workspace   priority  0   shipped browser
└── dsh-sidebar-sections            priority -1   this plugin (renders)
```

- **Reads** — `useSessions` (list catalog and retentions), `useWorkspaces` (workspace rows, pin and
  archive sets), `useSessionStatus` (running / pending interaction / unread completion), and
  `usePanelInfo` (suppresses the selected look while a global panel is active). Components never
  subscribe to stores themselves.
- **Writes** — `ctx.get('uiWorkspace')` for navigation, pinning, archiving, forking, and directory
  picking (`openSession`, `startSession`, `pinSession`, `unpinSession`, `archiveSession`,
  `unarchiveSession`, `forkSession`, `pickDirectory`), `ctx.get('workspaces')` for Workspace
  management (`create`, `rename`, `delete`), and `ctx.get('sessions').using()` for session rename.
  Failures surface as inline notices, never as silent drops.
- **Reuse** — glyphs and controls come from the shared `ui-primitives` module: `Menu`,
  `MenuItemButton`, and `Tooltip` build the row, project, and section menus; `StateDot`
  renders status cells; `Modal` + `Button` render every dialog; `writeClipboard` copies a Session
  ID; `relativeTime` supplies the row-time buckets. The plugin's own stylesheet only adds layout
  and plugin-specific chrome.
- **Dialogs** — workspace rename/delete, session rename, and stop-and-archive are registered into
  the root `shell.overlay` list, so they render above the whole frame instead of being clipped by
  the sidebar. The sidebar and the overlay communicate through one bare observable passed through
  a registration `inject` face.
- **Derivation** — a pure function folds the snapshots into render nodes: hidden subagent
  sessions, non-selected blank sessions, archived sessions; pinned rows from the pin array order;
  project members by recency with the selected blank first; ungrouped sessions in a trailing
  group; Recent sorted by `updatedAt` and deduplicated against Pinned.
- **Styling** — one `<style>` element owns every class (`dshss-` prefix); colors and measurements
  are Host tokens and Host metrics, and SVG glyphs reuse the complete `ui-primitives` artwork.
- **Module format** — the browser half is a classic script that calls
  `window.__ModuleLoader__.load({ id: '<package name>', factory })` and returns a Cordis plugin
  (`{ inject, apply }`). The Host half is a no-op `apply` that gives the package a Loader entry,
  which is how the client module registry discovers the browser bundle.

## 5. Compatibility

| Component | Version |
|---|---|
| DeepSeek Harness | `0.2.1-rc.2` (source tag `dsh-v0.2.1-rc.2`) |
| Client slot API | pre-stable; validated against the shipped `ui-slots` / `ui-workspace` / `ui-sidebar` contracts |
| Runtime | Node bundled with DSH Desktop / Web; no external Node dependencies |
| Platform | Web and Desktop Web surface (Windows verified; no platform-specific code) |

Harness client APIs are explicitly pre-stable. After a DSH upgrade, re-run `node scripts/check.mjs`
and re-check the live UI; a changed slot contract may require updating this plugin.

## 6. Verification

`scripts/check.mjs` is a zero-dependency suite (56 checks) that runs with plain Node:

```sh
node scripts/check.mjs
```

It validates:

- package manifest, exports, `files`, bundle patch, locale display metadata, icon bounds,
  platform-only `require`s, and the reuse rule that rejects hand-copied SVG path data;
- that `apply` registers exactly one `sidebar.workspaces` replacement at a winning priority plus
  one `shell.overlay` dialog, with a complete bilingual dictionary;
- section derivation from fixture snapshots: pin ordering, project nesting, Recent ordering
  (shipped row UI, no row badges), hidden subagent/non-current-blank rows, selected blank
  placement, and the archived pool that feeds the fourth section;
- the Archived section: archived rows render there only (never under Pinned/Projects/Recent),
  grayed and with **Unarchive** instead of pin, and an empty hint appears when nothing is archived;
- the redesigned shell: the search control owns its own row, the standalone "Workspaces" label is
  gone, the disclosure chevron sits right of the title, section headings collapse/expand
  (remembered browser-locally), Projects / Recent place `⋯` rightmost after their direct action,
  the Projects `＋` adds a workspace, and Recent's `✎` starts a session in the Host default
  workspace;
- per-section menus: Pinned and Archived offer only sort order (Manual order / Last updated);
  Projects and Recent offer **Group chats by** (By project / In one list) plus sort order, with no
  collapse-all/expand-all rows; every grouping/sort choice is persisted browser-locally;
- manual ordering: manual-sort rows are draggable, a drop reorders and persists the manual order in
  browser storage, updated-sort rows are static, and project rows keep their folder icon instead of
  a hover chevron;
- per-project sorting: a project's own sort override reorders just that group and persists in
  browser storage, with the Host `insertSessionBefore` write dispatched for real Workspace groups;
- right-click context menus: conversation rows, project rows, and section headings each open their
  matching menus and dispatch the same actions (archived rows offer Unarchive without Pin); while a
  context menu is open the root carries `dshss-menuActive`, which cancels the hover surface;
- hover previews: the conversation card renders its title/project/time and clears on leave; the
  project card renders name/visible-count/path from the row's data attributes;
- drag manual ordering also covers an upper-half (insert-before) drop, refuses blank draft rows,
  is disabled while a filter narrows the list, and surfaces a localized notice when the Host
  reorder write rejects;
- per-project sort can be reset to **Use section order**;
- the Context Menu key / Shift+F10 opens row, project and section context menus;
- static guard: menu-open styles never paint a hover background;
- rendered rows/buttons carry no native `title` tooltips;
- rows expose their owning project for the hover preview card;
- interaction dispatch: pin/unpin, archive (including the stop-and-archive refusal path),
  unarchive, the full session row menu (rename request, fork, archive, copy Session ID), open,
  new session, add workspace (picker → adopt → session), project rename/delete requests, local
  filter + `Esc`, collapse persistence, and rail mode;
- dialog submission for workspace rename, session rename (through `sessions.using`), delete
  wording and retention boundary, and stop-and-archive with its activity list.

The suite drives the real component functions through a miniature React/hooks runtime with
state, effects, and synthetic events; the Host `ui-primitives` module is replaced by a
host-shaped fake (menus, modal, buttons, clipboard, relative time, icon placeholders).

Verified live on a running DSH Desktop `0.2.1-rc.2` profile: the plugin graph entry appeared, the
four sections rendered (including Archived), keyboard focus revealed the archive and pin actions,
the row menu exposed the full shipped action list, the Archived section menu offers sort order
only, a conversation was pinned and unpinned through the live accessibility tree with the sections
updating correctly, and the pre-test state was restored. Editing `client.js` hot-updated the page
without a reload.

## 7. Development

```
dsh-sidebar-sections/
├── package.json              # bundle patch + dsh.client manifest, exports, files
├── cordis.patch.yml          # inserts the `sidebar-sections` Loader row
├── index.js                  # Host half: no-op apply (discovers the client bundle)
├── client.js                 # browser half: plain JS, no build step
├── icon.svg                  # plugin-manager icon (original)
├── locale/                   # plugin-manager title/description (en, zh)
├── scripts/check.mjs         # zero-dependency verification suite
├── README.md / README.zh.md  # this document and its Chinese counterpart
├── CHANGELOG.md
└── LICENSE
```

Inner loop:

1. Keep the package linked into a development profile (see [§2](#2-install)).
2. Run `node scripts/check.mjs` after every change.
3. Edit `client.js`; the running page remounts the browser within about half a second (client HMR
   polls the artifact), so visual checks need no restart or reload.
4. Edit `index.js` or `package.json` only when changing the Host-side row; those apply on the next
   recomposition or restart.

Contribution rules:

- Keep the browser half dependency-free: only the platform module table may be `require`d.
- Do not declare any `sidebar.workspaces.*` child slot — the shadowed shipped entry still owns
  them; render plugin-owned UI instead.
- Use theme tokens, not literal colors; use Host measurements for rows and controls.
- Route every user-visible string through the plugin's own locale namespace (both languages).
- Keep `README.md` and `README.zh.md` in sync, and record user-visible changes in `CHANGELOG.md`.

## 8. Known limitations

- **Archived is permanent.** The fourth section is always present (with an empty hint) instead of
a toggleable archived view; showing archived rows inline with Projects/Recent is intentionally not
supported anymore.

- **Section-scoped grouping/order only.** The shipped global *Group by* (Workspace Tree / Single
  list) and *Order by* modes are replaced by per-section menus: **By project / In one list** and
  **Manual order / Last updated**. Workspace-tree nesting under ancestor folders is not reproduced.
- **Manual order scope.** Drag reordering works inside one list/group at a time (no cross-project
  moves). Outside real Workspace groups the order lives in browser storage rather than Host data.
- **Local filter only.** Search matches loaded conversation titles and project names; the Host's
  message-content search is not used, and the shipped `Ctrl+K` search command no longer drives this
  browser.
- **Add workspace needs a native directory picker.** Local Desktop/Web compositions provide one;
  a browse-only picker composition shows an unavailable notice instead of a picking flow.
- **Not reproduced:** subagent-running counts, hover cards, schedule markers, workspace-tree
  nesting under ancestor folders, and the search-result list with message snippets.

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Sidebar looks unchanged after install | Bundle not selected, or the profile was not recomposed. Check `dsh.profile.bundles` contains `dsh-sidebar-sections`, then restart DSH. |
| The shipped Workspace browser is back | The plugin is not active (uninstalled, failed to load, or crashed). Slot fallback restores the shipped browser by design. Check Settings → Plugins and the browser console. |
| No Pinned/Projects/Recent headings, sidebar empty | The plugin is waiting on services (`inject: slots, locale, uiWorkspace, workspaces, sessions`); ensure the shipped sidebar/workspace/layout bundles are enabled. |
| Add workspace shows "unavailable" | The composed directory-picker backend does not serve the native OS chooser. |
| Pin does nothing | The pin action rejects for unknown/archived sessions; the inline notice carries the Host's code and message. |
| Recent is empty | Every visible conversation is either pinned or archived. |

## 10. Roadmap

- Optional fuzzy title search in the local filter.
- Optional Host content search in the filter.
- Grouping/order view modes that keep the section structure (e.g. workspace-tree nesting).
- Hover cards and schedule/subagent markers for rows.
- Configuration row (recent limit, section visibility) through the plugin's `Config` schema.

## 11. License

[MIT](LICENSE)

Icons and controls are resolved at runtime from the DeepSeek Harness repository's
`ui-primitives` package (also MIT); this plugin does not copy its source. Theme tokens and row
measurements follow the shipped `ui-sidebar` / `ui-workspace` / `ui-theme` packages.
