/**
 * Which-key prefix hint overlay: shows available key bindings when a prefix is typed.
 * Pure state machine with no side effects; the UI layer handles timers and rendering.
 */

import type { Keymap } from './keymaps'

// ---------- Types ----------

export interface WhichKeyEntry {
  /** The key that triggers this entry (single character or special key name). */
  key: string
  /** Human-readable label describing what the key does. */
  label: string
  /** Optional group for visual grouping in the overlay. */
  group?: string
}

export interface WhichKeyNode {
  /** The full prefix that leads to this node (e.g., "<Space>", "g"). */
  prefix: string
  /** Entries directly under this prefix. */
  entries: WhichKeyEntry[]
  /** Child nodes for longer prefixes. */
  children: Map<string, WhichKeyNode>
}

export interface WhichKeyConfig {
  /** Root nodes keyed by their first key (the trigger). */
  roots: Map<string, WhichKeyNode>
  /** How long to wait after a prefix before showing the overlay (ms). */
  timeoutMs: number
}

export interface WhichKeyState {
  /** Whether the overlay should be visible. */
  visible: boolean
  /** The current node being explored, or null when idle. */
  node: WhichKeyNode | null
  /** Keys typed so far in the current prefix sequence. */
  typed: string[]
}

export type WhichKeyAction =
  | { type: 'keydown'; key: string }
  | { type: 'timeout' }
  | { type: 'reset' }

// ---------- Challenge data shape ----------

export interface ChallengeWhichKeyPrefix {
  /** The trigger key(s) that start this prefix tree. */
  trigger: string
  /** Direct entries under this prefix. */
  entries: { key: string; label: string; group?: string }[]
  /** Nested children prefixes. */
  children?: ChallengeWhichKeyPrefix[]
}

export interface ChallengeWhichKey {
  prefixes: ChallengeWhichKeyPrefix[]
  timeout_ms?: number
}

// ---------- State machine ----------

const IDLE: WhichKeyState = { visible: false, node: null, typed: [] }

/**
 * Pure state transition function. Given the current config, state and an action,
 * returns the next state. No side effects; timers are managed by the caller.
 */
export function whichKeyStep(config: WhichKeyConfig, state: WhichKeyState, action: WhichKeyAction): WhichKeyState {
  if (action.type === 'reset') return IDLE

  if (action.type === 'timeout') {
    // Only show overlay if we're tracking a prefix
    if (!state.node) return IDLE
    return { ...state, visible: true }
  }

  // action.type === 'keydown'
  const { key } = action

  // If overlay is visible and key matches an entry, consume it and dismiss
  if (state.visible && state.node) {
    const match = state.node.entries.find((e) => e.key === key)
    if (match) {
      // Key matched an entry: dismiss overlay, let the key pass through to Vim
      return IDLE
    }
    // Check if key leads to a child node
    const child = state.node.children.get(key)
    if (child) {
      return { visible: false, node: child, typed: [...state.typed, key] }
    }
    // Key doesn't match anything: dismiss and pass through
    return IDLE
  }

  // Not visible yet: check if this key starts or continues a prefix
  if (!state.node) {
    // Starting fresh: look for a root matching this key
    const root = config.roots.get(key)
    if (root) {
      return { visible: false, node: root, typed: [key] }
    }
    return IDLE
  }

  // Continuing a prefix (not yet visible): check children
  const child = state.node.children.get(key)
  if (child) {
    return { visible: false, node: child, typed: [...state.typed, key] }
  }

  // Check if key matches a direct entry (complete mapping)
  const match = state.node.entries.find((e) => e.key === key)
  if (match) {
    // Complete mapping found: reset
    return IDLE
  }

  // No match: reset
  return IDLE
}

// ---------- Tree builders ----------

/** Build a WhichKeyConfig from parsed keymaps (user's Neovim config). */
export function buildWhichKeyFromMaps(maps: Keymap[], _leader: string, timeoutMs = 800): WhichKeyConfig {
  const roots = new Map<string, WhichKeyNode>()

  for (const map of maps) {
    // Only normal-mode mappings make sense for which-key
    if (map.mode !== 'n') continue
    // Skip stubs (they don't really do anything useful to show)
    if (map.note) continue

    const lhs = map.lhs
    if (!lhs || lhs.length < 2) continue // single keys don't need which-key

    // Split lhs into individual key tokens
    const tokens = tokenizeLhs(lhs)
    if (tokens.length < 2) continue

    // Walk/create the tree
    const firstKey = tokens[0]
    let node = roots.get(firstKey)
    if (!node) {
      node = { prefix: firstKey, entries: [], children: new Map() }
      roots.set(firstKey, node)
    }

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]
      if (i === tokens.length - 1) {
        // Last token: add as entry
        const existing = node.entries.find((e) => e.key === token)
        if (!existing) {
          node.entries.push({
            key: token,
            label: describeMapping(map),
            group: inferGroup(map.rhs),
          })
        }
      } else {
        // Intermediate token: ensure child node exists
        let child = node.children.get(token)
        if (!child) {
          const prefixSoFar = tokens.slice(0, i + 1).join('')
          child = { prefix: prefixSoFar, entries: [], children: new Map() }
          node.children.set(token, child)
        }
        node = child
      }
    }
  }

  return { roots, timeoutMs }
}

/** Build a WhichKeyConfig from challenge JSON data. */
export function buildWhichKeyFromChallenge(data: ChallengeWhichKey): WhichKeyConfig {
  const roots = new Map<string, WhichKeyNode>()
  const timeoutMs = data.timeout_ms ?? 800

  for (const prefix of data.prefixes) {
    const tokens = tokenizeLhs(prefix.trigger)
    if (tokens.length === 0) continue

    const firstKey = tokens[0]
    let node = roots.get(firstKey)
    if (!node) {
      node = { prefix: firstKey, entries: [], children: new Map() }
      roots.set(firstKey, node)
    }

    // Navigate to the right depth for multi-char triggers
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]
      let child: WhichKeyNode | undefined = node!.children.get(token)
      if (!child) {
        child = { prefix: tokens.slice(0, i + 1).join(''), entries: [], children: new Map() }
        node!.children.set(token, child)
      }
      node = child
    }

    // Add entries at this level
    for (const entry of prefix.entries) {
      node!.entries.push({ key: entry.key, label: entry.label, group: entry.group })
    }

    // Recursively add children
    if (prefix.children) {
      addChildPrefixes(node, prefix.children)
    }
  }

  return { roots, timeoutMs }
}

function addChildPrefixes(parent: WhichKeyNode, children: ChallengeWhichKeyPrefix[]) {
  for (const child of children) {
    const tokens = tokenizeLhs(child.trigger)
    if (tokens.length === 0) continue

    // For children, the trigger is relative to parent
    const key = tokens[0]
    let node = parent.children.get(key)
    if (!node) {
      node = { prefix: parent.prefix + key, entries: [], children: new Map() }
      parent.children.set(key, node)
    }

    // Navigate deeper if trigger has multiple tokens
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i]
      let next: WhichKeyNode | undefined = node.children.get(token)
      if (!next) {
        next = { prefix: node.prefix + token, entries: [], children: new Map() }
        node.children.set(token, next)
      }
      node = next
    }

    for (const entry of child.entries) {
      node!.entries.push({ key: entry.key, label: entry.label, group: entry.group })
    }

    if (child.children) {
      addChildPrefixes(node!, child.children)
    }
  }
}

// ---------- Helpers ----------

/** Tokenize a lhs string into individual key tokens: "<Space>ff" -> ["<Space>", "f", "f"]. */
function tokenizeLhs(lhs: string): string[] {
  const tokens: string[] = []
  let i = 0
  while (i < lhs.length) {
    if (lhs[i] === '<') {
      const end = lhs.indexOf('>', i)
      if (end > i) {
        tokens.push(lhs.slice(i, end + 1))
        i = end + 1
      } else {
        tokens.push(lhs[i])
        i++
      }
    } else {
      tokens.push(lhs[i])
      i++
    }
  }
  return tokens
}

/** Generate a human-readable label for a keymap entry. */
function describeMapping(map: Keymap): string {
  const rhs = map.rhs
  if (!rhs) return map.lhs

  // Ex commands: strip :<CR> wrapper
  if (rhs.startsWith(':') && rhs.endsWith('<CR>')) {
    return rhs.slice(1, -4)
  }

  // Short enough to show directly
  if (rhs.length <= 30) return rhs

  return rhs.slice(0, 27) + '...'
}

/** Infer a group name from the rhs for visual organization. */
function inferGroup(rhs: string): string | undefined {
  if (!rhs) return undefined
  if (rhs.startsWith(':')) return 'command'
  if (rhs.includes('Telescope') || rhs.includes('telescope')) return 'telescope'
  if (rhs.includes('Git') || rhs.includes('git')) return 'git'
  if (rhs.includes('Lsp') || rhs.includes('lsp')) return 'lsp'
  if (rhs.includes('Buffer') || rhs.includes('buffer')) return 'buffer'
  if (rhs.includes('Tab') || rhs.includes('tab')) return 'tab'
  if (rhs.includes('Search') || rhs.includes('search')) return 'search'
  if (rhs.includes('File') || rhs.includes('file')) return 'file'
  return undefined
}

/** Create an empty/idle which-key state. */
export function initialWhichKeyState(): WhichKeyState {
  return { ...IDLE }
}