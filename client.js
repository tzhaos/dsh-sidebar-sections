/**
 * Sidebar Sections — browser half of the `dsh-sidebar-sections` bundle.
 *
 * The plugin replaces the shipped Workspace browser with a three-section
 * conversation browser:
 *
 *   Pinned   — Sessions in the registry-global pin set, newest pin first.
 *   Projects — Workspaces (Host-durable order) with their conversations nested
 *              as expandable groups.
 *   Recent   — The most recently active unpinned conversations.
 *
 * It deliberately keeps the shipped browser's management surface: every
 * conversation row offers archive/unarchive, pin/unpin, and the full row menu
 * (pin, rename, fork, archive/unarchive, copy Session ID); the toolbar keeps a
 * view-options menu whose archived filter restores archived conversations; and
 * project rows keep new-session plus rename/delete workspace.
 *
 * All icons and controls come from the Host's shared `ui-primitives` module
 * table row (icons, StateDot, Menu, MenuItemButton, Tooltip, Button, Modal,
 * writeClipboard, relativeTime), so the plugin renders the shipped artwork and
 * behavior instead of re-drawing them.
 *
 * Composition notes (verified against DSH 0.2.1-rc.2 source):
 *   - `sidebar.workspaces` is a root-scoped `single` slot declared by
 *     ui-sidebar; ui-workspace registers its browser there at priority 0, so
 *     this plugin registers at priority -1 and wins the cell. The shipped
 *     browser's registration stays live (and owns its own child declarations),
 *     therefore this plugin declares no children.
 *   - Standard hooks (`useSessions`, `useWorkspaces`, `useSessionStatus`,
 *     `usePanelInfo`) are bound by the renderer at this root slot; the
 *     component never subscribes to stores itself.
 *   - Observable side state (dialog requests) travels to the `shell.overlay`
 *     registration through an injected bare source, never a module singleton.
 *
 * @module dsh-sidebar-sections/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-sidebar-sections',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { createSnapshotStore } = require('@deepseek-ai/dsh-client-store')
    const {
      StateDot,
      Button,
      Modal,
      Menu,
      MenuItemButton,
      Tooltip,
      writeClipboard,
      relativeTime,
      IconArchiveOutlineRegular,
      IconBranchOutlineRegular,
      IconChevronDownOutlineRegular,
      IconCloseFillRegular,
      IconCopyOutlineRegular,
      IconEditOutlineRegular,
      IconEllipsisOutlineRegular,
      IconFolderCloseRegular,
      IconFolderOpenRegular,
      IconNewChatOutlineRegular,
      IconPinFillRegular,
      IconPinOutlineRegular,
      IconProjectAddOutlineRegular,
      IconQueueOutlineRegular,
      IconSearchOutlineRegular,
      IconTrashOutlineRegular,
      IconTriangleRightFillRegular,
      IconUnarchiveOutlineRegular,
    } = primitives
    const { useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'sidebarSections'
    /**
     * Shadowing rank for the `sidebar.workspaces` cell. ui-workspace registers
     * at the default priority 0; the lowest live priority renders, so a
     * negative rank replaces the shipped browser without racing registration
     * order.
     */
    const SLOT_PRIORITY = -1
    /** Recent rows shown before the user asks for more. */
    const RECENT_INITIAL = 8
    /** Extra Recent rows revealed per "show more" activation. */
    const RECENT_STEP = 20
    /** Browser-local view state keys (never Host data). */
    const COLLAPSED_KEY = 'dsh.sidebarSections.collapsed'
    const SECTION_COLLAPSED_KEY = 'dsh.sidebarSections.collapsedSections'
    const SECTION_VIEW_KEY = 'dsh.sidebarSections.sectionViews'
    const MANUAL_ORDER_KEY = 'dsh.sidebarSections.manualOrder'
    /** Notice lifetime before it dismisses itself. */
    const NOTICE_TIMEOUT_MS = 6000
    /** Relative-time refresh cadence. */
    const CLOCK_INTERVAL_MS = 60_000

    // ---------------------------------------------------------------------
    // Locale dictionaries
    // ---------------------------------------------------------------------

    /** Simplified Chinese copy (the key-set source of truth). */
    const zh = {
      'toolbar.add': '添加工作区',
      'section.pinned': '置顶',
      'section.projects': '项目',
      'section.recent': '最近',
      'section.archived': '归档',
      'section.pinned.empty': '置顶的会话会显示在这里',
      'section.projects.empty': '还没有工作区',
      'section.recent.empty': '暂无最近会话',
      'section.count': '{n}',
      'section.collapse': '收起{name}',
      'section.expand': '展开{name}',
      'section.menu': '{name}的分区操作',
      'sort.label': '排序方式',
      'sort.manual': '手动排序',
      'sort.updated': '最近更新',
      'group.label': '分组方式',
      'group.byProject': '按项目',
      'group.oneList': '单一列表',
      'hover.project': '工作区',
      'newSession': '新建会话',
      'section.archived.empty': '还没有已归档会话',
      'project.newSession': '新会话',
      'project.newSession.aria': '在“{name}”中新建会话',
      'project.more': '工作区操作',
      'project.more.aria': '工作区“{name}”的操作',
      'project.ungrouped': '未分组',
      'project.empty': '暂无会话',
      'rename': '重命名',
      'delete.workspace': '删除工作区',
      'session.new': '新会话',
      'session.untitled': '未命名',
      'session.pin': '置顶会话',
      'session.unpin': '取消置顶',
      'session.pinned': '已置顶',
      'session.open': '打开会话 {title}',
      'menu.pinSession': '置顶会话',
      'menu.unpinSession': '取消置顶',
      'menu.renameSession': '重命名会话',
      'menu.forkSession': '分叉会话',
      'menu.archiveSession': '归档会话',
      'menu.unarchiveSession': '取消归档',
      'menu.sessionId': '复制 Session ID',
      'actions.workspace.aria': '工作区“{name}”的操作',
      'actions.session.aria': '会话“{name}”的操作',
      'actions.archive': '归档会话',
      'actions.unarchive': '取消归档',
      'actions.pin': '置顶会话',
      'actions.unpin': '取消置顶',
      'toast.sessionIdCopied': 'Session ID 已复制',
      'toast.sessionIdCopyFailed': '复制失败，请重试',
      'toast.archivedNotOpenable': '已归档对话暂时无法查看，请取消归档后查看',
      'toast.pinFailed': '置顶失败，请稍后重试',
      'toast.unpinFailed': '取消置顶失败，请稍后重试',
      'toast.archiveFailed': '归档失败：{message}',
      'toast.unarchiveFailed': '取消归档失败：{message}',
      'toast.forkFailed': '分叉会话失败：{message}',
      'toast.forkRequiresOpen': '请先打开原会话完成迁移，再创建分支',
      'toast.createFailed': '新建会话失败：{message}',
      'toast.workspaceAddFailed': '添加工作区失败：{message}',
      'rename.session.title': '重命名会话',
      'field.sessionName': '会话名称',
      'archive.confirm.title': '停止并归档此会话？',
      'archive.confirm.desc': '“{title}”仍有正在进行的工作。归档会先停止这些工作；之后可在“视图选项 → 显示全部会话”中恢复会话，被停止的工作不会自动继续。',
      'archive.confirm.action': '停止并归档',
      'archive.confirm.turn': '进行中的回合',
      'archive.confirm.subagents': '{n} 个运行中的子智能体：{names}',
      'archive.confirm.jobs': '{n} 个后台任务：{names}',
      'archive.confirm.schedules': '{n} 条定时提醒：{names}',
      'archive.confirm.other': '{n} 项其他工作（{kind}）',
      'archive.confirm.listSeparator': '、',
      'dialog.rename.title': '重命名工作区',
      'dialog.rename.label': '工作区名称',
      'dialog.rename.confirm': '保存',
      'dialog.rename.error': '重命名失败：{message}',
      'dialog.delete.title': '删除工作区',
      'dialog.delete.body': '将把“{name}”从工作区列表中移除。文件夹与会话记录会保留，其会话将显示在“未分组”下。',
      'dialog.delete.confirm': '删除',
      'dialog.delete.error': '删除失败：{message}',
      'dialog.renameSession.error': '重命名失败：{message}',
      'dialog.archiveError': '归档失败：{message}',
      'dialog.cancel': '取消',
      'dialog.close': '关闭',
      'filter.label': '筛选会话',
      'filter.placeholder': '筛选会话和工作区',
      'filter.clear': '清除筛选',
      'filter.empty': '没有匹配的会话',
      'rail.search': '筛选会话',
      'rail.add': '添加工作区',
      'notice.dismiss': '关闭提示',
      'time.now': '刚刚',
      'time.minutes': '{n}分钟',
      'time.hours': '{n}小时',
      'time.days': '{n}天',
      'time.months': '{n}个月',
      'time.years': '{n}年',
      'status.running': '进行中',
      'status.waitingApproval': '等待审批',
      'status.planReview': '计划待审',
      'status.waitingAnswer': '等待回答',
      'status.completed': '已完成',
      'status.idle': '空闲',
      'status.approval.short': '待审批',
      'status.planReview.short': '计划待审',
      'status.answer.short': '待回答',
      'recent.more': '显示更多',
      'recent.less': '收起',
      'workspace.defaultName': '默认工作区',
    }

    /** English dictionary; key set must match zh (checked by scripts/check.mjs). */
    const en = {
      'toolbar.add': 'Add workspace',
      'section.pinned': 'Pinned',
      'section.projects': 'Projects',
      'section.recent': 'Recent',
      'section.archived': 'Archived',
      'section.pinned.empty': 'Pinned conversations appear here',
      'section.projects.empty': 'No workspaces yet',
      'section.recent.empty': 'No recent conversations',
      'section.count': '{n}',
      'section.collapse': 'Collapse {name}',
      'section.expand': 'Expand {name}',
      'section.menu': '{name} section actions',
      'sort.label': 'Sort chats by',
      'sort.manual': 'Manual order',
      'sort.updated': 'Last updated',
      'group.label': 'Group chats by',
      'group.byProject': 'By project',
      'group.oneList': 'In one list',
      'hover.project': 'Workspace',
      'newSession': 'New session',
      'section.archived.empty': 'No archived conversations yet',
      'project.newSession': 'New session',
      'project.newSession.aria': 'New session in {name}',
      'project.more': 'Workspace actions',
      'project.more.aria': 'Workspace actions for {name}',
      'project.ungrouped': 'Ungrouped',
      'project.empty': 'No conversations',
      'rename': 'Rename',
      'delete.workspace': 'Delete workspace',
      'session.new': 'New Session',
      'session.untitled': 'Untitled',
      'session.pin': 'Pin conversation',
      'session.unpin': 'Unpin conversation',
      'session.pinned': 'Pinned',
      'session.open': 'Open conversation {title}',
      'menu.pinSession': 'Pin session',
      'menu.unpinSession': 'Unpin session',
      'menu.renameSession': 'Rename session',
      'menu.forkSession': 'Fork session',
      'menu.archiveSession': 'Archive session',
      'menu.unarchiveSession': 'Unarchive session',
      'menu.sessionId': 'Copy Session ID',
      'actions.workspace.aria': 'Workspace actions for {name}',
      'actions.session.aria': 'Session actions for {name}',
      'actions.archive': 'Archive session',
      'actions.unarchive': 'Unarchive session',
      'actions.pin': 'Pin session',
      'actions.unpin': 'Unpin session',
      'toast.sessionIdCopied': 'Session ID copied',
      'toast.sessionIdCopyFailed': 'Copy failed, please retry',
      'toast.archivedNotOpenable': 'Archived conversations cannot be opened until restored',
      'toast.pinFailed': 'Pin failed, please retry',
      'toast.unpinFailed': 'Unpin failed, please retry',
      'toast.archiveFailed': 'Archive failed: {message}',
      'toast.unarchiveFailed': 'Unarchive failed: {message}',
      'toast.forkFailed': 'Fork failed: {message}',
      'toast.forkRequiresOpen': 'Open the source session to finish migration, then fork again',
      'toast.createFailed': 'New session failed: {message}',
      'toast.workspaceAddFailed': 'Adding the workspace failed: {message}',
      'rename.session.title': 'Rename session',
      'field.sessionName': 'Session name',
      'archive.confirm.title': 'Stop and archive this session?',
      'archive.confirm.desc': '"{title}" still has work in progress. Archiving stops that work first; the session can be restored from View options → All conversations, and the stopped work does not resume automatically.',
      'archive.confirm.action': 'Stop and archive',
      'archive.confirm.turn': 'Turn in progress',
      'archive.confirm.subagents': '{n} subagent(s) running: {names}',
      'archive.confirm.jobs': '{n} background job(s): {names}',
      'archive.confirm.schedules': '{n} scheduled reminder(s): {names}',
      'archive.confirm.other': '{n} other task(s) ({kind})',
      'archive.confirm.listSeparator': ', ',
      'dialog.rename.title': 'Rename workspace',
      'dialog.rename.label': 'Workspace name',
      'dialog.rename.confirm': 'Save',
      'dialog.rename.error': 'Rename failed: {message}',
      'dialog.delete.title': 'Delete workspace',
      'dialog.delete.body': 'Removes “{name}” from the workspace list. The folder and conversation history are kept; its conversations appear under “Ungrouped”.',
      'dialog.delete.confirm': 'Delete',
      'dialog.delete.error': 'Delete failed: {message}',
      'dialog.renameSession.error': 'Rename failed: {message}',
      'dialog.archiveError': 'Archive failed: {message}',
      'dialog.cancel': 'Cancel',
      'dialog.close': 'Close',
      'filter.label': 'Filter conversations',
      'filter.placeholder': 'Filter conversations and workspaces',
      'filter.clear': 'Clear filter',
      'filter.empty': 'No matching conversations',
      'rail.search': 'Filter conversations',
      'rail.add': 'Add workspace',
      'notice.dismiss': 'Dismiss notice',
      'time.now': 'now',
      'time.minutes': '{n}min',
      'time.hours': '{n}h',
      'time.days': '{n}d',
      'time.months': '{n}mo',
      'time.years': '{n}y',
      'status.running': 'Running',
      'status.waitingApproval': 'Waiting for approval',
      'status.planReview': 'Plan awaiting review',
      'status.waitingAnswer': 'Waiting for answer',
      'status.completed': 'Completed',
      'status.idle': 'Idle',
      'status.approval.short': 'Approval',
      'status.planReview.short': 'Plan review',
      'status.answer.short': 'Answer',
      'recent.more': 'Show more',
      'recent.less': 'Show less',
      'workspace.defaultName': 'Default workspace',
    }

    // ---------------------------------------------------------------------
    // Pure helpers (no React, no ctx)
    // ---------------------------------------------------------------------

    /**
     * Directory basename with both separator conventions.
     * @param {string | undefined} path - directory path.
     * @returns {string} final segment, or an empty string.
     */
    function basename(path) {
      if (typeof path !== 'string' || path === '') return ''
      const trimmed = path.replace(/[\\/]+$/, '')
      const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
      return index === -1 ? trimmed : trimmed.slice(index + 1)
    }

    /**
     * Localized compact relative time (Host bucketing, plugin-owned words).
     * @param {number} at - epoch ms of the dated moment.
     * @param {number} now - current epoch ms.
     * @param {(key: string, params?: object) => string} t - translate seat.
     * @returns {string} compact label such as "5min".
     */
    function timeLabel(at, now, t) {
      const { unit, n } = relativeTime(at, now)
      return unit === 'now' ? t('time.now') : t(`time.${unit}`, { n })
    }

    /**
     * Human-facing row title for one Session summary.
     * @param {{blank: boolean, title?: string}} summary - Session summary.
     * @param {(key: string, params?: object) => string} t - translate seat.
     * @returns {string} display title, localized for blank/unnamed Sessions.
     */
    function displayTitle(summary, t) {
      if (summary.blank === true) return t('session.new')
      const title = typeof summary.title === 'string' ? summary.title.trim() : ''
      return title === '' ? t('session.untitled') : title
    }

    /**
     * Human-facing Workspace title. The first-use Workspace keeps a
     * language-neutral stored title; every other title reads verbatim.
     * @param {{title: string}} workspace - Workspace row.
     * @param {(key: string, params?: object) => string} t - translate seat.
     * @returns {string} title to display.
     */
    function workspaceLabel(workspace, t) {
      return workspace.title === 'default-workspace' ? t('workspace.defaultName') : workspace.title
    }

    /**
     * The Session currently retained by the main view, if any.
     * @param {{ids: string[], byId: Record<string, object>}} list - Session list snapshot.
     * @returns {string | undefined} current Session id.
     */
    function currentSessionId(list) {
      for (const id of list.ids) {
        const summary = list.byId[id]
        if (summary !== undefined && (summary.retainedBy?.mainView ?? 0) > 0) return id
      }
      return undefined
    }

    /**
     * Session id to owning Workspace row.
     * @param {readonly object[]} workspaces - Workspace rows in Host order.
     * @returns {Map<string, object>} membership map (first Workspace wins).
     */
    function membershipOf(workspaces) {
      const map = new Map()
      for (const workspace of workspaces) {
        for (const sessionId of workspace.sessionIds) {
          if (!map.has(sessionId)) map.set(sessionId, workspace)
        }
      }
      return map
    }

    /**
     * Whether a Session may appear in the browser under one archived filter.
     * @param {object} summary - Session summary.
     * @param {string | undefined} currentId - retained main-view Session.
     * @param {ReadonlySet<string>} archived - archived Session ids.
     * @param {'default'|'show'|'only'} filter - archived-row visibility.
     * @returns {boolean} whether the Session is visible.
     */
    function isVisibleSummary(summary, currentId) {
      if (summary.origin === 'subagent') return false
      if (summary.blank === true && summary.id !== currentId) return false
      return true
    }

    /**
     * Presentation facts for one Session row's leading status cell.
     * @param {object} summary - Session summary.
     * @param {ReadonlyMap<string, object>} statuses - unified UI status snapshot.
     * @param {(key: string) => string} t - translate seat.
     * @returns {{state: string, label: string, compact?: string}} dot state and labels.
     */
    function statusView(summary, statuses, t) {
      const status = statuses.get(summary.id)
      const kind = status?.pendingInteraction?.kind
      if (kind === 'approval') {
        return { state: 'warning', label: t('status.waitingApproval'), compact: t('status.approval.short') }
      }
      if (kind === 'plan-review') {
        return { state: 'warning', label: t('status.planReview'), compact: t('status.planReview.short') }
      }
      if (kind === 'question') {
        return { state: 'warning', label: t('status.waitingAnswer'), compact: t('status.answer.short') }
      }
      if ((status?.running ?? summary.running) === true) {
        return { state: 'ongoing', label: t('status.running') }
      }
      if (status?.completionUnread === true) {
        return { state: 'done', label: t('status.completed') }
      }
      return { state: 'idle', label: t('status.idle') }
    }

    /**
     * The four sections the UI renders, derived purely from snapshots.
     * @param {object} input - derivation inputs.
     * @param {object} input.list - Session list snapshot.
     * @param {object} input.workspaceSnapshot - Workspace snapshot.
     * @param {ReadonlyMap<string, object>} input.statuses - status snapshot.
     * @param {string} input.query - filter text (already trimmed).
     * @param {number} input.now - current epoch ms for relative labels.
     * @param {number} input.recentLimit - Recent row cap.
     * @param {(key: string, params?: object) => string} input.t - translate seat.
     * @returns {object} derived sections.
     */
    function deriveSections({ list, workspaceSnapshot, statuses, query, now, recentLimit, t }) {
      const archived = new Set(workspaceSnapshot.archivedSessionIds)
      const pinnedSet = new Set(workspaceSnapshot.pinnedSessionIds)
      const currentId = currentSessionId(list)
      const membership = membershipOf(workspaceSnapshot.items)
      const sessionRank = new Map()
      workspaceSnapshot.items.forEach((workspace, workspaceIndex) => {
        workspace.sessionIds.forEach((sessionId, sessionIndex) => {
          sessionRank.set(sessionId, workspaceIndex * 100000 + sessionIndex)
        })
      })
      const manualRankOf = (id) => {
        const rank = sessionRank.get(id)
        return rank === undefined ? 100000000 + list.ids.indexOf(id) : rank
      }
      const visible = new Set()
      for (const id of list.ids) {
        const summary = list.byId[id]
        if (summary !== undefined && isVisibleSummary(summary, currentId)) visible.add(id)
      }

      const q = query.trim().toLowerCase()
      const matches = (summary) => {
        if (q === '') return true
        if (displayTitle(summary, t).toLowerCase().includes(q)) return true
        const workspace = membership.get(summary.id)
        if (workspace !== undefined && workspaceLabel(workspace, t).toLowerCase().includes(q)) return true
        return basename(summary.cwd).toLowerCase().includes(q)
      }

      /** Build one row node in the order the browser renders it. */
      const nodeOf = (summary) => {
        const status = statusView(summary, statuses, t)
        const workspace = membership.get(summary.id)
        return {
          id: summary.id,
          title: displayTitle(summary, t),
          blank: summary.blank === true,
          archived: archived.has(summary.id),
          pinned: !archived.has(summary.id) && pinnedSet.has(summary.id),
          status,
          updatedAt: summary.updatedAt,
          time: timeLabel(summary.updatedAt, now, t),
          projectLabel: workspace === undefined ? t('project.ungrouped') : workspaceLabel(workspace, t),
          projectKey: workspace === undefined ? '' : workspace.workspaceId,
          manualRank: manualRankOf(summary.id),
        }
      }

      const pinned = []
      for (const id of workspaceSnapshot.pinnedSessionIds) {
        const summary = list.byId[id]
        if (summary === undefined || !visible.has(id) || archived.has(id) || !matches(summary)) continue
        pinned.push(nodeOf(summary))
      }

      /** Newest first, with the selected blank Session forced to the front. */
      const sortByRecency = (ids) => [...ids].sort((left, right) => {
        const a = list.byId[left]
        const b = list.byId[right]
        if (a === undefined || b === undefined) return 0
        const aBlank = a.blank === true && a.id === currentId
        const bBlank = b.blank === true && b.id === currentId
        if (aBlank !== bBlank) return aBlank ? -1 : 1
        if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })

      const projects = []
      const accounted = new Set()
      for (const workspace of workspaceSnapshot.items) {
        const workspaceMatches = q !== '' && workspaceLabel(workspace, t).toLowerCase().includes(q)
        const ids = []
        for (const id of workspace.sessionIds) {
          accounted.add(id)
          const summary = list.byId[id]
          if (summary === undefined || !visible.has(id)) continue
          if (archived.has(id) || pinnedSet.has(id)) continue
          if (q !== '' && !workspaceMatches && !matches(summary)) continue
          ids.push(id)
        }
        if (q !== '' && ids.length === 0 && !workspaceMatches) continue
        projects.push({
          key: workspace.workspaceId,
          workspaceId: workspace.workspaceId,
          label: workspaceLabel(workspace, t),
          path: workspace.path,
          createdAt: Date.parse(workspace.createdAt),
          nodes: sortByRecency(ids).map((id) => nodeOf(list.byId[id])),
          containsCurrent: currentId !== undefined && workspace.sessionIds.includes(currentId),
        })
      }

      const strayIds = list.ids.filter((id) => {
        if (accounted.has(id) || !visible.has(id) || archived.has(id) || pinnedSet.has(id)) return false
        const summary = list.byId[id]
        return summary !== undefined && matches(summary)
      })
      if (strayIds.length > 0) {
        projects.push({
          key: '',
          workspaceId: undefined,
          label: t('project.ungrouped'),
          path: undefined,
          createdAt: undefined,
          nodes: sortByRecency(strayIds).map((id) => nodeOf(list.byId[id])),
          containsCurrent: currentId !== undefined && strayIds.includes(currentId),
        })
      }

      const recentIds = sortByRecency(list.ids.filter((id) => {
        const summary = list.byId[id]
        if (summary === undefined || summary.blank === true) return false
        if (!visible.has(id) || archived.has(id) || pinnedSet.has(id) || !matches(summary)) return false
        return true
      }))

      // Archived section: every archived conversation, Host manual order; the
      // Browser applies the section's own sort choice.
      const archivedNodes = list.ids
        .filter((id) => {
          const summary = list.byId[id]
          if (summary === undefined || !visible.has(id) || !archived.has(id)) return false
          if (pinnedSet.has(id)) return false
          return matches(summary)
        })
        .map((id) => nodeOf(list.byId[id]))
        .sort((left, right) => left.manualRank - right.manualRank)

      const recentAll = recentIds.map((id) => nodeOf(list.byId[id]))
      return {
        pinned,
        projects,
        recent: recentAll.slice(0, recentLimit),
        recentAll,
        recentTotal: recentAll.length,
        archivedNodes,
        currentId,
      }
    }

    /**
     * Read the browser-local collapse record.
     * @returns {Record<string, boolean>} collapsed Workspace keys.
     */
    function readCollapsed() {
      try {
        const raw = window.localStorage.getItem(COLLAPSED_KEY)
        if (raw === null) return {}
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        const collapsed = {}
        for (const key of Object.keys(parsed)) {
          if (parsed[key] === true) collapsed[key] = true
        }
        return collapsed
      } catch (error) {
        console.warn('sidebar-sections: unreadable collapse record', error)
        return {}
      }
    }

    /**
     * Persist the browser-local collapse record (best effort).
     * @param {Record<string, boolean>} collapsed - collapsed Workspace keys.
     */
    function writeCollapsed(collapsed) {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed))
      } catch (error) {
        console.warn('sidebar-sections: collapse record not persisted', error)
      }
    }


    /**
     * Read the browser-local section view preferences (grouping + sort order).
     * @returns {{pinnedSort: string, archivedSort: string, projects: object, recent: object}} views.
     */
    function readSectionViews() {
      const defaults = {
        pinnedSort: 'manual',
        archivedSort: 'manual',
        projects: { group: 'project', sort: 'updated' },
        recent: { group: 'list', sort: 'updated' },
      }
      try {
        const raw = window.localStorage.getItem(SECTION_VIEW_KEY)
        if (raw === null) return defaults
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return defaults
        const readView = (value, fallback) => {
          if (value === null || typeof value !== 'object') return fallback
          return {
            group: value.group === 'list' || value.group === 'project' ? value.group : fallback.group,
            sort: value.sort === 'manual' || value.sort === 'updated' ? value.sort : fallback.sort,
          }
        }
        return {
          pinnedSort: parsed.pinnedSort === 'updated' ? 'updated' : 'manual',
          archivedSort: parsed.archivedSort === 'updated' ? 'updated' : 'manual',
          projects: readView(parsed.projects, defaults.projects),
          recent: readView(parsed.recent, defaults.recent),
        }
      } catch (error) {
        console.warn('sidebar-sections: unreadable section view record', error)
        return defaults
      }
    }

    /**
     * Persist the browser-local section view preferences (best effort).
     * @param {object} views - current preferences.
     */
    function writeSectionViews(views) {
      try {
        window.localStorage.setItem(SECTION_VIEW_KEY, JSON.stringify(views))
      } catch (error) {
        console.warn('sidebar-sections: section views not persisted', error)
      }
    }

    /**
     * Read the browser-local manual order overrides (drag reordering).
     * @returns {{pinned: string[], recent: string[], archived: string[], flat: string[], projects: Record<string, string[]>}} order.
     */
    function readManualOrder() {
      const empty = { pinned: [], recent: [], archived: [], flat: [], projects: {} }
      try {
        const raw = window.localStorage.getItem(MANUAL_ORDER_KEY)
        if (raw === null) return empty
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return empty
        const ids = (value) => (Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [])
        const projects = {}
        if (parsed.projects !== null && typeof parsed.projects === 'object') {
          for (const [key, value] of Object.entries(parsed.projects)) projects[key] = ids(value)
        }
        return {
          pinned: ids(parsed.pinned),
          recent: ids(parsed.recent),
          archived: ids(parsed.archived),
          flat: ids(parsed.flat),
          projects,
        }
      } catch (error) {
        console.warn('sidebar-sections: unreadable manual order', error)
        return empty
      }
    }

    /**
     * Persist the browser-local manual order overrides (best effort).
     * @param {object} order - current overrides.
     */
    function writeManualOrder(order) {
      try {
        window.localStorage.setItem(MANUAL_ORDER_KEY, JSON.stringify(order))
      } catch (error) {
        console.warn('sidebar-sections: manual order not persisted', error)
      }
    }

    /**
     * Read the browser-local section-collapse record.
     * @returns {Record<string, boolean>} collapsed section keys.
     */
    function readSectionCollapsed() {
      try {
        const raw = window.localStorage.getItem(SECTION_COLLAPSED_KEY)
        if (raw === null) return {}
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        const collapsed = {}
        for (const key of ['pinned', 'projects', 'recent', 'archived']) {
          if (parsed[key] === true) collapsed[key] = true
        }
        return collapsed
      } catch (error) {
        console.warn('sidebar-sections: unreadable section collapse record', error)
        return {}
      }
    }

    /**
     * Persist the browser-local section-collapse record (best effort).
     * @param {Record<string, boolean>} collapsed - collapsed section keys.
     */
    function writeSectionCollapsed(collapsed) {
      try {
        window.localStorage.setItem(SECTION_COLLAPSED_KEY, JSON.stringify(collapsed))
      } catch (error) {
        console.warn('sidebar-sections: section collapse not persisted', error)
      }
    }

    /**
     * Resolve the Host's first-use default Workspace. The registry stores the
     * fixed `default-workspace` title (displayed localized); users may rename
     * it, so the canonical on-disk segment is the fallback.
     * @param {object} snapshot - Workspace snapshot.
     * @returns {string|undefined} default Workspace id.
     */
    function defaultWorkspaceId(snapshot) {
      const items = Array.isArray(snapshot.items) ? snapshot.items : []
      const match = items.find((item) => item.title === 'default-workspace'
        || /(?:^|[\\/])default-workspace$/.test(item.path ?? ''))
      return match === undefined ? undefined : match.workspaceId
    }

    /**
     * Human-readable failure text without assuming shared error-class identity.
     * @param {unknown} error - rejection reason.
     * @returns {string} message text.
     */
    function messageOf(error) {
      if (error !== null && typeof error === 'object' && typeof error.message === 'string') {
        return error.message
      }
      return String(error)
    }

    /**
     * Component-internal clock for relative labels.
     * @param {number} intervalMs - refresh period.
     * @returns {number} current epoch ms.
     */
    function useNow(intervalMs) {
      const [now, setNow] = useState(() => Date.now())
      useEffect(() => {
        const timer = window.setInterval(() => { setNow(Date.now()) }, intervalMs)
        return () => { window.clearInterval(timer) }
      }, [intervalMs])
      return now
    }

    /**
     * Invoke an action from a React event handler, surfacing promise rejections
     * through the notice sink instead of leaving them unhandled.
     * @param {() => unknown} action - callback under a user gesture.
     * @param {(message: string) => void} report - notice sink.
     * @param {string} label - diagnostic prefix.
     * @param {(error: unknown) => string} [describe] - optional custom message.
     */
    function invoke(action, report, label, describe) {
      const fail = (error) => {
        console.warn(`sidebar-sections: ${label} failed`, error)
        report(describe === undefined ? messageOf(error) : describe(error))
      }
      try {
        const result = action()
        // Realm-safe thenable check: a promise produced by another bundle realm
        // is not an instance of this realm's Promise constructor.
        if (result !== null && typeof result === 'object' && typeof result.then === 'function') {
          result.then(undefined, fail)
        }
      } catch (error) {
        fail(error)
      }
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------

    const CSS = `
.dshss-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding-right: var(--dsh-sidebar-inline-padding, 12px);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
}

/* Rail: two 36px controls, matching the shell's collapsed rhythm. */
.dshss-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}
.dshss-railButton {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--dsw-radius-md);
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dshss-railButton:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-railButton:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}

/* Search owns its own row above the sections. */
.dshss-searchRow { flex: none; margin: 2px 0 8px; }
.dshss-searchBar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
}
.dshss-searchBar:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-searchBar:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dshss-searchBarLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dshss-iconButton {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary);
}
.dshss-iconButton:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-iconButton:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dshss-iconButton.dshss-small { width: 16px; height: 16px; border-radius: var(--dsw-radius-xs); }
.dshss-searchField {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 30px;
  margin-right: -4px;
  padding: 0 4px;
  box-sizing: border-box;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-caption);
}
.dshss-searchInput {
  flex: 1;
  width: 0;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
}
.dshss-searchInput::placeholder { color: var(--dsw-alias-label-tertiary); }
.dshss-searchFieldFull {
  flex: none;
  width: 100%;
  height: 32px;
  margin-right: 0;
}
.dshss-viewMenu { min-width: 200px; }

/* The single scrolling region. Top and left offsets mirror the region seat. */
.dshss-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-left: -4px;
  padding: 0 5px 16px 4px;
  scrollbar-gutter: stable;
}

.dshss-section { display: flex; flex-direction: column; gap: 2px; }
.dshss-section + .dshss-section { margin-top: 14px; }
.dshss-sectionHeader {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 4px;
  border-radius: var(--dsw-radius-sm);
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-label-primary);
}
.dshss-sectionHeader:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-sectionHeader:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dshss-sectionChevron {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 2px;
  color: var(--dsw-alias-label-caption);
}
.dshss-sectionArrow {
  display: inline-flex;
  transition: transform 150ms var(--ds-ease-in-out, ease);
}
.dshss-sectionArrowCollapsed { transform: rotate(-90deg); }
.dshss-sectionTitle {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
}
.dshss-sectionCount {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}
.dshss-sectionButtons {
  margin-left: auto;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.dshss-sectionAction {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--dsw-radius-xs);
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
.dshss-sectionAction:hover, .dshss-sectionAction:focus-visible {
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
.dshss-sectionAction:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
.dshss-hoverCard {
  position: fixed;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 268px;
  max-width: 420px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-shadow-lv3);
  pointer-events: none;
}
.dshss-hoverTop {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dshss-hoverTitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}
.dshss-hoverTime {
  flex: none;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.dshss-hoverMeta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dsw-alias-label-secondary);
}
.dshss-hoverProject {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dshss-subgroup {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px 0 10px;
  color: var(--dsw-alias-label-tertiary);
}
.dshss-subgroupLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 16px;
}
.dshss-emptyHint {
  padding: 2px 8px 4px 24px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}

/* Workspace group header: folder swaps to a chevron on hover/focus. */
.dshss-group { position: relative; }
.dshss-projectRow {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md);
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-label-primary);
}
.dshss-projectRow:hover, .dshss-projectRow.dshss-menuOpen {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dshss-projectRow:focus-visible, .dshss-row:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.dshss-slot {
  flex: none;
  width: 16px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dsw-alias-label-tertiary);
}
.dshss-folderActive { color: var(--dsw-alias-state-business-primary); }
.dshss-projectText { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dshss-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
}
.dshss-groupSessions { display: flex; flex-direction: column; gap: 2px; }

/* Trailing row actions surface on hover, focus, or an open menu. */
.dshss-rowActions { flex: none; display: none; align-items: center; gap: 4px; }
.dshss-projectRow:hover .dshss-rowActions,
.dshss-row:hover .dshss-rowActions,
.dshss-projectRow:focus-within .dshss-rowActions,
.dshss-row:focus-within .dshss-rowActions,
.dshss-projectRow.dshss-menuOpen .dshss-rowActions,
.dshss-row.dshss-menuOpen .dshss-rowActions { display: inline-flex; }

/* Conversation row: host metrics (32px cell, 8px pad, 16px leading slot). */
.dshss-row {
  display: flex;
  align-items: center;
  gap: 0;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md);
  cursor: pointer;
  user-select: none;
  color: var(--dsw-alias-label-primary);
}
.dshss-row:hover, .dshss-row.dshss-menuOpen { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-row[draggable="true"] { cursor: grab; }
.dshss-row.dshss-drop-before { box-shadow: inset 0 2px 0 var(--dsw-alias-label-primary); }
.dshss-row.dshss-drop-after { box-shadow: inset 0 -2px 0 var(--dsw-alias-label-primary); }
.dshss-row.dshss-selected { background: var(--dsw-alias-interactive-bg-hover); }
.dshss-row.dshss-archived { cursor: default; }
.dshss-row.dshss-archived .dshss-title { color: var(--dsw-alias-label-caption); }
/* The title consumes the free row width so the trailing time/actions sit on
   the row's right edge (host session-cell layout). */
.dshss-row .dshss-title { flex: 1; margin: 0 6px 0 4px; }
.dshss-time {
  flex: none;
  font-size: 10px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.dshss-row:hover .dshss-time, .dshss-row:focus-within .dshss-time { display: none; }
.dshss-pinMark {
  display: inline-flex;
  flex: none;
  width: 16px;
  height: 20px;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  color: var(--dsw-alias-label-caption);
}
.dshss-row:hover .dshss-pinMark, .dshss-row:focus-within .dshss-pinMark { display: none; }

/* Row action glyphs follow the host: hover and keyboard focus are a brightness
   step from tertiary to primary, never a background fill — the row underneath
   already carries the hover surface. */
.dshss-rowActions .dshss-iconButton {
  color: var(--dsw-alias-label-tertiary);
  background: transparent;
}
.dshss-rowActions .dshss-iconButton:hover,
.dshss-rowActions .dshss-iconButton:focus-visible,
.dshss-rowActions .dshss-iconButton:active {
  background: transparent;
  color: var(--dsw-alias-label-primary);
}
.dshss-rowActions .dshss-iconButton:focus-visible {
  outline: var(--dsw-focus-ring-width, 1px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}

.dshss-visuallyHidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Loading skeleton. */
.dshss-skeletonRow { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px; }
.dshss-skeletonDot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-skeleton);
  animation: dshss-pulse 2s cubic-bezier(0.36, 0, 0.64, 1) infinite;
}
.dshss-skeletonBar {
  height: 12px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-bg-skeleton);
  animation: dshss-pulse 2s cubic-bezier(0.36, 0, 0.64, 1) infinite;
}
@keyframes dshss-pulse {
  0% { opacity: 1; }
  40% { opacity: 0.6; }
  80%, 100% { opacity: 1; }
}

/* Empty states. */
.dshss-emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  text-align: center;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dshss-emptyAction {
  border: none;
  border-radius: var(--dsw-radius-sm);
  padding: 4px 8px;
  background: transparent;
  color: var(--dsw-alias-state-business-primary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dshss-emptyAction:hover { background: var(--dsw-alias-interactive-bg-hover); }

/* Inline failure notice: transient, dismissible, never a modal. */
.dshss-notice {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 2px 4px 6px;
  padding: 6px 8px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-skeleton);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 17px;
}
.dshss-noticeText { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dshss-noticeClose {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: var(--dsw-radius-xs);
  padding: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
}
.dshss-noticeClose:hover { color: var(--dsw-alias-label-primary); }

/* Dialog body content rendered inside the host Modal. */
.dshss-dialogContent { display: flex; flex-direction: column; gap: 16px; }
.dshss-dialogText { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }
.dshss-dialogField { display: flex; flex-direction: column; gap: 6px; }
.dshss-dialogLabel { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dshss-input {
  box-sizing: border-box;
  height: 32px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-button-elevated-fill, transparent);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 20px;
  outline: none;
}
.dshss-input:focus { border-color: var(--dsw-alias-state-business-primary); }
.dshss-dialogError { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }
.dshss-dialogFooter { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.dshss-activityList {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
`

    /** One stylesheet element per mounted root. */
    const StyleSheet = () => h('style', { 'data-sidebar-sections': '' }, CSS)

    // ---------------------------------------------------------------------
    // Shared surfaces
    // ---------------------------------------------------------------------

    /**
     * Icon button with the host tooltip and an accessible name.
     * @param {object} props - label, click handler, small variant, icon.
     * @returns {object} the wrapped button.
     */
    function IconButton({ label, onClick, small, children }) {
      return h(Tooltip, { label, side: 'bottom', align: 'end', delayMs: 500, portal: true },
        h('button', {
          type: 'button',
          className: `dshss-iconButton${small === true ? ' dshss-small' : ''}`,
          'aria-label': label,
          onClick,
        }, children))
    }

    /**
     * Status cell: host StateDot plus a screen-reader label.
     * @param {object} props - dot state and label.
     * @returns {object} the status cell.
     */
    function StatusCell({ state, label }) {
      return h('span', { className: 'dshss-dotWrap', role: 'img', 'aria-label': label },
        h(StateDot, { state }),
        h('span', { className: 'dshss-visuallyHidden' }, label))
    }

    /**
     * One conversation row: status, title, time, resting pin mark, and the
     * trailing management strip (ellipsis menu, archive/unarchive, pin/unpin).
     * @param {object} props - row node, selection state, and actions.
     * @returns {object} the row element.
     */
    function SessionRow({
      node, selected, panelActive, onOpen, onTogglePin, onArchive, onMenuAction, t,
      canDrag, dropHint, onDragStart, onDragOver, onDrop, onDragEnd,
    }) {
      const [menuOpen, setMenuOpen] = useState(false)
      const showStatus = node.status.state !== 'idle'
      const isSelected = selected && panelActive !== true
      const closeMenu = () => { setMenuOpen(false) }
      const runFromMenu = (action) => {
        closeMenu()
        action()
      }
      const menuLabel = t('actions.session.aria', { name: node.title })
      const pinLabel = node.pinned ? t('actions.unpin') : t('actions.pin')
      const archiveLabel = node.archived ? t('actions.unarchive') : t('actions.archive')
      return h('div', {
        className: [
          'dshss-row',
          isSelected ? 'dshss-selected' : '',
          node.archived ? 'dshss-archived' : '',
          menuOpen ? 'dshss-menuOpen' : '',
          dropHint === null || dropHint === undefined ? '' : 'dshss-drop-' + dropHint,
        ].filter(Boolean).join(' '),
        role: 'treeitem',
        draggable: canDrag === true,
        onDragStart: canDrag === true ? onDragStart : undefined,
        onDragOver: canDrag === true ? onDragOver : undefined,
        onDrop: canDrag === true ? onDrop : undefined,
        onDragEnd: canDrag === true ? onDragEnd : undefined,
        'data-session': node.id,
        'data-title': node.title,
        'data-project': node.projectLabel,
        'data-time': node.time,
        'aria-selected': isSelected,
        'aria-description': node.archived ? t('toast.archivedNotOpenable') : undefined,
        'aria-label': t('session.open', { title: node.title }),
        tabIndex: 0,
        onClick: onOpen,
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpen()
        },
      },
      h('span', { className: 'dshss-slot' }, showStatus && !node.archived
        ? h(StatusCell, { state: node.status.state, label: node.status.label })
        : null),
      h('span', { className: 'dshss-title' }, node.title),
      node.blank === true
        ? null
        : h('span', { className: 'dshss-time' }, node.status.compact ?? node.time),
      node.pinned && node.blank !== true
        ? h('span', {
          className: 'dshss-pinMark',
          role: 'img',
          'aria-label': t('session.pinned'),
        }, h(IconPinFillRegular, { size: 14 }))
        : null,
      node.blank === true ? null : h('span', {
        className: 'dshss-rowActions',
        onClick: (event) => { event.stopPropagation() },
      },
      h(Menu, {
        open: menuOpen,
        onClose: closeMenu,
        portal: true,
        closeOnPointerLeave: true,
        anchor: h('button', {
          type: 'button',
          className: 'dshss-iconButton dshss-small',
          'aria-label': menuLabel,
          onClick: () => { setMenuOpen((open) => !open) },
        }, h(IconEllipsisOutlineRegular, { size: 16 })),
      },
      !node.archived && h(MenuItemButton, {
        icon: node.pinned ? h(IconPinFillRegular, { size: 14 }) : h(IconPinOutlineRegular, { size: 14 }),
        onSelect: () => { runFromMenu(onTogglePin) },
      }, node.pinned ? t('menu.unpinSession') : t('menu.pinSession')),
      h(MenuItemButton, {
        icon: h(IconEditOutlineRegular, { size: 14 }),
        onSelect: () => { runFromMenu(() => { onMenuAction('rename') }) },
      }, t('menu.renameSession')),
      h(MenuItemButton, {
        icon: h(IconBranchOutlineRegular, { size: 14 }),
        onSelect: () => { runFromMenu(() => { onMenuAction('fork') }) },
      }, t('menu.forkSession')),
      h(MenuItemButton, {
        icon: node.archived
          ? h(IconUnarchiveOutlineRegular, { size: 14 })
          : h(IconArchiveOutlineRegular, { size: 14 }),
        onSelect: () => { runFromMenu(onArchive) },
      }, node.archived ? t('menu.unarchiveSession') : t('menu.archiveSession')),
      h(MenuItemButton, {
        icon: h(IconCopyOutlineRegular, { size: 14 }),
        separatorBefore: true,
        onSelect: () => { runFromMenu(() => { onMenuAction('copy-id') }) },
      }, t('menu.sessionId'))),
      h(IconButton, { label: archiveLabel, small: true, onClick: onArchive },
          node.archived
            ? h(IconUnarchiveOutlineRegular, { size: 14 })
            : h(IconArchiveOutlineRegular, { size: 14 })),
        node.archived
          ? null
          : h(IconButton, { label: pinLabel, small: true, onClick: onTogglePin },
            node.pinned ? h(IconPinFillRegular, { size: 14 }) : h(IconPinOutlineRegular, { size: 14 }))))
    }

    /**
     * One Project group: a Workspace header row with its management menu and a
     * nested run of conversation rows.
     * @param {object} props - group, expansion, and row actions.
     * @returns {object} the group element.
     */
    function ProjectGroup({
      group, expanded, onToggle, onNewSession, onWorkspaceMenu, onSessionMenu,
      onOpen, onTogglePin, onArchive, panelActive, rowDrag, t,
    }) {
      const [menuOpen, setMenuOpen] = useState(false)
      const groupLabel = t('actions.workspace.aria', { name: group.label })
      return h('div', { className: 'dshss-group', role: 'group', 'aria-label': group.label },
        h('div', {
          className: `dshss-projectRow${menuOpen ? ' dshss-menuOpen' : ''}`,
          role: 'treeitem',
          'aria-expanded': expanded,
          'aria-label': group.label,
          tabIndex: 0,
          onClick: onToggle,
          onKeyDown: (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onToggle()
          },
        },
        h('span', {
          className: `dshss-slot dshss-folder${group.containsCurrent ? ' dshss-folderActive' : ''}`,
        }, expanded ? h(IconFolderOpenRegular, { size: 16 }) : h(IconFolderCloseRegular, { size: 16 })),
        h('span', { className: 'dshss-projectText' },
          h('span', { className: 'dshss-title' }, group.label)),
        h('span', {
          className: 'dshss-rowActions',
          onClick: (event) => { event.stopPropagation() },
        },
        group.workspaceId !== undefined && h(IconButton, {
          label: t('project.newSession.aria', { name: group.label }),
          onClick: onNewSession,
        }, h(IconNewChatOutlineRegular, { size: 16 })),
        group.workspaceId !== undefined && h(Menu, {
          open: menuOpen,
          onClose: () => { setMenuOpen(false) },
          portal: true,
          closeOnPointerLeave: true,
          align: 'end',
          anchor: h('button', {
            type: 'button',
            className: 'dshss-iconButton dshss-small',
            'aria-label': groupLabel,
            onClick: () => { setMenuOpen((open) => !open) },
          }, h(IconEllipsisOutlineRegular, { size: 16 })),
          items: [
            { id: 'rename', label: t('rename'), icon: h(IconEditOutlineRegular, { size: 14 }) },
            {
              id: 'delete',
              label: t('delete.workspace'),
              icon: h(IconTrashOutlineRegular, { size: 14 }),
              danger: true,
            },
          ],
          onSelect: (id) => {
            setMenuOpen(false)
            onWorkspaceMenu(id)
          },
        }))),
        expanded === true
          ? h('div', { className: 'dshss-groupSessions', role: 'group', 'aria-label': group.label },
            group.nodes.length === 0
              ? h('div', { className: 'dshss-emptyHint' }, t('project.empty'))
              : group.nodes.map((node) => h(SessionRow, {
                key: node.id,
                node,
                selected: node.id === group.currentId,
                panelActive,
                onOpen: () => { onOpen(node) },
                onTogglePin: () => { onTogglePin(node) },
                onArchive: () => { onArchive(node) },
                onMenuAction: (action) => { onSessionMenu(node, action) },
                ...rowDrag(node, group.nodes.map((entry) => entry.id)),
                t,
              })))
          : null)
    }

    /**
     * Always-visible small action button used in section headers.
     * @param {object} props - accessible label, click handler, icon.
     * @returns {object} the wrapped button.
     */
    function SectionIconButton({ label, onClick, children }) {
      return h(Tooltip, { label, side: 'bottom', align: 'end', delayMs: 500, portal: true },
        h('button', {
          type: 'button',
          className: 'dshss-sectionAction',
          'aria-label': label,
          onClick,
        }, children))
    }

    /**
     * Per-section overflow menu: grouping mode and sort order.
     * @param {object} props - current modes, their dispatchers, and t.
     * @returns {object} the menu element.
     */
    function SectionMenu({ label, grouping, onGrouping, sort, onSort, t }) {
      const [open, setOpen] = useState(false)
      const items = []
      const selectedIds = []
      if (grouping !== undefined) {
        items.push(
          { type: 'label', id: 'group-by', text: t('group.label') },
          { id: 'group-project', label: t('group.byProject'), icon: h(IconFolderCloseRegular, { size: 14 }) },
          { id: 'group-list', label: t('group.oneList'), icon: h(IconQueueOutlineRegular, { size: 14 }) },
        )
        selectedIds.push(grouping === 'project' ? 'group-project' : 'group-list')
      }
      if (sort !== undefined) {
        items.push(
          { type: 'label', id: 'sort-by', text: t('sort.label') },
          { id: 'sort-manual', label: t('sort.manual') },
          { id: 'sort-updated', label: t('sort.updated') },
        )
        selectedIds.push(sort === 'manual' ? 'sort-manual' : 'sort-updated')
      }
      return h(Menu, {
        open,
        onClose: () => { setOpen(false) },
        portal: true,
        align: 'end',
        listClassName: 'dshss-viewMenu',
        anchor: h(SectionIconButton, {
          label,
          onClick: () => { setOpen((value) => !value) },
        }, h(IconEllipsisOutlineRegular, { size: 14 })),
        items,
        selectedIds,
        onSelect: (id) => {
          setOpen(false)
          if (id === 'group-project' || id === 'group-list') {
            onGrouping(id === 'group-project' ? 'project' : 'list')
            return
          }
          if (id === 'sort-manual' || id === 'sort-updated') {
            onSort(id === 'sort-manual' ? 'manual' : 'updated')
            return
          }
        },
      })
    }

    /**
     * Section heading: collapse chevron, large title, count, right-side action
     * buttons. Clicking the header (or Enter/Space on it) toggles the section.
     * @param {object} props - title, count, expansion and action children.
     * @returns {object} the section header element.
     */
    function SectionHeader({ title, count, collapsed, onToggle, children, t }) {
      return h('div', {
        className: 'dshss-sectionHeader',
        role: 'button',
        tabIndex: 0,
        'aria-expanded': !collapsed,
        'aria-label': t(collapsed ? 'section.expand' : 'section.collapse', { name: title }),
        onClick: onToggle,
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onToggle()
        },
      },
      h('h2', { className: 'dshss-sectionTitle' }, title),
      count > 0 ? h('span', { className: 'dshss-sectionCount' }, t('section.count', { n: count })) : null,
      h('span', { className: 'dshss-sectionChevron', 'aria-hidden': 'true' },
        h(IconChevronDownOutlineRegular, {
          size: 14,
          className: 'dshss-sectionArrow' + (collapsed ? ' dshss-sectionArrowCollapsed' : ''),
        })),
      h('span', {
        className: 'dshss-sectionButtons',
        onClick: (event) => { event.stopPropagation() },
      }, children))
    }

    /**
     * Loading placeholder rows for the first snapshot.
     * @returns {object} skeleton rows.
     */
    function Skeleton() {
      return h('div', { 'aria-hidden': 'true' },
        [0, 1, 2, 3, 4].map((index) => h('div', { key: index, className: 'dshss-skeletonRow' },
          h('span', { className: 'dshss-skeletonDot' }),
          h('span', {
            className: 'dshss-skeletonBar',
            style: { width: index % 2 === 0 ? '62%' : '44%' },
          }))))
    }

    // ---------------------------------------------------------------------
    // Region component
    // ---------------------------------------------------------------------

    /**
     * The `sidebar.workspaces` region: header, filter, and the three sections.
     * @param {object} props - owner props, standard hooks, locale and actions.
     * @returns {object} the region element.
     */
    function Browser(props) {
      const {
        wide, expandSidebar, useSessions, useWorkspaces, useSessionStatus, usePanelInfo,
        t, actions,
      } = props
      const list = useSessions((state) => state)
      const workspaceSnapshot = useWorkspaces((state) => state)
      const statuses = useSessionStatus((state) => state)
      const panelActive = usePanelInfo((info) => info.activePanelId !== null)
      const now = useNow(CLOCK_INTERVAL_MS)

      const [query, setQuery] = useState('')
      const [searchOpen, setSearchOpen] = useState(false)
      const [focusSearchOnExpand, setFocusSearchOnExpand] = useState(false)
      const [collapsed, setCollapsed] = useState(readCollapsed)
      const [collapsedSections, setCollapsedSections] = useState(readSectionCollapsed)
      const [sectionViews, setSectionViews] = useState(readSectionViews)
      const [manualOrder, setManualOrder] = useState(readManualOrder)
      const [dragState, setDragState] = useState(null)
      const [recentLimit, setRecentLimit] = useState(RECENT_INITIAL)
      const [notice, setNotice] = useState(null)
      const [hoverPreview, setHoverPreview] = useState(null)
      const inputRef = useRef(null)
      const hoverTimerRef = useRef(null)

      const loading = workspaceSnapshot.phase !== 'ready' || list.phase !== 'ready'
      const sections = useMemo(() => deriveSections({
        list,
        workspaceSnapshot,
        statuses,
        query,
        now,
        recentLimit,
        t,
      }), [list, workspaceSnapshot, statuses, query, now, recentLimit, t])

      useEffect(() => {
        if (!searchOpen) return
        inputRef.current?.focus()
      }, [searchOpen])

      useEffect(() => {
        if (!wide || !focusSearchOnExpand) return
        setFocusSearchOnExpand(false)
        setSearchOpen(true)
      }, [wide, focusSearchOnExpand])

      useEffect(() => {
        if (notice === null) return
        const timer = window.setTimeout(() => { setNotice(null) }, NOTICE_TIMEOUT_MS)
        return () => { window.clearTimeout(timer) }
      }, [notice])

      useEffect(() => () => {
        if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current)
      }, [])

      /** Show one transient inline notice. */
      const report = (message) => { setNotice(message) }

      /** Clear the pending row-hover dwell timer. */
      const cancelHoverTimer = () => {
        if (hoverTimerRef.current !== null) {
          window.clearTimeout(hoverTimerRef.current)
          hoverTimerRef.current = null
        }
      }
      /** Start the row-hover dwell that opens the project preview card. */
      const hoverRow = (event) => {
        const row = event.target?.closest?.('.dshss-row')
        if (row === null || row === undefined) return
        if (hoverPreview !== null && hoverPreview.session === row.dataset.session) return
        cancelHoverTimer()
        const rect = row.getBoundingClientRect()
        hoverTimerRef.current = window.setTimeout(() => {
          hoverTimerRef.current = null
          setHoverPreview({
            session: row.dataset.session,
            title: row.dataset.title,
            project: row.dataset.project,
            time: row.dataset.time,
            rect: { right: rect.right, left: rect.left, top: rect.top },
          })
        }, 420)
      }
      /** Close the preview when the pointer leaves the row (or its actions). */
      const leaveRow = (event) => {
        const row = event.target?.closest?.('.dshss-row')
        if (row === null || row === undefined) return
        if (event.relatedTarget !== null && row.contains(event.relatedTarget)) return
        cancelHoverTimer()
        setHoverPreview(null)
      }

      /** Open a conversation; archived rows explain why they stay closed. */
      const openNode = (node) => {
        if (node.archived) {
          report(t('toast.archivedNotOpenable'))
          return
        }
        invoke(() => actions.openSession(node.id), report, 'open session')
      }

      /** Pin or unpin with the shipped failure wording. */
      const togglePin = (node) => {
        const pinning = !node.pinned
        invoke(
          () => (pinning ? actions.pinSession(node.id) : actions.unpinSession(node.id)),
          () => { report(t(pinning ? 'toast.pinFailed' : 'toast.unpinFailed')) },
          'toggle pin',
        )
      }

      /** Archive or unarchive; the Host's stop-and-archive confirmation is
       * requested by the apply closure and rendered through the shell overlay. */
      const archiveNode = (node) => {
        if (node.archived) {
          invoke(
            () => actions.unarchiveSession(node.id),
            (message) => { report(t('toast.unarchiveFailed', { message })) },
            'unarchive session',
          )
          return
        }
        invoke(
          () => actions.archiveSession(node.id, node.title),
          (message) => { report(t('toast.archiveFailed', { message })) },
          'archive session',
        )
      }

      /** Row-menu dispatch shared by conversation rows. */
      const runSessionMenu = (node, action) => {
        if (action === 'rename') {
          actions.requestSessionRename(node.id, node.title)
          return
        }
        if (action === 'fork') {
          invoke(
            () => actions.forkSession(node.id),
            (error) => {
              const code = error?.rpcError?.code
              report(code === 'session/migration-required'
                ? t('toast.forkRequiresOpen')
                : t('toast.forkFailed', { message: messageOf(error) }))
            },
            'fork session',
          )
          return
        }
        if (action === 'copy-id') {
          invoke(
            () => actions.copySessionId(node.id),
            () => { report(t('toast.sessionIdCopyFailed')) },
            'copy session id',
          )
        }
      }

      const addWorkspace = () => {
        invoke(
          () => actions.addWorkspace(),
          (message) => { report(t('toast.workspaceAddFailed', { message })) },
          'add workspace',
        )
      }

      /** New Session targets the Host's default workspace (falls back to the
       * current/most recent workspace when no default row is present). */
      const defaultWorkspace = defaultWorkspaceId(workspaceSnapshot)
      const newSession = () => {
        invoke(() => actions.startSession(defaultWorkspace), report, 'new session')
      }

      const toggleGroup = (key) => {
        setCollapsed((previous) => {
          const next = { ...previous }
          if (next[key] === true) delete next[key]
          else next[key] = true
          writeCollapsed(next)
          return next
        })
      }

      const toggleSection = (key) => {
        setCollapsedSections((previous) => {
          const next = { ...previous }
          if (next[key] === true) delete next[key]
          else next[key] = true
          writeSectionCollapsed(next)
          return next
        })
      }

      const closeSearch = () => {
        setSearchOpen(false)
        setQuery('')
      }

      /** Replace one section's grouping/sort preference and persist it. */
      const updateSectionView = (patch) => {
        setSectionViews((previous) => {
          const next = {
            pinnedSort: patch.pinnedSort ?? previous.pinnedSort,
            archivedSort: patch.archivedSort ?? previous.archivedSort,
            projects: patch.projects ?? previous.projects,
            recent: patch.recent ?? previous.recent,
          }
          writeSectionViews(next)
          return next
        })
      }
      const setPinnedSort = (sort) => { updateSectionView({ pinnedSort: sort }) }
      const setArchivedSort = (sort) => { updateSectionView({ archivedSort: sort }) }
      const setProjectsView = (patch) => {
        updateSectionView({ projects: { ...sectionViews.projects, ...patch } })
      }
      const setRecentView = (patch) => {
        updateSectionView({ recent: { ...sectionViews.recent, ...patch } })
      }

      /** Normalize a Workspace key for the manual-order record. */
      const projectOrderKey = (key) => (key === '' ? '__ungrouped__' : key)

      /** Stable sort by a drag-created order; unknown ids keep their relative slot. */
      const applyManualOrder = (nodes, order) => {
        if (order === undefined || order.length === 0) return nodes
        const rank = new Map(order.map((id, index) => [id, index]))
        return [...nodes].sort((left, right) => {
          const leftRank = rank.get(left.id)
          const rightRank = rank.get(right.id)
          if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank
          if (leftRank !== undefined) return -1
          if (rightRank !== undefined) return 1
          return 0
        })
      }

      /** Merge one drag-created order into the persisted manual-order record. */
      const commitManualOrder = (container, order, draggedId, workspaceId, beforeId) => {
        setManualOrder((previous) => {
          const next = { ...previous }
          if (container === 'pinned') next.pinned = order
          else if (container === 'recent') next.recent = order
          else if (container === 'archived') next.archived = order
          else if (container === 'flat') next.flat = order
          else {
            const key = container.slice('project:'.length)
            next.projects = { ...previous.projects, [key]: order }
          }
          writeManualOrder(next)
          return next
        })
        // Real Workspace groups also persist the order on the Host.
        if (container.startsWith('project:') && workspaceId !== undefined) {
          invoke(() => actions.moveSessionBefore(workspaceId, draggedId, beforeId), report, 'reorder session')
        }
      }

      const beginDrag = (event, container, id) => {
        if (event.dataTransfer !== undefined && event.dataTransfer !== null) {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', id)
        }
        setDragState({ id, container, overId: null, half: null })
      }

      const hoverDrag = (event, container, id) => {
        if (dragState === null || dragState.container !== container) return
        event.preventDefault()
        if (event.dataTransfer !== undefined && event.dataTransfer !== null) {
          event.dataTransfer.dropEffect = 'move'
        }
        const rect = event.currentTarget.getBoundingClientRect()
        const half = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        if (dragState.overId !== id || dragState.half !== half) {
          setDragState({ ...dragState, overId: id, half })
        }
      }

      const dropDrag = (event, container, order, workspaceId) => {
        if (dragState === null || dragState.container !== container) return
        event.preventDefault()
        const { id, overId, half } = dragState
        setDragState(null)
        if (overId === null || overId === id) return
        const next = order.filter((value) => value !== id)
        const targetIndex = next.indexOf(overId)
        if (targetIndex === -1) next.push(id)
        else next.splice(half === 'after' ? targetIndex + 1 : targetIndex, 0, id)
        const movedIndex = next.indexOf(id)
        const beforeId = movedIndex === -1 ? undefined : next[movedIndex + 1]
        commitManualOrder(container, next, id, workspaceId, beforeId)
      }

      /** Drag props for one row inside a manual-sort container. */
      const rowDrag = (container, enabled, workspaceId) => (node, order) => (enabled !== true || node.blank === true
        ? {}
        : {
          canDrag: true,
          dropHint: dragState !== null && dragState.container === container && dragState.overId === node.id
            ? dragState.half
            : null,
          onDragStart: (event) => { beginDrag(event, container, node.id) },
          onDragOver: (event) => { hoverDrag(event, container, node.id) },
          onDrop: (event) => { dropDrag(event, container, order, workspaceId) },
          onDragEnd: () => { setDragState(null) },
        })

      const contentWidth = wide ? '' : ' dshss-railRoot'
      const style = h(StyleSheet, { key: 'style' })

      if (!wide) {
        return h('div', { className: 'dshss-root' + contentWidth }, style,
          h('div', { className: 'dshss-rail' },
            h('button', {
              type: 'button',
              className: 'dshss-railButton',
              'aria-label': t('rail.search'),
              onClick: () => {
                expandSidebar()
                setFocusSearchOnExpand(true)
              },
            }, h(IconSearchOutlineRegular, { size: 18 })),
            h('button', {
              type: 'button',
              className: 'dshss-railButton',
              'aria-label': t('rail.add'),
              onClick: addWorkspace,
            }, h(IconProjectAddOutlineRegular, { size: 18 })),
            h('button', {
              type: 'button',
              className: 'dshss-railButton',
              'aria-label': t('newSession'),
              onClick: newSession,
            }, h(IconNewChatOutlineRegular, { size: 18 }))))
      }

      const filtering = query.trim() !== ''
      /** Manual order follows Host Saved order; updated keeps derivations recency. */
      const orderNodes = (nodes, sort) => (sort === 'manual'
        ? [...nodes].sort((left, right) => left.manualRank - right.manualRank)
        : nodes)
      const pinnedNodes = sectionViews.pinnedSort === 'manual'
        ? applyManualOrder(orderNodes(sections.pinned, 'manual'), manualOrder.pinned)
        : [...sections.pinned].sort((left, right) => right.updatedAt - left.updatedAt)
      const projectGroups = sections.projects.map((group) => ({
        ...group,
        nodes: sectionViews.projects.sort === 'manual'
          ? applyManualOrder(
            orderNodes(group.nodes, 'manual'),
            manualOrder.projects[projectOrderKey(group.key)] ?? [],
          )
          : group.nodes,
      }))
      const flatProjectNodes = sectionViews.projects.sort === 'manual'
        ? applyManualOrder(projectGroups.flatMap((group) => group.nodes), manualOrder.flat)
        : projectGroups.flatMap((group) => group.nodes)
      const projectCount = sectionViews.projects.group === 'project' ? projectGroups.length : flatProjectNodes.length
      const pinnedCount = pinnedNodes.length
      const archivedNodes = sectionViews.archivedSort === 'manual'
        ? applyManualOrder(orderNodes(sections.archivedNodes, 'manual'), manualOrder.archived)
        : [...sections.archivedNodes].sort((left, right) => right.updatedAt - left.updatedAt)
      const archivedCount = archivedNodes.length
      const recentOrdered = sectionViews.recent.sort === 'manual'
        ? applyManualOrder(orderNodes(sections.recentAll, 'manual'), manualOrder.recent)
        : sections.recentAll
      const recentCount = recentOrdered.length
      const recentNodes = recentOrdered.slice(0, recentLimit)
      const recentGroups = []
      if (sectionViews.recent.group === 'project') {
        const byKey = new Map()
        for (const node of recentNodes) {
          const key = node.projectKey === '' ? '__ungrouped__' : node.projectKey
          let group = byKey.get(key)
          if (group === undefined) {
            group = { key, label: node.projectLabel, nodes: [] }
            byKey.set(key, group)
            recentGroups.push(group)
          }
          group.nodes.push(node)
        }
      }
      const nothingVisible = pinnedCount + recentCount + archivedCount === 0 && flatProjectNodes.length === 0
      const sectionOpen = (key) => filtering || collapsedSections[key] !== true
      const pinnedOpen = sectionOpen('pinned')
      const projectsOpen = sectionOpen('projects')
      const recentOpen = sectionOpen('recent')
      const archivedOpen = sectionOpen('archived')

      const searchRow = h('div', { className: 'dshss-searchRow' },
        searchOpen
          ? h('div', { className: 'dshss-searchField dshss-searchFieldFull' },
            h(IconSearchOutlineRegular, { size: 14 }),
            h('input', {
              ref: inputRef,
              className: 'dshss-searchInput',
              type: 'text',
              value: query,
              placeholder: t('filter.placeholder'),
              'aria-label': t('filter.label'),
              spellCheck: false,
              onChange: (event) => { setQuery(event.target.value) },
              onKeyDown: (event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                closeSearch()
              },
            }),
            h('button', {
              type: 'button',
              className: 'dshss-iconButton dshss-small',
              'aria-label': t('filter.clear'),
              onClick: closeSearch,
            }, h(IconCloseFillRegular, { size: 12 })))
          : h('button', {
            type: 'button',
            className: 'dshss-searchBar',
            'aria-label': t('filter.label'),
            onClick: () => { setSearchOpen(true) },
          },
          h(IconSearchOutlineRegular, { size: 14 }),
          h('span', { className: 'dshss-searchBarLabel' }, t('filter.placeholder'))))

      const pinnedRows = () => {
        if (pinnedCount === 0) return h('div', { className: 'dshss-emptyHint' }, t('section.pinned.empty'))
        const drag = rowDrag('pinned', sectionViews.pinnedSort === 'manual')
        const order = pinnedNodes.map((node) => node.id)
        return pinnedNodes.map((node) => h(SessionRow, {
          key: node.id,
          node,
          selected: node.id === sections.currentId,
          panelActive,
          onOpen: () => { openNode(node) },
          onTogglePin: () => { togglePin(node) },
          onArchive: () => { archiveNode(node) },
          onMenuAction: (action) => { runSessionMenu(node, action) },
          ...drag(node, order),
          t,
        }))
      }

      const projectRows = () => {
        if (flatProjectNodes.length === 0) {
          return h('div', { className: 'dshss-emptyState' },
            h('span', null, t('section.projects.empty')),
            h('button', {
              type: 'button',
              className: 'dshss-emptyAction',
              onClick: addWorkspace,
            }, t('toolbar.add')))
        }
        if (sectionViews.projects.group === 'list') {
          const drag = rowDrag('flat', sectionViews.projects.sort === 'manual')
          const order = flatProjectNodes.map((node) => node.id)
          return flatProjectNodes.map((node) => h(SessionRow, {
            key: node.id,
            node,
            selected: node.id === sections.currentId,
            panelActive,
            onOpen: () => { openNode(node) },
            onTogglePin: () => { togglePin(node) },
            onArchive: () => { archiveNode(node) },
            onMenuAction: (action) => { runSessionMenu(node, action) },
            ...drag(node, order),
            t,
          }))
        }
        return projectGroups.map((group) => h(ProjectGroup, {
          key: group.key === '' ? '__ungrouped__' : group.key,
          group: { ...group, currentId: sections.currentId },
          expanded: filtering ? true : collapsed[group.key] !== true,
          onToggle: () => { toggleGroup(group.key) },
          onNewSession: () => { invoke(() => actions.startSession(group.workspaceId), report, 'start session') },
          onWorkspaceMenu: (id) => {
            if (id === 'rename') actions.renameWorkspace(group.workspaceId, group.label)
            else actions.deleteWorkspace(group.workspaceId, group.label)
          },
          onSessionMenu: runSessionMenu,
          onOpen: openNode,
          onTogglePin: togglePin,
          onArchive: archiveNode,
          panelActive,
          rowDrag: rowDrag('project:' + projectOrderKey(group.key), sectionViews.projects.sort === 'manual', group.workspaceId),
          t,
        }))
      }

      const recentRows = () => {
        if (recentCount === 0) {
          return h('div', { className: 'dshss-emptyHint' }, t('section.recent.empty'))
        }
        const drag = rowDrag(
          'recent',
          sectionViews.recent.sort === 'manual' && sectionViews.recent.group === 'list',
        )
        const order = recentNodes.map((node) => node.id)
        const rows = (nodes) => nodes.map((node) => h(SessionRow, {
          key: node.id,
          node,
          selected: node.id === sections.currentId,
          panelActive,
          onOpen: () => { openNode(node) },
          onTogglePin: () => { togglePin(node) },
          onArchive: () => { archiveNode(node) },
          onMenuAction: (action) => { runSessionMenu(node, action) },
          ...drag(node, order),
          t,
        }))
        const groups = sectionViews.recent.group === 'project'
          ? recentGroups.flatMap((group) => [
            h('div', { key: 'recent-group-' + group.key, className: 'dshss-subgroup' },
              h(IconFolderCloseRegular, { size: 14 }),
              h('span', { className: 'dshss-subgroupLabel' }, group.label)),
            ...rows(group.nodes),
          ])
          : rows(recentNodes)
        return [
          ...groups,
          recentCount > recentLimit
            ? h('button', {
              key: 'recent-more',
              type: 'button',
              className: 'dshss-emptyAction',
              onClick: () => { setRecentLimit((limit) => limit + RECENT_STEP) },
            }, t('recent.more'))
            : recentLimit > RECENT_INITIAL
              ? h('button', {
                key: 'recent-less',
                type: 'button',
                className: 'dshss-emptyAction',
                onClick: () => { setRecentLimit(RECENT_INITIAL) },
              }, t('recent.less'))
              : null,
        ]
      }

      const archivedRows = () => {
        if (archivedCount === 0) {
          return h('div', { className: 'dshss-emptyHint' }, t('section.archived.empty'))
        }
        const drag = rowDrag('archived', sectionViews.archivedSort === 'manual')
        const order = archivedNodes.map((node) => node.id)
        return archivedNodes.map((node) => h(SessionRow, {
          key: node.id,
          node,
          selected: node.id === sections.currentId,
          panelActive,
          onOpen: () => { openNode(node) },
          onTogglePin: () => { togglePin(node) },
          onArchive: () => { archiveNode(node) },
          onMenuAction: (action) => { runSessionMenu(node, action) },
          ...drag(node, order),
          t,
        }))
      }

      const sectionBody = loading
        ? h(Skeleton)
        : filtering && nothingVisible
          ? h('div', { className: 'dshss-emptyState' }, t('filter.empty'))
          : [
            h('section', { key: 'pinned', className: 'dshss-section', 'aria-label': t('section.pinned') },
              h(SectionHeader, {
                title: t('section.pinned'),
                count: pinnedCount,
                collapsed: !pinnedOpen,
                onToggle: () => { toggleSection('pinned') },
                t,
              },
              h(SectionMenu, {
                label: t('section.menu', { name: t('section.pinned') }),
                sort: sectionViews.pinnedSort,
                onSort: setPinnedSort,
                t,
              })),
              pinnedOpen ? pinnedRows() : null),
            h('section', { key: 'projects', className: 'dshss-section', 'aria-label': t('section.projects') },
              h(SectionHeader, {
                title: t('section.projects'),
                count: projectCount,
                collapsed: !projectsOpen,
                onToggle: () => { toggleSection('projects') },
                t,
              },
              h(SectionIconButton, {
                label: t('toolbar.add'),
                onClick: addWorkspace,
              }, h(IconProjectAddOutlineRegular, { size: 14 })),
              h(SectionMenu, {
                label: t('section.menu', { name: t('section.projects') }),
                grouping: sectionViews.projects.group,
                onGrouping: (group) => { setProjectsView({ group }) },
                sort: sectionViews.projects.sort,
                onSort: (sort) => { setProjectsView({ sort }) },
                t,
              })),
              projectsOpen ? projectRows() : null),
            h('section', { key: 'recent', className: 'dshss-section', 'aria-label': t('section.recent') },
              h(SectionHeader, {
                title: t('section.recent'),
                count: recentCount,
                collapsed: !recentOpen,
                onToggle: () => { toggleSection('recent') },
                t,
              },
              h(SectionIconButton, {
                label: t('newSession'),
                onClick: newSession,
              }, h(IconNewChatOutlineRegular, { size: 14 })),
              h(SectionMenu, {
                label: t('section.menu', { name: t('section.recent') }),
                grouping: sectionViews.recent.group,
                onGrouping: (group) => { setRecentView({ group }) },
                sort: sectionViews.recent.sort,
                onSort: (sort) => { setRecentView({ sort }) },
                t,
              })),
              recentOpen ? recentRows() : null),
            h('section', { key: 'archived', className: 'dshss-section', 'aria-label': t('section.archived') },
              h(SectionHeader, {
                title: t('section.archived'),
                count: archivedCount,
                collapsed: !archivedOpen,
                onToggle: () => { toggleSection('archived') },
                t,
              },
              h(SectionMenu, {
                label: t('section.menu', { name: t('section.archived') }),
                sort: sectionViews.archivedSort,
                onSort: setArchivedSort,
                t,
              })),
              archivedOpen ? archivedRows() : null),
          ]

      const hoverCard = hoverPreview === null ? null : (() => {
        const width = 268
        const viewport = window.innerWidth ?? 0
        const left = hoverPreview.rect.right + 12 + width > viewport
          ? hoverPreview.rect.left - width - 12
          : hoverPreview.rect.right + 12
        return createPortal(
          h('span', {
            className: 'dshss-hoverCard',
            role: 'tooltip',
            style: { left: Math.max(8, left) + 'px', top: Math.max(8, hoverPreview.rect.top - 4) + 'px' },
          },
          h('span', { className: 'dshss-hoverTop' },
            h('span', { className: 'dshss-hoverTitle' }, hoverPreview.title),
            hoverPreview.time ? h('span', { className: 'dshss-hoverTime' }, hoverPreview.time) : null),
          h('span', { className: 'dshss-hoverMeta' },
            h(IconFolderCloseRegular, { size: 14 }),
            h('span', { className: 'dshss-hoverProject' }, hoverPreview.project))),
          document.body)
      })()

      return h('div', {
        className: 'dshss-root' + contentWidth,
        onMouseOver: hoverRow,
        onMouseOut: leaveRow,
      }, style,
        searchRow,
        hoverCard,
        notice !== null
          ? h('div', { className: 'dshss-notice', role: 'status' },
            h('span', { className: 'dshss-noticeText' }, notice),
            h('button', {
              type: 'button',
              className: 'dshss-noticeClose',
              'aria-label': t('notice.dismiss'),
              onClick: () => { setNotice(null) },
            }, h(IconCloseFillRegular, { size: 12 })))
          : null,
        h('div', { className: 'dshss-scroll' }, sectionBody))
    }

    // ---------------------------------------------------------------------
    // Dialogs (workspace rename/delete, session rename, stop-and-archive)
    // ---------------------------------------------------------------------

    /**
     * Overlay host: renders the pending dialog request inside the Host Modal.
     * @param {object} props - overlay registration props.
     * @returns {object | null} the dialog, or null when no request is pending.
     */
    function DialogHost({ useRequest, submitRename, submitDelete, submitSessionRename, submitArchive, dismissDialog, t }) {
      const request = useRequest((value) => value)
      if (request === null || request === undefined) return null
      return h(DialogBody, {
        key: request.seq,
        request,
        submitRename,
        submitDelete,
        submitSessionRename,
        submitArchive,
        dismissDialog,
        t,
      })
    }

    /**
     * Dialog body; keyed by request so its draft state resets per request.
     * @param {object} props - request and submission callbacks.
     * @returns {object} the Host Modal element.
     */
    function DialogBody({ request, submitRename, submitDelete, submitSessionRename, submitArchive, dismissDialog, t }) {
      const workspaceRename = request.kind === 'rename'
      const sessionRename = request.kind === 'rename-session'
      const rename = workspaceRename || sessionRename
      const [value, setValue] = useState(
        workspaceRename ? request.currentTitle : sessionRename ? request.currentTitle : '',
      )
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const inputRef = useRef(null)

      useEffect(() => {
        if (inputRef.current === null) return
        inputRef.current.focus()
        inputRef.current.select()
      }, [])

      const title = request.kind === 'delete'
        ? t('dialog.delete.title')
        : request.kind === 'archive-session'
          ? t('archive.confirm.title')
          : sessionRename ? t('rename.session.title') : t('dialog.rename.title')
      const confirmLabel = request.kind === 'delete'
        ? t('dialog.delete.confirm')
        : request.kind === 'archive-session'
          ? t('archive.confirm.action')
          : t('dialog.rename.confirm')

      const close = () => { if (!busy) dismissDialog() }

      const submit = () => {
        if (busy) return
        if (rename && value.trim() === '') return
        setBusy(true)
        setError(null)
        const operation = workspaceRename
          ? submitRename(request.workspaceId, value.trim())
          : sessionRename
            ? submitSessionRename(request.sessionId, value.trim())
            : request.kind === 'delete'
              ? submitDelete(request.workspaceId)
              : submitArchive(request.sessionId)
        Promise.resolve(operation).then(() => {
          dismissDialog()
        }).catch((failure) => {
          setBusy(false)
          const key = request.kind === 'delete'
            ? 'dialog.delete.error'
            : request.kind === 'archive-session'
              ? 'dialog.archiveError'
              : sessionRename ? 'dialog.renameSession.error' : 'dialog.rename.error'
          setError(t(key, { message: messageOf(failure) }))
        })
      }

      const activity = Array.isArray(request.activity) ? request.activity : []
      const activityLabels = activity.map((item) => {
        if (item?.kind === 'turn') return t('archive.confirm.turn')
        const count = Array.isArray(item?.labels) ? item.labels.length : 1
        const names = Array.isArray(item?.labels) ? item.labels.join(t('archive.confirm.listSeparator')) : ''
        if (item?.kind === 'subagent') return t('archive.confirm.subagents', { n: count, names })
        if (item?.kind === 'job') return t('archive.confirm.jobs', { n: count, names })
        if (item?.kind === 'schedule') return t('archive.confirm.schedules', { n: count, names })
        return t('archive.confirm.other', { n: count, kind: String(item?.kind ?? '') })
      })

      let body
      if (rename) {
        body = h('label', { className: 'dshss-dialogField' },
          h('span', { className: 'dshss-dialogLabel' }, sessionRename ? t('field.sessionName') : t('dialog.rename.label')),
          h('input', {
            ref: inputRef,
            className: 'dshss-input',
            type: 'text',
            value,
            maxLength: 200,
            spellCheck: false,
            onChange: (event) => { setValue(event.target.value) },
            onKeyDown: (event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              submit()
            },
          }))
      } else if (request.kind === 'delete') {
        body = h('p', { className: 'dshss-dialogText' }, t('dialog.delete.body', { name: request.title }))
      } else {
        body = h('div', { className: 'dshss-dialogContent' },
          h('p', { className: 'dshss-dialogText' }, t('archive.confirm.desc', { title: request.title })),
          activityLabels.length === 0 ? null : h('ul', { className: 'dshss-activityList' },
            activityLabels.map((label, index) => h('li', { key: index }, label))))
      }

      const footer = h('div', { className: 'dshss-dialogFooter' },
        h(Button, { variant: 'ghost', onClick: close, disabled: busy }, t('dialog.cancel')),
        h(Button, {
          variant: 'primary',
          onClick: submit,
          disabled: busy || (rename && value.trim() === ''),
        }, confirmLabel))

      return h(Modal, {
        open: true,
        title,
        closeLabel: t('dialog.close'),
        onClose: close,
        footer,
      },
      h('div', { className: 'dshss-dialogContent' },
        body,
        error === null ? null : h('p', { className: 'dshss-dialogError', role: 'alert' }, error)))
    }

    // ---------------------------------------------------------------------
    // Plugin body
    // ---------------------------------------------------------------------

    /**
     * Apply the Client half: dictionaries, the replacement browser, and the
     * dialog overlay registration.
     * @param {object} ctx - Client root context.
     */
    function apply(ctx) {
      const uiWorkspace = ctx.get('uiWorkspace')
      const workspaces = ctx.get('workspaces')
      const sessions = ctx.get('sessions')
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'sidebar-sections: dictionaries',
      )

      // Dialog requests cross the sidebar and overlay registrations as one
      // bare observable; the overlay renders `useRequest` from it.
      const dialogRequest = createSnapshotStore(null)
      let dialogSeq = 0
      const requestDialog = (request) => {
        dialogSeq += 1
        dialogRequest.set({ ...request, seq: dialogSeq })
      }

      /** Recover the Host's activity list from a stop-and-archive refusal. The
       * shared contract is the error name plus the RPC code; error-class
       * identity is not shared across plugin bundles. */
      const refusalActivity = (error) => {
        if (error?.name !== 'WorkspaceArchiveError') return undefined
        if (error.rpcError?.code !== 'workspace/session-active') return undefined
        return Array.isArray(error.rpcError.details?.activity) ? error.rpcError.details.activity : []
      }

      const actions = {
        openSession: (sessionId) => { uiWorkspace.openSession(sessionId) },
        startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId) },
        pinSession: (sessionId) => uiWorkspace.pinSession(sessionId),
        unpinSession: (sessionId) => uiWorkspace.unpinSession(sessionId),
        /** Archive directly; running work asks the Host for a stop-and-archive dialog. */
        archiveSession: async (sessionId, displayTitle) => {
          try {
            await uiWorkspace.archiveSession(sessionId)
          } catch (error) {
            const activity = refusalActivity(error)
            if (activity === undefined) throw error
            requestDialog({ kind: 'archive-session', sessionId, title: displayTitle, activity })
          }
        },
        unarchiveSession: (sessionId) => uiWorkspace.unarchiveSession(sessionId),
        moveSessionBefore: (workspaceId, sessionId, beforeSessionId) => (
          workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
        ),
        forkSession: (sessionId) => uiWorkspace.forkSession(sessionId, undefined, { allowMigration: false }),
        copySessionId: (sessionId) => writeClipboard(sessionId),
        addWorkspace: async () => {
          const path = await uiWorkspace.pickDirectory()
          if (path === null) return
          const workspace = await workspaces.create({ path })
          uiWorkspace.startSession(workspace.workspaceId)
        },
        requestSessionRename: (sessionId, currentTitle) => {
          requestDialog({ kind: 'rename-session', sessionId, currentTitle })
        },
        renameWorkspace: (workspaceId, currentTitle) => {
          requestDialog({ kind: 'rename', workspaceId, currentTitle })
        },
        deleteWorkspace: (workspaceId, title) => {
          requestDialog({ kind: 'delete', workspaceId, title })
        },
      }

      ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
        name: 'sidebar.workspaces',
        priority: SLOT_PRIORITY,
        locale: NS,
        registrant: 'dsh-sidebar-sections',
        inject: () => ({ actions }),
      }, Browser))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'sidebar-sections.dialog',
        locale: NS,
        inject: () => ({
          hooks: { request: dialogRequest },
          submitRename: (workspaceId, title) => workspaces.rename(workspaceId, title),
          submitDelete: (workspaceId) => workspaces.delete(workspaceId),
          submitSessionRename: async (sessionId, title) => {
            await sessions.using(
              sessionId,
              { source: 'workspaceOperation' },
              (reference) => reference.binding.session.rename(title),
            )
          },
          submitArchive: (sessionId) => uiWorkspace.archiveSession(sessionId, { stopActivity: true }),
          dismissDialog: () => { dialogRequest.set(null) },
        }),
      }, DialogHost))
    }

    return {
      /** Services this Client plugin waits for before applying. */
      inject: ['slots', 'locale', 'uiWorkspace', 'workspaces', 'sessions'],
      apply,
    }
  },
})
