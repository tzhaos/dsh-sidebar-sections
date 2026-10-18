# Contributing

Thanks for taking the time to improve `dsh-sidebar-sections`.

## Repository scope

This repository is the plugin itself. Its parent folder is only a collection
workspace that can contain several independent plugin repositories; it is not
where this plugin's CI, editor settings, or contribution rules live.

- The plugin is a self-contained DSH bundle: `package.json`, `cordis.patch.yml`,
  `index.js`, `client.js`, `icon.svg`, `locale/`, `README.md`, `README.en.md`,
  `CHANGELOG.md`, `LICENSE`, `scripts/check.mjs`, and `docs/`.
- Repository configuration also lives here: `.github/workflows/check.yml`,
  `.editorconfig`, `.gitattributes`, `.gitignore`, and this file.
- Scratch or research folders outside the plugin directory are not part of this
  repository and must never be shipped.

## Ground rules

- **No build step and no runtime dependencies.** The client half is a classic
  script loaded through `window.__ModuleLoader__.load` and may only `require`
  modules from DSH's frozen platform table.
- **Do not declare `sidebar.workspaces.*` child slots.** The shipped browser's
  registration stays on the ledger and keeps owning them; render your own rows,
  menus, and dialogs instead.
- **Reuse `ui-primitives`.** Icons and controls must come from the Host's shared
  module-table row; do not hand-copy SVG path data or rebuild shipped controls.
- **Theme tokens only.** Use `--dsw-alias-*` variables; never hard-code colors.
- **All user-visible copy goes through the plugin's own locale namespace** and
  must exist in both `zh` and `en` with identical key sets.
- **Browser-local state is view state only.** Never persist Host data in
  `localStorage`; write ordering changes back through the Host API instead.

## Verification

Run the zero-dependency suite from the repository root before sending a change:

```sh
node scripts/check.mjs
```

CI (`.github/workflows/check.yml`) runs the same command on every push and pull
request.

## Documentation

- Keep `README.md` (Simplified Chinese, primary) and `README.en.md` (English) in sync.
- Record every user-visible change in `CHANGELOG.md` under the next version,
  following [Keep a Changelog](https://keepachangelog.com/).

## Commits

Use Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), e.g.:

```
feat: keyboard context menus and project sort reset (v1.8.0)
```
