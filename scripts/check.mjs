#!/usr/bin/env node
/**
 * Verification suite for dsh-sidebar-sections.
 *
 * Zero-dependency: runs with plain Node, no package install and no build step.
 *
 *   1. Package surface: manifest, exports, bundle patch, locale display
 *      metadata, icon bounds, platform-only `require`s, and the reuse rule that
 *      forbids hand-copied SVG path data (all glyphs come from the Host's
 *      `ui-primitives` module-table row).
 *   2. Module contract: `client.js` registers itself under the package name and
 *      its factory returns a Cordis plugin with the expected service list.
 *   3. Registrations: one winning `sidebar.workspaces` replacement and one
 *      `shell.overlay` dialog, with a complete bilingual dictionary.
 *   4. Behavior: the real component functions are driven through a miniature
 *      React/hooks runtime with a fake `ui-primitives` module; the suite covers
 *      section derivation, pin/unpin, archive/unarchive, the full session row
 *      menu (rename/fork/archive/copy ID), archived filtering, project actions,
 *      filter + Escape, collapse persistence, rail mode, and dialog submission.
 *
 * Run: node scripts/check.mjs
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

/**
 * Record one check.
 * @param {string} name - check name.
 * @param {() => void | Promise<void>} run - assertion body.
 * @returns {Promise<void>} completion.
 */
async function check(name, run) {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`FAIL ${name}\n     ${error.message}\n${error.stack?.split('\n').slice(1, 6).join('\n')}`)
  }
}

/**
 * Assert a condition.
 * @param {unknown} condition - value expected to be truthy.
 * @param {string} message - failure message.
 */
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

/**
 * Assert deep JSON equality.
 * @param {unknown} actual - observed value.
 * @param {unknown} expected - expected value.
 * @param {string} message - failure prefix.
 */
function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`)
}

/** Await one macrotask so promise chains settle. */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 0) })

// ---------------------------------------------------------------------------
// 1. Package surface
// ---------------------------------------------------------------------------

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const clientSource = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

await check('manifest identity and client/bundle declarations', () => {
  assertEqual(manifest.name, 'dsh-sidebar-sections', 'package name')
  assert(manifest.private === true, 'package stays private')
  assertEqual(manifest.type, 'module', 'module type')
  assertEqual(manifest.dsh?.bundle?.patch, './cordis.patch.yml', 'bundle patch')
  assertEqual(manifest.dsh?.client?.platform, 'web', 'client platform')
  assertEqual(manifest.exports?.['.'], './index.js', 'root export')
  assertEqual(manifest.exports?.['./client'], './client.js', 'client export')
  assertEqual(manifest.exports?.['./icon'], './icon.svg', 'icon export')
  assertEqual(manifest.exports?.['./locale/*.json'], './locale/*.json', 'locale export')
})

await check('every shipped file exists and is listed', () => {
  const targets = [
    manifest.exports['.'], manifest.exports['./client'], manifest.exports['./icon'],
    path.join('locale', 'en.json'), path.join('locale', 'zh.json'), manifest.dsh.bundle.patch,
  ]
  for (const target of targets) assert(fs.existsSync(path.join(ROOT, target)), `missing ${target}`)
  for (const entry of manifest.files) {
    if (entry.includes('*')) continue
    assert(fs.existsSync(path.join(ROOT, entry)), `files entry ${entry} missing`)
  }
})

await check('bundle patch inserts the package row', () => {
  const patch = fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8')
  assert(/^- insert:/m.test(patch), 'patch must use insert')
  assert(patch.includes(`name: '${manifest.name}'`), 'patch module name')
  assert(patch.includes('id: sidebar-sections'), 'patch row id')
  assert(!patch.includes('\t'), 'patch must not contain tabs')
})

await check('plugin-manager display metadata is localized', () => {
  for (const [locale, file] of [['en', 'en.json'], ['zh', 'zh.json']]) {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', file), 'utf8'))
    for (const field of ['title', 'description']) {
      assert(typeof dict.meta?.[field] === 'string' && dict.meta[field].trim() !== '',
        `${locale} meta.${field} must be non-empty`)
    }
  }
})

await check('icon is a bounded, complete SVG', () => {
  const file = path.join(ROOT, 'icon.svg')
  const svg = fs.readFileSync(file, 'utf8')
  assert(fs.statSync(file).size <= 256 * 1024, 'icon over 256 KiB')
  assert(svg.trimStart().startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), 'icon must be SVG')
})

await check('client.js parses and requires only platform modules', () => {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, 'client.js')], { encoding: 'utf8' })
  assertEqual(result.status, 0, `node --check: ${result.stderr || result.stdout}`)
  const allowed = new Set(['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-store'])
  const requests = [...clientSource.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
  assert(requests.length > 0, 'expected requires')
  for (const request of requests) assert(allowed.has(request), `unexpected runtime import "${request}"`)
})

await check('glyphs and controls are reused from ui-primitives', () => {
  assert(clientSource.includes("require('@deepseek-ai/dsh-client-ui-primitives')"), 'primitives required')
  assert(!/const svgProps\s*=/.test(clientSource), 'hand-written SVG helper must not exist')
  assert(!/d:\s*['"]M[0-9]/.test(clientSource), 'no inline hand-copied SVG path data')
  for (const primitive of ['Menu', 'MenuItemButton', 'Tooltip', 'StateDot', 'Button', 'Modal', 'writeClipboard', 'relativeTime']) {
    assert(new RegExp(`\\b${primitive},`).test(clientSource), `expected primitives.${primitive} usage`)
  }
  for (const icon of ['IconPinOutlineRegular', 'IconArchiveOutlineRegular', 'IconEllipsisOutlineRegular', 'IconNewChatOutlineRegular', 'IconChevronDownOutlineRegular']) {
    assert(clientSource.includes(icon), `expected ${icon} reuse`)
  }
})

await check('stylesheet uses theme tokens, not literal colors', () => {
  const cssStart = clientSource.indexOf('const CSS = `')
  const cssEnd = clientSource.indexOf('\n`', cssStart)
  assert(cssStart !== -1 && cssEnd !== -1, 'stylesheet not found')
  const css = clientSource.slice(cssStart, cssEnd)
  assertEqual([...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((match) => match[0]), [], 'literal colors')
  assert(css.includes('var(--dsw-'), 'theme tokens required')
})

// ---------------------------------------------------------------------------
// 2. Mini React, fake primitives, fake services
// ---------------------------------------------------------------------------

/** Icon components imported by the plugin (placeholders in the fake module). */
const ICON_NAMES = [
  'IconArchiveCheckOutlineRegular', 'IconArchiveOffOutlineRegular', 'IconArchiveOutlineRegular',
  'IconBranchOutlineRegular', 'IconChevronDownOutlineRegular', 'IconCloseFillRegular', 'IconCopyOutlineRegular', 'IconEditOutlineRegular',
  'IconEllipsisOutlineRegular', 'IconFolderCloseRegular', 'IconFolderOpenRegular',
  'IconNewChatOutlineRegular', 'IconPinFillRegular', 'IconPinOutlineRegular',
  'IconProjectAddOutlineRegular', 'IconQueueOutlineRegular', 'IconSearchOutlineRegular',
  'IconSlidersTwoOutlineRegular', 'IconTrashOutlineRegular', 'IconTriangleRightFillRegular',
  'IconUnarchiveOutlineRegular',
]

/**
 * Minimal React stand-in with state/effects/memo/ref.
 * @returns {object} fake React namespace and render-loop seats.
 */
function createFakeReact() {
  const hooks = []
  let cursor = 0
  let dirty = false
  let effects = []

  const depsEqual = (left, right) => {
    if (left === undefined || right === undefined) return false
    if (left.length !== right.length) return false
    return left.every((value, index) => Object.is(value, right[index]))
  }

  const react = {
    createElement(type, props, ...children) {
      const merged = { ...(props ?? {}) }
      const flat = []
      const push = (child) => {
        if (child === null || child === undefined || typeof child === 'boolean') return
        if (Array.isArray(child)) {
          for (const value of child) push(value)
          return
        }
        flat.push(child)
      }
      for (const child of children) push(child)
      if (flat.length === 1) merged.children = flat[0]
      else if (flat.length > 1) merged.children = flat
      return { type, props: merged }
    },
    useState(initial) {
      const index = cursor
      cursor += 1
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      const setState = (next) => {
        const value = typeof next === 'function' ? next(hooks[index]) : next
        if (Object.is(value, hooks[index])) return
        hooks[index] = value
        dirty = true
      }
      return [hooks[index], setState]
    },
    useMemo(factory, deps) {
      const index = cursor
      cursor += 1
      const previous = hooks[index]
      if (previous !== undefined && previous !== null && previous.deps !== undefined
        && depsEqual(previous.deps, deps)) return previous.value
      const value = factory()
      hooks[index] = { value, deps }
      return value
    },
    useRef(initial) {
      const index = cursor
      cursor += 1
      if (!(index in hooks)) hooks[index] = { current: initial }
      return hooks[index]
    },
    useEffect(effect, deps) {
      const index = cursor
      cursor += 1
      const previous = hooks[index]
      if (previous !== undefined && previous !== null && previous.deps !== undefined
        && depsEqual(previous.deps, deps)) return
      hooks[index] = { deps }
      effects.push(effect)
    },
    Fragment: Symbol('Fragment'),
  }

  return {
    react,
    begin() {
      cursor = 0
      dirty = false
      effects = []
    },
    end() {
      const queued = effects
      effects = []
      for (const effect of queued) effect()
      return queued.length
    },
    isDirty: () => dirty,
  }
}

/** Fake browser window with in-memory localStorage. */
function createFakeWindow() {
  const storage = new Map()
  return {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => { storage.set(key, String(value)) },
      removeItem: (key) => { storage.delete(key) },
    },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    innerWidth: 1440,
    innerHeight: 900,
  }
}

/** Deterministic relative-time stand-in (tests do not assert labels). */
function fakeRelativeTime() {
  return { unit: 'now', n: 0 }
}

/**
 * Fake ui-primitives module: host-shaped controls, icons, clipboard, time.
 * @param {object} reactRuntime - fake React runtime.
 * @returns {object} primitives stand-in.
 */
function createFakePrimitives(reactRuntime) {
  const h = reactRuntime.react.createElement
  const clipboard = { calls: [], result: true }

  function StateDot({ state }) {
    return h('span', { 'data-state-dot': state, 'aria-hidden': 'true' })
  }
  function Tooltip({ children }) {
    return children ?? null
  }
  function Menu({ open, anchor, items, children, selectedIds, onSelect }) {
    const rows = []
    if (open && items !== undefined) {
      for (const item of items) {
        if (item.type === 'separator') continue
        if (item.type === 'label') {
          rows.push(h('div', { key: item.id, role: 'presentation', 'data-menu-label': item.text }, item.text))
          continue
        }
        rows.push(h('button', {
          key: item.id,
          type: 'button',
          role: 'menuitem',
          'aria-checked': selectedIds?.includes(item.id) === true ? 'true' : undefined,
          onClick: () => onSelect?.(item.id),
        }, item.icon ?? null, item.label))
      }
    }
    return h('div', { 'data-menu': open ? 'open' : 'closed' },
      anchor ?? null,
      open ? h('div', { role: 'menu' }, children ?? rows) : null)
  }
  function MenuItemButton({ children, icon, onSelect, disabled, separatorBefore }) {
    return h('button', {
      type: 'button',
      role: 'menuitem',
      disabled,
      'data-separator-before': separatorBefore === true ? 'true' : undefined,
      onClick: onSelect,
    }, icon ?? null, children)
  }
  function Modal({ open, title, children, footer }) {
    return open
      ? h('div', { role: 'dialog', 'aria-label': title }, h('h2', null, title), children, footer)
      : null
  }
  function Button({ children, onClick, disabled, variant }) {
    return h('button', { type: 'button', 'data-variant': variant, disabled, onClick }, children)
  }
  async function writeClipboard(textToCopy) {
    clipboard.calls.push(textToCopy)
    return clipboard.result
  }

  const primitives = {
    StateDot,
    Tooltip,
    Menu,
    MenuItemButton,
    Modal,
    Button,
    writeClipboard,
    relativeTime: fakeRelativeTime,
    __clipboard: clipboard,
  }
  for (const name of ICON_NAMES) {
    primitives[name] = (props = {}) => h('svg', {
      'data-icon': name,
      width: props.size ?? 16,
      height: props.size ?? 16,
      'aria-hidden': 'true',
    })
  }
  return primitives
}

/**
 * Load client.js against fake modules.
 * @param {object} reactRuntime - fake React module.
 * @param {object} primitives - fake ui-primitives.
 * @param {object} browserWindow - fake window.
 * @returns {{registration: object, plugin: object}} captured module and plugin.
 */
function loadClientModule(reactRuntime, primitives, browserWindow) {
  const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
  let captured = null
  const sandbox = {
    window: { ...browserWindow, __ModuleLoader__: { load(registration) { captured = registration } } },
    document: { body: {} },
    console,
    Date, JSON, Math, Promise, Set, Map, Symbol, Object, Array, String, Number, Boolean,
  }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert(captured !== null, 'client.js never called __ModuleLoader__.load')
  const store = {
    createSnapshotStore: (initial) => {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot: () => value,
        subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
        set: (next) => { value = next; for (const listener of listeners) listener() },
      }
    },
  }
  const requireStub = (request) => {
    if (request === 'react') return reactRuntime.react
    if (request === 'react-dom') return { createPortal: (element) => element }
    if (request === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    if (request === '@deepseek-ai/dsh-client-store') return store
    throw new Error(`unexpected require("${request}")`)
  }
  return { registration: captured, plugin: captured.factory(requireStub) }
}

/**
 * Build fake services and apply the plugin once.
 * @returns {object} spies, registrations and runtime pieces.
 */
function applyPlugin() {
  const reactRuntime = createFakeReact()
  const primitives = createFakePrimitives(reactRuntime)
  const browserWindow = createFakeWindow()
  const calls = []
  const services = {
    uiWorkspace: {
      openSession: (id) => calls.push(['openSession', id]),
      startSession: (id) => calls.push(['startSession', id]),
      pinSession: (id) => { calls.push(['pinSession', id]); return Promise.resolve() },
      unpinSession: (id) => { calls.push(['unpinSession', id]); return Promise.resolve() },
      archiveSession: (id, options) => {
        calls.push(['archiveSession', id, options?.stopActivity === true])
        return services.uiWorkspace.__archiveHandler(id, options)
      },
      unarchiveSession: (id) => { calls.push(['unarchiveSession', id]); return Promise.resolve() },
      forkSession: (id) => { calls.push(['forkSession', id]); return Promise.resolve('child') },
      pickDirectory: () => { calls.push(['pickDirectory']); return Promise.resolve('D:\\new') },
      __archiveHandler: () => Promise.resolve(),
    },
    workspaces: {
      create: (input) => { calls.push(['createWorkspace', input.path]); return Promise.resolve({ workspaceId: 'w3' }) },
      rename: (id, title) => { calls.push(['renameWorkspace', id, title]); return Promise.resolve({}) },
      delete: (id) => { calls.push(['deleteWorkspace', id]); return Promise.resolve() },
      insertSessionBefore: (workspaceId, sessionId, beforeSessionId) => {
        calls.push(['insertSessionBefore', workspaceId, sessionId, beforeSessionId])
        return Promise.resolve({})
      },
    },
    sessions: {
      using: async (id, options, callback) => {
        calls.push(['using', id, options.source])
        return callback({
          binding: {
            session: {
              rename: (title) => { calls.push(['renameSession', id, title]); return Promise.resolve() },
            },
          },
        })
      },
    },
  }
  const registrations = []
  const localeRegistrations = []
  const ctx = {
    effect: (fn) => { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
    get: (name) => services[name],
    locale: {
      register: (ns, dicts) => {
        localeRegistrations.push({ ns, dicts })
        return () => {}
      },
    },
    slots: {
      inject: (_slot, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }
  const { plugin } = loadClientModule(reactRuntime, primitives, browserWindow)
  plugin.apply(ctx)
  return { calls, services, registrations, localeRegistrations, reactRuntime, primitives, browserWindow }
}

// ---------------------------------------------------------------------------
// 3. Fixtures, translator and render harness
// ---------------------------------------------------------------------------

const NOW = Date.now()

/** Session list fixture covering every visibility rule. */
function createSessionList() {
  return {
    ids: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
    byId: {
      s1: { id: 's1', title: 'Pinned talk', running: true, retainedBy: {}, blank: false, updatedAt: NOW - 2 * 60_000 },
      s2: { id: 's2', title: 'Alpha talk', running: false, retainedBy: {}, blank: false, updatedAt: NOW - 3 * 60_000 },
      s3: { id: 's3', title: 'Beta old talk', running: false, retainedBy: {}, blank: false, updatedAt: NOW - 4 * 3_600_000 },
      s4: { id: 's4', title: 'Archived talk', running: false, retainedBy: {}, blank: false, updatedAt: NOW - 5 * 60_000 },
      s5: { id: 's5', title: 'Subagent talk', origin: 'subagent', running: false, retainedBy: {}, blank: false, updatedAt: NOW - 6 * 60_000 },
      s6: { id: 's6', title: '', running: false, retainedBy: { mainView: 1 }, blank: true, updatedAt: NOW - 7 * 60_000 },
      s7: { id: 's7', title: '', running: false, retainedBy: {}, blank: true, updatedAt: NOW - 8 * 60_000 },
      s8: { id: 's8', title: 'Loose talk', running: false, retainedBy: {}, blank: false, updatedAt: NOW - 10 * 60_000, cwd: 'D:\\loose' },
    },
    phase: 'ready',
    projectionsBySession: {},
  }
}

/** Workspace snapshot fixture. */
function createWorkspaceSnapshot() {
  const stamp = new Date(NOW).toISOString()
  return {
    items: [
      { workspaceId: 'w1', path: 'D:\\alpha', title: 'Alpha project', sessionIds: ['s1', 's2', 's4', 's7'], createdAt: stamp, updatedAt: stamp },
      { workspaceId: 'w2', path: 'D:\\beta', title: 'Beta project', sessionIds: ['s3', 's5', 's6'], createdAt: stamp, updatedAt: stamp },
    ],
    archivedSessionIds: ['s4'],
    pinnedSessionIds: ['s1'],
    state: 'idle',
    phase: 'ready',
    error: null,
  }
}

/** Unified status fixture. */
function createStatusMap() {
  return new Map([
    ['s1', { running: true, pendingInteraction: undefined, completionUnread: false }],
    ['s2', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
    ['s3', { running: false, pendingInteraction: undefined, completionUnread: true }],
  ])
}

/**
 * Translate one dictionary key with `{name}` placeholders.
 * @param {Record<string, string>} dict - locale dictionary.
 * @returns {(key: string, params?: object) => string} translate seat.
 */
function translator(dict) {
  return (key, params) => {
    const template = dict[key]
    assert(template !== undefined, `missing locale key "${key}"`)
    if (params === undefined) return template
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
  }
}

/** Flatten a rendered tree into host elements. */
function flatten(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') return out
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out)
    return out
  }
  out.push(node)
  flatten(node.children, out)
  return out
}

/** Concatenated text content. */
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.children)
}

/** All host elements matching a predicate. */
function findAll(tree, predicate) {
  return flatten(tree).filter(predicate)
}

/** Exactly one host element matching a predicate. */
function findOne(tree, predicate) {
  const matches = findAll(tree, predicate)
  assert(matches.length === 1, `expected one match, found ${matches.length}`)
  return matches[0]
}

/**
 * Render one component through the mini runtime.
 * @param {Function} component - component function.
 * @param {object} props - initial props.
 * @param {object} reactRuntime - fake React module.
 * @returns {object} harness with tree/rerender/setProps.
 */
function mountComponent(component, props, reactRuntime) {
  let currentProps = props
  let tree = null
  const renderTree = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return null
    if (typeof node === 'string' || typeof node === 'number') return node
    if (Array.isArray(node)) return node.map(renderTree)
    const { type, props: elementProps } = node
    if (typeof type === 'function') return renderTree(type(elementProps))
    const next = { type, props: elementProps, children: [] }
    const children = elementProps.children
    if (Array.isArray(children)) next.children = children.map(renderTree)
    else if (children !== undefined) next.children = renderTree(children)
    return next
  }
  const rerender = () => {
    for (let pass = 0; pass < 8; pass += 1) {
      reactRuntime.begin()
      tree = renderTree(component(currentProps))
      const ran = reactRuntime.end()
      if (!reactRuntime.isDirty() && ran === 0) break
    }
    return tree
  }
  rerender()
  return {
    get tree() { return tree },
    rerender,
    setProps(patch) {
      currentProps = { ...currentProps, ...patch }
      return rerender()
    },
  }
}

/** Invoke an element handler and rerender. */
function dispatch(harness, element, handler, event) {
  const fn = element.props?.[handler]
  assert(typeof fn === 'function', `element is missing ${handler}`)
  fn(event)
  harness.rerender()
}

/** Synthetic event with the extra facts some handlers read. */
function syntheticEvent(overrides = {}) {
  return {
    stopPropagation() {},
    preventDefault() {},
    currentTarget: {
      getBoundingClientRect: () => ({ left: 220, right: 250, top: 300, bottom: 314, width: 30, height: 14 }),
    },
    target: { value: '' },
    ...overrides,
  }
}

/**
 * Build a mounted browser scenario.
 * @param {object} overrides - prop overrides.
 * @returns {object} scenario.
 */
function scenario(overrides = {}) {
  const applyResult = applyPlugin()
  const { calls, registrations, localeRegistrations, reactRuntime, primitives, browserWindow } = applyResult
  const t = translator(localeRegistrations[0].dicts.zh)
  const section = registrations.find((entry) => entry.options.name === 'sidebar.workspaces')
  const props = {
    wide: true,
    expandSidebar: () => { calls.push(['expandSidebar']) },
    useSessions: (selector) => selector(createSessionList()),
    useWorkspaces: (selector) => selector(createWorkspaceSnapshot()),
    useSessionStatus: (selector) => selector(createStatusMap()),
    usePanelInfo: (selector) => selector({ activePanelId: null }),
    t,
    ...section.options.inject(),
    ...overrides,
  }
  const harness = mountComponent(section.component, props, reactRuntime)
  return { ...applyResult, harness, calls, t, props }
}

/** @returns {boolean} whether an element is a conversation row. */
const isSessionRow = (element) => element.props?.className?.split(' ')[0] === 'dshss-row'
/** @returns {boolean} whether an element is a project header row. */
const isProjectRow = (element) => element.props?.className?.split(' ')[0] === 'dshss-projectRow'
/** @returns {boolean} whether an element is a button with an accessible name. */
const isButton = (element) => element.type === 'button' && typeof element.props?.['aria-label'] === 'string'

/** Row title text. */
function rowTitle(row) {
  return textOf(findOne(row, (element) => element.props?.className === 'dshss-title'))
}

/** Find a conversation row by accessible label. */
function findAllSessionRows(tree, title) {
  return findAll(tree, (element) => isSessionRow(element) && rowTitle(element) === title)
}

function findSessionRow(tree, t, title) {
  const expected = t('session.open', { title })
  const rows = findAll(tree, (element) => isSessionRow(element) && element.props['aria-label'] === expected)
  assert(rows.length >= 1, `no conversation row "${expected}"`)
  return rows[0]
}

/** Find the button with one localized accessible label. */
function findButton(root, t, key, params) {
  const expected = t(key, params)
  const buttons = findAll(root, (element) => isButton(element) && element.props['aria-label'] === expected)
  assert(buttons.length >= 1, `no button "${expected}"`)
  return buttons[0]
}

/** Find a rendered section by heading label. */
function findSection(tree, t, key) {
  return findOne(tree, (element) => element.type === 'section' && element.props['aria-label'] === t(key))
}

/** Open a section overflow menu and choose one archived-filter row. */
function openSectionMenu(harness, t, key) {
  const section = findSection(harness.tree, t, key)
  dispatch(harness, findButton(section, t, 'section.menu', { name: t(key) }), 'onClick', syntheticEvent())
  const fresh = findSection(harness.tree, t, key)
  const menu = findOne(fresh, (element) => element.props?.role === 'menu')
  const labels = findAll(menu, (element) => element.type === 'button').map(textOf)
  return { section: fresh, menu, labels }
}

/** Click one item in the currently opened section menu. */
function pickSectionItem(harness, t, key, label) {
  const section = findSection(harness.tree, t, key)
  const menu = findOne(section, (element) => element.props?.role === 'menu')
  findOne(menu, (element) => element.type === 'button' && textOf(element) === label).props.onClick()
  harness.rerender()
}

/** Find menu items under one row/group element. */
function menuItems(root) {
  return findAll(root, (element) => element.props?.role === 'menuitem')
}

// ---------------------------------------------------------------------------
// 4. Module contract
// ---------------------------------------------------------------------------

await check('factory returns a Cordis plugin with the required services', () => {
  const reactRuntime = createFakeReact()
  const { registration, plugin } = loadClientModule(reactRuntime, createFakePrimitives(reactRuntime), createFakeWindow())
  assertEqual(registration.id, manifest.name, 'module id')
  assertEqual(plugin.inject.slice().sort(), ['locale', 'sessions', 'slots', 'uiWorkspace', 'workspaces'], 'inject list')
  assert(typeof plugin.apply === 'function', 'apply')
})

await check('apply registers the browser and the dialog overlay', () => {
  const { registrations, localeRegistrations } = applyPlugin()
  const section = registrations.find((entry) => entry.options.name === 'sidebar.workspaces')
  assert(section !== undefined, 'browser registration missing')
  assert(section.options.priority < 0, 'browser must win the slot priority')
  assertEqual(section.options.locale, 'sidebarSections', 'locale namespace')
  const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay')
  assert(overlay !== undefined, 'overlay registration missing')
  assertEqual(overlay.options.id, 'sidebar-sections.dialog', 'overlay id')
  assertEqual(localeRegistrations.length, 1, 'one locale registration')
  assertEqual(localeRegistrations[0].ns, 'sidebarSections', 'locale registration namespace')
})

await check('zh and en dictionaries carry identical non-empty keys', () => {
  const { localeRegistrations } = applyPlugin()
  const { dicts } = localeRegistrations[0]
  assertEqual(Object.keys(dicts).sort(), ['en', 'zh'], 'locales')
  assertEqual(Object.keys(dicts.en).sort(), Object.keys(dicts.zh).sort(), 'key sets')
  for (const locale of ['zh', 'en']) {
    for (const [key, value] of Object.entries(dicts[locale])) {
      assert(typeof value === 'string' && value.trim() !== '', `${locale}.${key} empty`)
    }
  }
})

// ---------------------------------------------------------------------------
// 5. Rendering behavior
// ---------------------------------------------------------------------------

await check('renders the four section headings', () => {
  const { harness, t } = scenario()
  assertEqual(findAll(harness.tree, (element) => element.type === 'h2').map(textOf),
    [t('section.pinned'), t('section.projects'), t('section.recent'), t('section.archived')], 'headings')
})

await check('pinned section projects the pin set with the shipped row UI', () => {
  const { harness, t } = scenario()
  const row = findSessionRow(harness.tree, t, 'Pinned talk')
  findButton(row, t, 'actions.unpin')
  const marker = findOne(row, (element) => element.props?.className === 'dshss-pinMark')
  assertEqual(marker.props['aria-label'], t('session.pinned'), 'pin marker')
  // Conversation rows keep the shipped UI: status, title, time, actions — no
  // project label on the row.
  assertEqual(findAll(row, (element) => element.props?.className === 'dshss-badge').length, 0, 'no row badge')
})

await check('projects nest each workspace and hide archived/subagent/blank rows', () => {
  const { harness, t } = scenario()
  assertEqual(findAll(harness.tree, isProjectRow).map((row) => row.props['aria-label']),
    ['Alpha project', 'Beta project', t('project.ungrouped')], 'project groups')
  const titles = [...new Set(findAll(harness.tree, isSessionRow).map(rowTitle))].sort()
  assertEqual(titles, ['Alpha talk', 'Archived talk', 'Beta old talk', 'Loose talk', 'Pinned talk', t('session.new')].sort(), 'visible rows')
})

await check('recent is recency-ordered and every row keeps the shipped UI', () => {
  const { harness, t } = scenario()
  const recent = findSection(harness.tree, t, 'section.recent')
  assertEqual(findAll(recent, isSessionRow).map(rowTitle), ['Alpha talk', 'Loose talk', 'Beta old talk'], 'recent order')
  assertEqual(findAll(harness.tree, (element) => element.props?.className === 'dshss-badge').length, 0, 'no row badges anywhere')
})

await check('active rows expose pin/archive, archived rows expose unarchive', () => {
  const { harness, t } = scenario()
  for (const row of findAll(harness.tree, isSessionRow)) {
    if (rowTitle(row) === t('session.new')) continue
    if (row.props.className.includes('dshss-archived')) {
      findButton(row, t, 'actions.unarchive')
      assertEqual(findAll(row, (element) => isButton(element) && element.props['aria-label'] === t('actions.pin')).length, 0,
        'archived row has no pin action')
      continue
    }
    findButton(row, t, rowTitle(row) === 'Pinned talk' ? 'actions.unpin' : 'actions.pin')
    findButton(row, t, 'actions.archive')
  }
})

// ---------------------------------------------------------------------------
// 6. Actions
// ---------------------------------------------------------------------------

await check('pin and unpin dispatch the Host actions', () => {
  const { harness, t, calls } = scenario()
  const alpha = findSessionRow(harness.tree, t, 'Alpha talk')
  dispatch(harness, findButton(alpha, t, 'actions.pin'), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['pinSession', 's2'], 'pin')
  const pinned = findSessionRow(harness.tree, t, 'Pinned talk')
  dispatch(harness, findButton(pinned, t, 'actions.unpin'), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['unpinSession', 's1'], 'unpin')
})

await check('archive dispatches and a refusal requests the stop-and-archive dialog', async () => {
  const { harness, t, calls, services, registrations } = scenario()
  const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay')
  const request = overlay.options.inject().hooks.request
  dispatch(harness, findButton(findSessionRow(harness.tree, t, 'Alpha talk'), t, 'actions.archive'), 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-1), ['archiveSession', 's2', false], 'archive dispatched')
  services.uiWorkspace.__archiveHandler = () => {
    const error = new Error('session is active')
    error.name = 'WorkspaceArchiveError'
    error.rpcError = { code: 'workspace/session-active', details: { activity: [{ kind: 'turn' }] } }
    return Promise.reject(error)
  }
  dispatch(harness, findButton(findSessionRow(harness.tree, t, 'Alpha talk'), t, 'actions.archive'), 'onClick', syntheticEvent())
  await settle()
  const pending = request.getSnapshot()
  assertEqual(pending.kind, 'archive-session', 'archive confirm requested')
  assertEqual(pending.sessionId, 's2', 'archive confirm target')
})

await check('archived conversations live in the Archived section only', () => {
  const { harness, t, calls } = scenario()
  const section = findSection(harness.tree, t, 'section.archived')
  const rows = findAll(section, isSessionRow)
  assertEqual(rows.map(rowTitle), ['Archived talk'], 'archived rows listed in the Archived section')
  assert(rows[0].props.className.includes('dshss-archived'), 'archived row styled')
  for (const key of ['section.projects', 'section.recent', 'section.pinned']) {
    const other = findSection(harness.tree, t, key)
    assert(!findAll(other, isSessionRow).map(rowTitle).includes('Archived talk'), key + ' excludes archived rows')
  }
  assertEqual(findAll(rows[0], (element) => isButton(element) && element.props['aria-label'] === t('actions.pin')).length, 0,
    'archived row has no pin action')
  dispatch(harness, findButton(rows[0], t, 'actions.unarchive'), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['unarchiveSession', 's4'], 'unarchive dispatched')
})

await check('Archived section shows an empty hint when nothing is archived', () => {
  const { harness, t } = scenario({
    useWorkspaces: (selector) => selector({
      items: createWorkspaceSnapshot().items,
      archivedSessionIds: [],
      pinnedSessionIds: ['s1'],
      state: 'idle',
      phase: 'ready',
      error: null,
    }),
  })
  const section = findSection(harness.tree, t, 'section.archived')
  assertEqual(findAll(section, isSessionRow).length, 0, 'no archived rows')
  assert(textOf(section).includes(t('section.archived.empty')), 'empty archive hint')
})

await check('session row menu offers pin/rename/fork/archive/copy-id and dispatches them', async () => {
  const { harness, t, calls, registrations, primitives } = scenario()
  const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay')
  const request = overlay.options.inject().hooks.request
  const openRowMenu = (title) => {
    const row = findSessionRow(harness.tree, t, title)
    const anchor = findButton(row, t, 'actions.session.aria', { name: title })
    dispatch(harness, anchor, 'onClick', syntheticEvent())
    return menuItems(findSessionRow(harness.tree, t, title))
  }

  let items = openRowMenu('Alpha talk')
  assertEqual(items.map(textOf), [
    t('menu.pinSession'), t('menu.renameSession'), t('menu.forkSession'),
    t('menu.archiveSession'), t('menu.sessionId'),
  ], 'session menu items')

  items[1].props.onClick()
  harness.rerender()
  assertEqual(request.getSnapshot().kind, 'rename-session', 'rename dialog requested')

  items = openRowMenu('Alpha talk')
  items[2].props.onClick()
  assertEqual(calls.at(-1), ['forkSession', 's2'], 'fork dispatched')

  items = openRowMenu('Alpha talk')
  items[4].props.onClick()
  await settle()
  assertEqual(primitives.__clipboard.calls.at(-1), 's2', 'session id copied')

  items = openRowMenu('Alpha talk')
  items[3].props.onClick()
  assertEqual(calls.at(-1), ['archiveSession', 's2', false], 'archive from menu')
})

await check('opening conversations and starting project sessions dispatch navigation', () => {
  const { harness, t, calls } = scenario()
  dispatch(harness, findSessionRow(harness.tree, t, 'Alpha talk'), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['openSession', 's2'], 'open')
  dispatch(harness, findButton(harness.tree, t, 'project.newSession.aria', { name: 'Alpha project' }), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['startSession', 'w1'], 'start session')
})

await check('add workspace opens the picker, adopts the path and starts a session', async () => {
  const { harness, t, calls } = scenario()
  dispatch(harness, findButton(harness.tree, t, 'toolbar.add'), 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-2), ['createWorkspace', 'D:\\new'], 'adopt path')
  assertEqual(calls.at(-1), ['startSession', 'w3'], 'start after adopt')
})

await check('project menu opens rename/delete dialog requests', () => {
  const { harness, t, registrations } = scenario()
  const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay')
  const request = overlay.options.inject().hooks.request
  const findProject = () => findOne(harness.tree, (element) => isProjectRow(element) && element.props['aria-label'] === 'Alpha project')
  dispatch(harness, findButton(findProject(), t, 'actions.workspace.aria', { name: 'Alpha project' }), 'onClick', syntheticEvent())
  const items = findAll(findOne(harness.tree, (element) => element.props?.role === 'menu'), (element) => element.type === 'button')
  assertEqual(items.map(textOf), [
    t('sort.manual'), t('sort.updated'), t('rename'), t('delete.workspace'),
  ], 'project menu items')
  items[2].props.onClick()
  assertEqual(request.getSnapshot().kind, 'rename', 'workspace rename request')
  const reopened = findAll(findOne(harness.tree, (element) => element.props?.role === 'menu'), (element) => element.type === 'button')
  reopened[3].props.onClick()
  assertEqual(request.getSnapshot().kind, 'delete', 'workspace delete request')
})

/** Fake right-click target that reports one menu owner. */
function contextTarget(kind, dataset) {
  return {
    closest(selector) {
      if (selector.includes('dshss-row[data-session]')) return kind === 'row' ? { dataset } : null
      if (selector.includes('dshss-projectRow')) return kind === 'project' ? { dataset } : null
      if (selector.includes('dshss-sectionHeader')) return kind === 'section' ? { dataset } : null
      return null
    },
  }
}

await check('right-clicking a conversation row opens its action menu', () => {
  const { harness, t, calls } = scenario()
  dispatch(harness, harness.tree, 'onContextMenu', syntheticEvent({
    target: contextTarget('row', { session: 's2' }),
    clientX: 40,
    clientY: 80,
  }))
  const menu = findOne(harness.tree, (element) => element.props?.role === 'menu')
  const items = findAll(menu, (element) => element.type === 'button')
  assertEqual(items.map(textOf), [
    t('menu.pinSession'), t('menu.renameSession'), t('menu.forkSession'), t('menu.archiveSession'), t('menu.sessionId'),
  ], 'row context menu items')
  items[3].props.onClick()
  assertEqual(calls.at(-1), ['archiveSession', 's2', false], 'context menu dispatches archive')
})

await check('right-clicking a project row opens its sort/rename menu', () => {
  const { harness, t, browserWindow } = scenario()
  dispatch(harness, harness.tree, 'onContextMenu', syntheticEvent({
    target: contextTarget('project', { workspace: 'w1' }),
    clientX: 40,
    clientY: 80,
  }))
  const menu = findOne(harness.tree, (element) => element.props?.role === 'menu')
  const items = findAll(menu, (element) => element.type === 'button')
  assertEqual(items.map(textOf), [
    t('sort.manual'), t('sort.updated'), t('rename'), t('delete.workspace'),
  ], 'project context menu items')
  items[0].props.onClick()
  const stored = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.projectSorts') ?? '{}')
  assertEqual(stored.w1, 'manual', 'project sort override persisted')
})

await check('right-clicking a section heading opens its section menu', () => {
  const { harness, t, browserWindow } = scenario()
  dispatch(harness, harness.tree, 'onContextMenu', syntheticEvent({
    target: contextTarget('section', { section: 'recent' }),
    clientX: 40,
    clientY: 80,
  }))
  const menu = findOne(harness.tree, (element) => element.props?.role === 'menu')
  const items = findAll(menu, (element) => element.type === 'button')
  assertEqual(items.map(textOf), [
    t('group.byProject'), t('group.oneList'), t('sort.manual'), t('sort.updated'),
  ], 'section context menu items')
  items[2].props.onClick()
  const views = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.sectionViews') ?? '{}')
  assertEqual(views.recent.sort, 'manual', 'section context menu persists sort')
})

await check('per-project manual sort reorders its own conversation list', () => {
  const base = createWorkspaceSnapshot()
  const stamp = base.items[0].createdAt
  const { harness, t, calls, browserWindow } = scenario({
    useWorkspaces: (selector) => selector({
      items: [{
        workspaceId: 'w1',
        path: 'D:\\alpha',
        title: 'Alpha project',
        sessionIds: ['s2', 's3'],
        createdAt: stamp,
        updatedAt: stamp,
      }],
      archivedSessionIds: ['s4'],
      pinnedSessionIds: ['s1'],
      state: 'idle',
      phase: 'ready',
      error: null,
    }),
  })
  const project = findOne(harness.tree, (element) => isProjectRow(element) && element.props['aria-label'] === 'Alpha project')
  dispatch(harness, findButton(project, t, 'actions.workspace.aria', { name: 'Alpha project' }), 'onClick', syntheticEvent())
  const menu = findOne(harness.tree, (element) => element.props?.role === 'menu')
  findOne(menu, (element) => element.type === 'button' && textOf(element) === t('sort.manual')).props.onClick()
  harness.rerender()
  const group = findOne(harness.tree, (element) => element.type === 'div'
    && element.props?.className === 'dshss-group'
    && element.props['aria-label'] === 'Alpha project')
  let rows = findAll(group, isSessionRow)
  assertEqual(rows.map(rowTitle), ['Alpha talk', 'Beta old talk'], 'manual order baseline')
  dispatch(harness, rows[0], 'onDragStart', syntheticEvent({ dataTransfer: { setData() {}, effectAllowed: '' } }))
  rows = findAll(findOne(harness.tree, (element) => element.type === 'div'
    && element.props?.className === 'dshss-group'
    && element.props['aria-label'] === 'Alpha project'), isSessionRow)
  dispatch(harness, rows[1], 'onDragOver', syntheticEvent({
    clientY: 30,
    currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 32 }) },
    dataTransfer: { dropEffect: '' },
  }))
  rows = findAll(findOne(harness.tree, (element) => element.type === 'div'
    && element.props?.className === 'dshss-group'
    && element.props['aria-label'] === 'Alpha project'), isSessionRow)
  dispatch(harness, rows[1], 'onDrop', syntheticEvent({}))
  const after = findAll(findOne(harness.tree, (element) => element.type === 'div'
    && element.props?.className === 'dshss-group'
    && element.props['aria-label'] === 'Alpha project'), isSessionRow).map(rowTitle)
  assertEqual(after, ['Beta old talk', 'Alpha talk'], 'per-project manual drag reordered')
  const order = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.manualOrder') ?? '{}')
  assertEqual(order.projects.w1, ['s3', 's2'], 'manual order persisted for the project')
  const reorderCall = calls.at(-1)
  assert(reorderCall[0] === 'insertSessionBefore' && reorderCall[1] === 'w1' && reorderCall[2] === 's2',
    'Host order write dispatched')
})

await check('local filter narrows rows and Escape clears it', () => {
  const { harness, t } = scenario()
  dispatch(harness, findButton(harness.tree, t, 'filter.label'), 'onClick', syntheticEvent())
  const input = findOne(harness.tree, (element) => element.type === 'input')
  dispatch(harness, input, 'onChange', syntheticEvent({ target: { value: 'beta' } }))
  let titles = findAll(harness.tree, isSessionRow).map(rowTitle)
  assert(titles.includes('Beta old talk'), 'match visible')
  assert(!titles.includes('Alpha talk'), 'non-match hidden')
  dispatch(harness, findOne(harness.tree, (element) => element.type === 'input'), 'onKeyDown', syntheticEvent({ key: 'Escape' }))
  titles = findAll(harness.tree, isSessionRow).map(rowTitle)
  assert(titles.includes('Alpha talk'), 'Escape restores')
})

await check('project collapse is applied and persisted browser-locally', () => {
  const { harness, t, browserWindow } = scenario()
  const alpha = findOne(harness.tree, (element) => isProjectRow(element) && element.props['aria-label'] === 'Alpha project')
  dispatch(harness, alpha, 'onClick', syntheticEvent())
  assertEqual(findAll(harness.tree, (element) => element.props?.className === 'dshss-groupSessions').length, 2, 'one group collapsed')
  const stored = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.collapsed') ?? '{}')
  assertEqual(stored, { w1: true }, 'collapse record')
})

await check('rail mode shows search and add, and search expands the sidebar', () => {
  const { harness, t, calls } = scenario({ wide: false })
  const buttons = findAll(harness.tree, isButton)
  assertEqual(buttons.map((button) => button.props['aria-label']), [t('rail.search'), t('rail.add'), t('newSession')], 'rail controls')
  dispatch(harness, buttons[0], 'onClick', syntheticEvent())
  assert(calls.some((call) => call[0] === 'expandSidebar'), 'expand requested')
  harness.setProps({ wide: true })
  assertEqual(findAll(harness.tree, (element) => element.type === 'input').length, 1, 'search opens on expand')
})

await check('search owns its own row and the standalone 工作区 label is gone', () => {
  const { harness, t } = scenario()
  const searchBar = findOne(harness.tree, (element) => element.props?.className === 'dshss-searchBar')
  assertEqual(textOf(searchBar), t('filter.placeholder'), 'search row shows the placeholder')
  assertEqual(findAll(harness.tree, (element) => textOf(element) === '工作区').length, 0, 'no standalone workspace label')
})

await check('section headers collapse and expand, remembered browser-locally', () => {
  const { harness, t, browserWindow } = scenario()
  const pinnedHeader = findOne(harness.tree, (element) => element.props?.className === 'dshss-sectionHeader'
    && element.props['aria-label'] === t('section.collapse', { name: t('section.pinned') }))
  dispatch(harness, pinnedHeader, 'onClick', syntheticEvent())
  assert(!findAll(harness.tree, isSessionRow).map(rowTitle).includes('Pinned talk'), 'pinned row hidden while collapsed')
  assertEqual(JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.collapsedSections') ?? '{}'), { pinned: true }, 'section collapse record')
  const collapsedHeader = findOne(harness.tree, (element) => element.props?.className === 'dshss-sectionHeader'
    && element.props['aria-label'] === t('section.expand', { name: t('section.pinned') }))
  dispatch(harness, collapsedHeader, 'onClick', syntheticEvent())
  assert(findAll(harness.tree, isSessionRow).map(rowTitle).includes('Pinned talk'), 'pinned row restored')
})

await check('projects section "+" adds a workspace, recents compose uses the default workspace', async () => {
  const base = createWorkspaceSnapshot()
  const stamp = new Date(NOW).toISOString()
  const { harness, t, calls } = scenario({
    useWorkspaces: (selector) => selector({
      ...base,
      items: [
        ...base.items,
        {
          workspaceId: 'w-default',
          path: 'C:\\Users\\Tian\\Documents\\deepseek-harness\\default-workspace',
          title: 'default-workspace',
          sessionIds: [],
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    }),
  })
  const projects = findSection(harness.tree, t, 'section.projects')
  dispatch(harness, findButton(projects, t, 'toolbar.add'), 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-1), ['startSession', 'w3'], 'workspace add then session start')
  const recent = findSection(harness.tree, t, 'section.recent')
  dispatch(harness, findButton(recent, t, 'newSession'), 'onClick', syntheticEvent())
  assertEqual(calls.at(-1), ['startSession', 'w-default'], 'compose targets the default workspace')
})

await check('section headings put the chevron on the right and unify the ⋯ position', () => {
  const { harness, t } = scenario()
  const pinned = findSection(harness.tree, t, 'section.pinned')
  const pinnedHeader = findOne(pinned, (element) => element.props?.className === 'dshss-sectionHeader')
  const flat = flatten(pinnedHeader)
  const titleIndex = flat.findIndex((element) => element.type === 'h2')
  const chevronIndex = flat.findIndex((element) => element.props?.['data-icon'] === 'IconChevronDownOutlineRegular')
  assert(titleIndex !== -1 && chevronIndex > titleIndex, 'chevron sits to the right of the title')
  for (const key of ['section.pinned', 'section.projects', 'section.recent']) {
    const section = findSection(harness.tree, t, key)
    const header = findOne(section, (element) => element.props?.className === 'dshss-sectionHeader')
    const labels = findAll(header, (element) => element.type === 'button' && element.props['aria-label'] !== undefined)
      .map((button) => button.props['aria-label'])
    assert(labels.at(-1) === t('section.menu', { name: t(key) }), key + ' ends with the ⋯ menu')
  }
})

await check('section overflow menus expose per-section choices', () => {
  const { harness, t, browserWindow } = scenario()
  for (const key of ['section.pinned', 'section.archived']) {
    const menu = openSectionMenu(harness, t, key)
    assert(menu.labels.includes(t('sort.manual')) && menu.labels.includes(t('sort.updated')), key + ' offers sort order')
    assert(!menu.labels.includes(t('group.byProject')), key + ' does not offer grouping')
    assert(!menu.labels.includes(t('group.label')), key + ' has no grouping section')
  }
  pickSectionItem(harness, t, 'section.archived', t('sort.updated'))
  let stored = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.sectionViews') ?? '{}')
  assertEqual(stored.archivedSort, 'updated', 'archived sort persisted')
  for (const key of ['section.projects', 'section.recent']) {
    const menu = openSectionMenu(harness, t, key)
    assert(menu.labels.includes(t('group.byProject')) && menu.labels.includes(t('group.oneList')), key + ' offers grouping')
    assert(menu.labels.includes(t('sort.manual')) && menu.labels.includes(t('sort.updated')), key + ' offers sort order')
  }
  pickSectionItem(harness, t, 'section.projects', t('sort.updated'))
  stored = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.sectionViews') ?? '{}')
  assertEqual(stored.projects.sort, 'updated', 'projects sort persisted')
})

await check('Projects menu no longer offers collapse/expand-all rows', () => {
  const { harness, t } = scenario()
  const menu = openSectionMenu(harness, t, 'section.projects')
  assertEqual(menu.labels, [
    t('group.byProject'), t('group.oneList'), t('sort.manual'), t('sort.updated'),
  ], 'projects menu items')
})

await check('project rows keep the folder icon instead of a hover chevron', () => {
  const { harness } = scenario()
  const projectRows = findAll(harness.tree, (element) => element.props?.className === 'dshss-projectRow')
  assert(projectRows.length > 0, 'project rows present')
  for (const row of projectRows) {
    const icons = findAll(row, (element) => element.props?.['data-icon'] !== undefined)
      .map((element) => element.props['data-icon'])
    assert(icons.some((name) => name === 'IconFolderOpenRegular' || name === 'IconFolderCloseRegular'), 'folder icon kept')
    assert(!icons.includes('IconTriangleRightFillRegular'), 'no disclosure arrow replacing the folder')
  }
})

await check('manual sort rows are draggable and reorder persists browser-locally', () => {
  const { harness, t, browserWindow } = scenario()
  openSectionMenu(harness, t, 'section.recent')
  pickSectionItem(harness, t, 'section.recent', t('sort.manual'))
  let rows = findAll(findSection(harness.tree, t, 'section.recent'), isSessionRow)
  const initial = rows.map(rowTitle)
  assert(rows[0].props.draggable === true, 'manual rows draggable')
  dispatch(harness, rows[0], 'onDragStart', syntheticEvent({
    dataTransfer: { setData() {}, effectAllowed: '' },
  }))
  rows = findAll(findSection(harness.tree, t, 'section.recent'), isSessionRow)
  dispatch(harness, rows[1], 'onDragOver', syntheticEvent({
    clientY: 30,
    currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 32 }) },
    dataTransfer: { dropEffect: '' },
  }))
  rows = findAll(findSection(harness.tree, t, 'section.recent'), isSessionRow)
  dispatch(harness, rows[1], 'onDrop', syntheticEvent({}))
  const after = findAll(findSection(harness.tree, t, 'section.recent'), isSessionRow).map(rowTitle)
  assertEqual(after, [initial[1], initial[0], ...initial.slice(2)], 'dragged row moved after the drop target')
  const stored = JSON.parse(browserWindow.localStorage.getItem('dsh.sidebarSections.manualOrder') ?? '{}')
  assertEqual(stored.recent.length, initial.length, 'manual order persisted')
  assertEqual(stored.recent[0], findAllSessionRows(harness.tree, initial[1])[0].props['data-session'], 'persisted order head')
})

await check('updated sort rows are not draggable', () => {
  const { harness, t } = scenario()
  const row = findAll(findSection(harness.tree, t, 'section.recent'), isSessionRow)[0]
  assert(row.props.draggable !== true, 'updated order rows are static')
})

await check('section headings cover all four sections', () => {
  const { harness, t } = scenario()
  const headings = findAll(harness.tree, (element) => element.type === 'h2').map(textOf)
  assertEqual(headings, [t('section.pinned'), t('section.projects'), t('section.recent'), t('section.archived')], 'four headings')
})

await check('rows and buttons render no native title tooltips', () => {
  const { harness } = scenario()
  const native = findAll(harness.tree, (element) => element.props !== undefined && element.props.title !== undefined)
  assertEqual(native.length, 0, 'no DOM title attributes')
})

await check('projects one-list mode flattens the workspace groups', () => {
  const { harness, t } = scenario()
  openSectionMenu(harness, t, 'section.projects')
  pickSectionItem(harness, t, 'section.projects', t('group.oneList'))
  const projects = findSection(harness.tree, t, 'section.projects')
  assertEqual(findAll(projects, (element) => element.props?.className === 'dshss-projectRow').length, 0, 'no project headers in one-list mode')
  const titles = findAll(projects, isSessionRow).map(rowTitle)
  assert(titles.includes('Alpha talk') && titles.includes('Beta old talk'), 'rows from every workspace are listed')
})

await check('recent by-project mode groups rows under project headings', () => {
  const { harness, t } = scenario()
  openSectionMenu(harness, t, 'section.recent')
  pickSectionItem(harness, t, 'section.recent', t('group.byProject'))
  const recent = findSection(harness.tree, t, 'section.recent')
  const labels = findAll(recent, (element) => element.props?.className === 'dshss-subgroupLabel').map(textOf)
  assertEqual(labels, ['Alpha project', t('project.ungrouped'), 'Beta project'], 'recent subgroup headings')
  assert(findAll(recent, isSessionRow).map(rowTitle).includes('Alpha talk'), 'rows stay listed')
})

await check('conversation rows expose their owning project to the hover preview', () => {
  const { harness, t } = scenario()
  const row = findAllSessionRows(harness.tree, 'Alpha talk')[0]
  assertEqual(row.props['data-project'], 'Alpha project', 'row carries the project name for the hover preview')
})

// ---------------------------------------------------------------------------
// 7. Dialogs
// ---------------------------------------------------------------------------

/**
 * Mount the overlay dialog against one request.
 * @param {object} request - dialog request.
 * @returns {{harness: object, t: Function, calls: object[], injected: object}} scenario.
 */
function mountDialog(request) {
  const applyResult = applyPlugin()
  const overlay = applyResult.registrations.find((entry) => entry.options.name === 'shell.overlay')
  const injected = overlay.options.inject()
  const t = translator(applyResult.localeRegistrations[0].dicts.zh)
  const harness = mountComponent(overlay.component, {
    ...injected,
    useRequest: (selector) => selector(request),
    t,
  }, applyResult.reactRuntime)
  return { harness, t, calls: applyResult.calls, injected }
}

await check('workspace rename dialog submits the trimmed title', async () => {
  const { harness, t, calls } = mountDialog({ kind: 'rename', workspaceId: 'w1', currentTitle: 'Alpha project', seq: 1 })
  const input = findOne(harness.tree, (element) => element.type === 'input')
  assertEqual(input.props.value, 'Alpha project', 'prefilled')
  dispatch(harness, input, 'onChange', syntheticEvent({ target: { value: '  Renamed  ' } }))
  const submit = findOne(harness.tree, (element) => element.type === 'button' && textOf(element) === t('dialog.rename.confirm'))
  dispatch(harness, submit, 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-1), ['renameWorkspace', 'w1', 'Renamed'], 'trimmed rename')
})

await check('session rename dialog submits through sessions.using', async () => {
  const { harness, t, calls } = mountDialog({ kind: 'rename-session', sessionId: 's2', currentTitle: 'Alpha talk', seq: 2 })
  const input = findOne(harness.tree, (element) => element.type === 'input')
  dispatch(harness, input, 'onChange', syntheticEvent({ target: { value: 'Renamed session' } }))
  const submit = findOne(harness.tree, (element) => element.type === 'button' && textOf(element) === t('dialog.rename.confirm'))
  dispatch(harness, submit, 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-2), ['using', 's2', 'workspaceOperation'], 'session acquired')
  assertEqual(calls.at(-1), ['renameSession', 's2', 'Renamed session'], 'renamed')
})

await check('delete dialog states the retention boundary', () => {
  const { harness, t } = mountDialog({ kind: 'delete', workspaceId: 'w1', title: 'Alpha project', seq: 3 })
  const text = textOf(harness.tree)
  assert(text.includes('Alpha project'), 'names workspace')
  assert(text.includes(t('dialog.delete.body', { name: 'Alpha project' }).slice(0, 6)), 'states retention boundary')
})

await check('stop-and-archive dialog lists activity and submits stopActivity', async () => {
  const { harness, t, calls } = mountDialog({
    kind: 'archive-session',
    sessionId: 's2',
    title: 'Alpha talk',
    activity: [{ kind: 'turn' }, { kind: 'job', labels: ['job-a'] }],
    seq: 4,
  })
  const text = textOf(harness.tree)
  assert(text.includes(t('archive.confirm.title')), 'confirm title')
  assert(text.includes(t('archive.confirm.turn')), 'turn activity')
  const confirm = findOne(harness.tree, (element) => element.type === 'button' && textOf(element) === t('archive.confirm.action'))
  dispatch(harness, confirm, 'onClick', syntheticEvent())
  await settle()
  assertEqual(calls.at(-1), ['archiveSession', 's2', true], 'stop and archive submitted')
})

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exitCode = 1
} else {
  console.log('\nall checks passed')
}
