/**
 * Reads keymaps out of a Neovim config (Lua or Vimscript) so the browser sandbox can use them.
 *
 * Nothing is executed: the text is only scanned. A mapping ends up as one of three things:
 *  - working: plain keys, or an :command the browser editor has (or that the terminal page simulates);
 *  - stub: needs a plugin, Lua or a Neovim feature. The key is still taken over, so it never falls through to the
 *    stock key, and pressing it shows a one-line message saying what it would have done;
 *  - skipped: cannot be represented at all (a mode that is not simulated, a mapping with an expression).
 */

export type MapMode = 'n' | 'v' | 'x' | 'i'

export interface Keymap {
  mode: MapMode
  /** Left-hand side, already in the editor's key notation (leader expanded). */
  lhs: string
  rhs: string
  noremap: boolean
  /** Set when the mapping cannot really run here: the text shown when the key is pressed. */
  note?: string
  /** Where it came from (file path), for the report. */
  file: string
  line: number
}

export interface Skipped {
  file: string
  line: number
  text: string
  reason: string
}

export interface ParsedKeymaps {
  maps: Keymap[]
  skipped: Skipped[]
}

const DEFAULT_LEADER = '\\'
const SUPPORTED_MODES = new Set<string>(['n', 'v', 'x', 'i'])

/**
 * Ex commands that work in the browser editor: its own, plus the ones the terminal page adds
 * (see components/play/exCommands.ts): tabs and buffers, :m, :echo, and no-ops for windows.
 */
export const EX_OK = new Set([
  // the editor's own
  'noh', 'nohlsearch', 'normal', 'norm', 's', 'substitute', 'g', 'global', 'v', 'vglobal', 'sort', 'set', 'se',
  'undo', 'u', 'redo', 'red', 'delm', 'delmarks', 'marks', 'reg', 'registers', 'd', 'delete', 'y', 'yank', 'pu', 'put',
  'j', 'join', 'w', 'write', 'map', 'nmap', 'vmap', 'imap', 'noremap', 'nnoremap', 'vnoremap', 'inoremap',
  // added by the terminal page
  'q', 'quit', 'wq', 'x', 'xit', 'up', 'update', 'qa', 'qall', 'wa', 'wall', 'wqa', 'xa', 'echo', 'echom', 'echomsg',
  'm', 'move', 'close', 'clo', 'only', 'on', 'split', 'sp', 'vsplit', 'vs', 'new', 'vnew', 'vne', 'resize', 'res',
  'vertical', 'vert', 'wincmd', 'winc', 'enew', 'ene',
  'tabnew', 'tabe', 'tabedit', 'tabclose', 'tabc', 'tabn', 'tabnext', 'tabp', 'tabprevious', 'tabprev', 'tabN',
  'tabNext', 'bn', 'bnext', 'bp', 'bprevious', 'bprev', 'bN', 'bNext', 'bd', 'bdelete', 'bw', 'bwipeout',
])

// ---------------------------------------------------------------- notation

const NAMED: Record<string, string> = {
  cr: 'CR', enter: 'CR', return: 'CR', esc: 'Esc', space: 'Space', bs: 'BS', tab: 'Tab', del: 'Del',
  up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End', lt: 'lt', bar: 'Bar',
  nop: 'Nop',
}

/** Normalise key notation: <cr> -> <CR>, <c-U> -> <C-u>, <leader> -> the leader key. */
export function normaliseKeys(keys: string, leader: string): string {
  const lead = leader === ' ' ? '<Space>' : leader
  return keys
    .replace(/<leader>/gi, () => lead)
    .replace(/<([A-Za-z0-9_-]+)>/g, (whole, inner: string) => {
      const mod = /^([cCaAmMsSdD])-(.+)$/.exec(inner)
      if (mod) {
        const rest = mod[2].length === 1 ? mod[2].toLowerCase() : (NAMED[mod[2].toLowerCase()] ?? mod[2])
        return `<${mod[1].toUpperCase()}-${rest}>`
      }
      const name = NAMED[inner.toLowerCase()]
      return name ? `<${name}>` : whole
    })
}

/** Turns <cmd>X<CR> into :X<CR> (the form the editor understands). */
function cmdToColon(rhs: string): string {
  return rhs.replace(/<cmd>/gi, ':')
}

/** Why this right-hand side cannot really run in the browser, or null if it can. */
export function rhsProblem(rhs: string): string | null {
  if (/<plug>/i.test(rhs)) return 'plugin mapping'
  if (/<cmd>\s*lua\b|^:\s*lua\b/i.test(rhs)) return 'runs Lua'
  const m = /^(?:<cmd>|:)\s*[0-9,.%'<>$+-]*([A-Za-z!]+)/i.exec(rhs)
  if (m && !EX_OK.has(m[1].replace(/!$/, ''))) return `:${m[1]} needs a plugin or Neovim`
  return null
}

/** ":Cmd args<CR>" -> "Cmd args", for messages. */
const asCommand = (rhs: string) => rhs.replace(/^:/, "").replace(/<CR>$/i, "")

const pretty = (lhs: string) => lhs.replace(/<Space>/g, '␣')

/** The line shown when a stub key is pressed. */
function stubNote(lhs: string, what: string, why: string): string {
  return `${pretty(lhs)}: ${what} ${why}, not simulated in the browser`
}

// ---------------------------------------------------------------- Lua scanning

/** Replace Lua comments with spaces (keeps offsets and line breaks), leaving strings alone. */
export function stripLuaComments(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const two = src.slice(i, i + 2)
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < src.length && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      out += src.slice(i, j + 1)
      i = j + 1
    } else if (two === '--') {
      const long = /^--\[(=*)\[/.exec(src.slice(i, i + 40))
      let end = src.indexOf('\n', i)
      if (long) {
        const close = src.indexOf(`]${long[1]}]`, i)
        end = close === -1 ? src.length : close + long[1].length + 2
      }
      if (end === -1) end = src.length
      out += src.slice(i, end).replace(/[^\n]/g, ' ')
      i = end
    } else if (c === '[' && /^\[=*\[/.test(src.slice(i, i + 20))) {
      const eq = /^\[(=*)\[/.exec(src.slice(i, i + 20))![1]
      const close = src.indexOf(`]${eq}]`, i)
      const end = close === -1 ? src.length : close + eq.length + 2
      out += src.slice(i, end)
      i = end
    } else {
      out += c
      i += 1
    }
  }
  return out
}

/** Value of a whole Lua string literal ("..", '..', [[..]]), or null when it is anything else. */
export function luaString(raw: string): string | null {
  const s = raw.trim()
  const long = /^\[(=*)\[([\s\S]*)\]\1\]$/.exec(s)
  if (long) return long[2]
  const q = s[0]
  if ((q !== '"' && q !== "'") || s[s.length - 1] !== q || s.length < 2) return null
  const body = s.slice(1, -1)
  // an unescaped quote of the same kind inside means this is a concatenation, not one literal
  if (new RegExp(`(^|[^\\\\])${q}`).test(body.replace(/\\\\/g, ''))) return null
  return body.replace(/\\(.)/g, (_, ch: string) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch))
}

/** Split call arguments on top-level commas. `start` is just after the opening paren. */
function callArgs(src: string, start: number): string[] | null {
  const args: string[] = []
  let depth = 0
  let from = start
  for (let i = start; i < src.length; i += 1) {
    const c = src[i]
    if (c === '"' || c === "'") {
      i += 1
      while (i < src.length && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1
    } else if (c === '(' || c === '{' || c === '[') {
      depth += 1
    } else if (c === ')' || c === '}' || c === ']') {
      if (depth === 0) {
        if (c !== ')') return null
        args.push(src.slice(from, i))
        return args
      }
      depth -= 1
    } else if (c === ',' && depth === 0) {
      args.push(src.slice(from, i))
      from = i + 1
    }
  }
  return null
}

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The leader key a config sets, or null. */
export function findLeader(src: string): string | null {
  const lua = /vim\.g\.mapleader\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(stripLuaComments(src))
  if (lua) return leaderValue(luaString(lua[1]) ?? '')
  const vimL = /^\s*let\s+(?:g:)?mapleader\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/m.exec(src)
  if (vimL) return leaderValue(vimL[1].slice(1, -1))
  return null
}

function leaderValue(v: string): string | null {
  if (!v) return null
  if (/^<space>$/i.test(v)) return ' '
  return v
}

/** Names that call vim.keymap.set / nvim_set_keymap: the built-ins, local aliases and small wrapper functions. */
function callees(code: string): string[] {
  const names = ['vim.keymap.set', 'vim.api.nvim_set_keymap']
  for (const m of code.matchAll(/local\s+(\w+)\s*=\s*vim\.keymap\.set\b/g)) names.push(m[1])
  for (const m of code.matchAll(/local\s+(\w+)\s*=\s*vim\.api\.nvim_set_keymap\b/g)) names.push(m[1])
  for (const m of code.matchAll(/local\s+(\w+)\s*=\s*vim\.keymap\b(?!\.)/g)) names.push(`${m[1]}.set`)
  for (const m of code.matchAll(/(?:local\s+)?function\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\bend\b/g)) {
    if (m[2].split(',').length >= 3 && /keymap\.set\s*\(|nvim_set_keymap\s*\(/.test(m[3])) names.push(m[1])
  }
  return [...new Set(names)]
}

function modesOf(raw: string): string[] | null {
  const s = luaString(raw)
  if (s !== null) return s === '' ? ['n', 'v'] : s.split('')
  const t = /^\s*\{([\s\S]*)\}\s*$/.exec(raw)
  if (!t) return null
  const list: string[] = []
  for (const part of t[1].split(',')) {
    if (!part.trim()) continue
    const v = luaString(part)
    if (v === null) return null
    list.push(...v.split(''))
  }
  return list
}

/** What a function mapping or an expression is about, for the message: its desc, else the first call it makes. */
function describeRhs(rhsRaw: string, opts: string): string {
  const desc = /\bdesc\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(opts)
  const text = desc ? luaString(desc[1]) : null
  if (text) return text
  const body = rhsRaw.replace(/\s+/g, ' ').trim()
  const call = /([A-Za-z_][\w.:]*)\s*\(/.exec(body.replace(/^function\s*\([^)]*\)/, ''))
  if (call && !/^(function|if|for|while|return)$/.test(call[1])) return call[1]
  const ref = /^[A-Za-z_][\w.]*$/.exec(body)
  if (ref) return ref[0]
  return body.length > 36 ? `${body.slice(0, 36)}...` : body
}

/** `function() vim.cmd("X") end` is just the command X. */
function luaCmdBody(rhsRaw: string): string | null {
  const m = /^\s*function\s*\([^)]*\)\s*vim\.cmd\s*\(?\s*(\[\[[\s\S]*?\]\]|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)?\s*end\s*$/.exec(rhsRaw)
  return m ? luaString(m[1]) : null
}

function parseLua(src: string, file: string, leader: string): ParsedKeymaps {
  const code = stripLuaComments(src)
  const maps: Keymap[] = []
  const skipped: Skipped[] = []
  for (const name of callees(code)) {
    const re = new RegExp(`(?<![\\w.])${esc(name)}\\s*\\(`, 'g')
    for (const m of code.matchAll(re)) {
      const args = callArgs(code, m.index + m[0].length)
      if (!args || args.length < 3) continue
      const line = lineOf(code, m.index)
      const [modeRaw, lhsRaw, rhsRaw] = args
      // wrapper bodies pass their own parameters through: not a mapping of its own
      if (/^[A-Za-z_][\w.]*$/.test(modeRaw.trim()) || /^[A-Za-z_][\w.]*$/.test(lhsRaw.trim())) continue
      const text = code.slice(m.index, m.index + 70).split('\n')[0].trim()
      const lhsLit = luaString(lhsRaw)
      const modes = modesOf(modeRaw)
      if (lhsLit === null || !modes) {
        skipped.push({ file, line, text, reason: 'mode or key is not a plain string' })
        continue
      }
      const lhs = normaliseKeys(lhsLit, leader)
      const opts = args.slice(3).join(',')
      const noremap = !(/\bremap\s*=\s*true\b/.test(opts) || /\bnoremap\s*=\s*false\b/.test(opts))

      // What the key does: a string, a vim.cmd function (same thing), or something we can only stub.
      let rhs = luaString(rhsRaw)
      if (rhs === null) {
        const cmd = luaCmdBody(rhsRaw)
        if (cmd !== null) rhs = `:${cmd.replace(/^:/, '')}<CR>`
      }
      let note: string | undefined
      let finalRhs = ''
      if (rhs === null) {
        const plain = /^\s*function\b/.test(rhsRaw)
        note = stubNote(lhs, describeRhs(rhsRaw, opts), plain ? 'runs Lua' : 'is not a plain string')
      } else {
        finalRhs = cmdToColon(normaliseKeys(rhs, leader))
        const bad = rhsProblem(finalRhs)
        if (bad) note = stubNote(lhs, describeRhs(asCommand(finalRhs), opts), bad)
      }
      for (const md of modes) {
        if (!SUPPORTED_MODES.has(md)) {
          skipped.push({ file, line, text, reason: `mode '${md}' is not simulated` })
          continue
        }
        maps.push({ mode: md as MapMode, lhs, rhs: finalRhs, noremap, note, file, line })
      }
    }
  }
  return { maps, skipped }
}

// ---------------------------------------------------------------- Vimscript

const VIM_MAP = /^\s*([nvxiosclt]?)(nore)?map(!?)\s+((?:<(?:buffer|silent|nowait|expr|unique|script)>\s*)*)(\S+)\s+(.+?)\s*$/

function parseVim(src: string, file: string, leader: string): ParsedKeymaps {
  const maps: Keymap[] = []
  const skipped: Skipped[] = []
  src.split('\n').forEach((raw, idx) => {
    const m = VIM_MAP.exec(raw)
    if (!m) return
    const [, modeChar, nore, bang, flags, lhsRaw, rhs] = m
    const line = idx + 1
    const text = raw.trim().slice(0, 70)
    const lhs = normaliseKeys(lhsRaw, leader)
    const md = bang ? 'i' : modeChar || 'n'
    const finalRhs = cmdToColon(normaliseKeys(rhs, leader))
    let note: string | undefined
    if (/<expr>/i.test(flags)) note = stubNote(lhs, rhs.slice(0, 30), 'is an expression mapping')
    else {
      const bad = rhsProblem(finalRhs)
      if (bad) note = stubNote(lhs, asCommand(finalRhs).slice(0, 30), bad)
    }
    // plain `map` / `noremap` cover normal, visual and operator-pending
    const modes = modeChar === '' && !bang ? ['n', 'v'] : [md]
    for (const mo of modes) {
      if (!SUPPORTED_MODES.has(mo)) {
        skipped.push({ file, line, text, reason: `mode '${mo}' is not simulated` })
        continue
      }
      maps.push({ mode: mo as MapMode, lhs, rhs: note ? '' : finalRhs, noremap: !!nore, note, file, line })
    }
  })
  return { maps, skipped }
}

/** All keymaps in one config file. `leader` is the leader key set elsewhere in the config (default backslash). */
export function parseKeymaps(src: string, file: string, leader: string = DEFAULT_LEADER): ParsedKeymaps {
  const a = parseLua(src, file, leader)
  const b = parseVim(src, file, leader)
  return { maps: [...a.maps, ...b.maps], skipped: [...a.skipped, ...b.skipped] }
}

/** Several config files: leader found in any of them, later definitions win over earlier ones. */
export function parseConfig(files: { path: string; text: string }[]): ParsedKeymaps & { leader: string } {
  let leader = DEFAULT_LEADER
  for (const f of files) {
    const l = findLeader(f.text)
    if (l) leader = l
  }
  const byKey = new Map<string, Keymap>()
  const skipped: Skipped[] = []
  for (const f of files) {
    const p = parseKeymaps(f.text, f.path, leader)
    for (const k of p.maps) byKey.set(`${k.mode}\u0000${k.lhs}`, k)
    skipped.push(...p.skipped)
  }
  return { leader, maps: [...byKey.values()], skipped }
}
