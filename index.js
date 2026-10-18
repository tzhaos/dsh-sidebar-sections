/**
 * Host half of the sidebar-sections bundle.
 *
 * The plugin is pure UI: the browser half replaces the shipped workspace
 * browser through the `sidebar.workspaces` slot, so the Host process has
 * nothing to install. This entry still exists because the Client module
 * registry discovers a browser bundle from an active Loader entry whose
 * package declares `dsh.client`; without `apply` the row would not activate.
 */
export function apply() {}
