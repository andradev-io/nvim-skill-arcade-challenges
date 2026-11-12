import { Vim } from '@replit/codemirror-vim'

/**
 * Ex commands the browser editor lacks but real keymaps use all the time: tabs and buffers, :m, :echo, quitting,
 * and window commands (accepted, but there are no windows here). They talk to the page through a "sink", so the
 * Play panel (no sink) ignores them and the Terminal page shows messages and manages tabs.
 */
export type TabAction = 'new' | 'close' | 'next' | 'prev'

export interface EditorSink {
  /** A one-line message ("saved", "windows are not simulated", what a stub key would do). */
  note?: (text: string) => void
  /** Tab / buffer navigation. */
  tab?: (action: TabAction) => void
  /** Terminal page actions: `:retry`, `:hint`, `:nextchallenge`, `:palette`. */
  action?: (name: 'retry' | 'hint' | 'next' | 'palette') => void
  /** Harpoon slot operations: add current buffer to a slot, or jump to a saved slot. */
  harpoon?: (action: 'add' | 'jump', slot: string) => void
}

let sink: EditorSink = {}
export const setEditorSink = (s: EditorSink) => {
  sink = s
}

/** Messages for stub keys, by index: the mapping is `:arcnote N<CR>`. */
export const stubNotes: string[] = []

// The editor's wrapper around CodeMirror 6 follows the CodeMirror 5 API.
interface Cm {
  getCursor: () => { line: number; ch: number }
  setCursor: (pos: { line: number; ch: number }) => void
  getLine: (n: number) => string
  lastLine: () => number
  replaceRange: (text: string, from: { line: number; ch: number }, to: { line: number; ch: number }) => void
  state: { vim?: { visualMode?: boolean } }
}
interface Params {
  argString?: string
  selectionLine?: number
  selectionLineEnd?: number
}

/** Resolve `.+1`, `-2`, `$`, `0`, `12`, `'>` ... to a 1-based line number (0 = above the first line). */
export function resolveAddress(arg: string, cursorLine1: number, lastLine1: number, marks: Record<string, number>): number | null {
  const s = arg.replace(/\s+/g, '')
  const base = /^(\d+|\.|\$|'[<>a-z])/.exec(s)
  let at: number
  let rest = s
  if (base) {
    rest = s.slice(base[0].length)
    const b = base[0]
    if (b === '.') at = cursorLine1
    else if (b === '$') at = lastLine1
    else if (b[0] === "'") {
      const mark = marks[b[1]]
      if (mark === undefined) return null
      at = mark
    } else at = parseInt(b, 10)
  } else at = cursorLine1
  for (const off of rest.matchAll(/([+-])(\d*)/g)) {
    const n = off[2] === '' ? 1 : parseInt(off[2], 10)
    at += off[1] === '+' ? n : -n
  }
  if (rest.replace(/[+-]\d*/g, '') !== '') return null
  return Math.max(0, Math.min(lastLine1, at))
}

/** Move lines [from, to] (1-based) below line `dest` (0 = top). Returns the new text and where the block starts. */
export function moveLines(lines: string[], from: number, to: number, dest: number): { lines: string[]; start: number } | null {
  if (dest >= from && dest < to) return null // moving a block into itself
  if (dest === to || dest === from - 1) return { lines, start: from }
  const block = lines.slice(from - 1, to)
  const rest = [...lines.slice(0, from - 1), ...lines.slice(to)]
  const at = dest > to ? dest - block.length : dest
  rest.splice(at, 0, ...block)
  return { lines: rest, start: at + 1 }
}

function install() {
  const say = (t: string) => sink.note?.(t)
  const define = (name: string, prefix: string, fn: (cm: Cm, p: Params) => void) =>
    Vim.defineEx(name, prefix, fn as unknown as Parameters<typeof Vim.defineEx>[2])

  define('arcnote', 'arcnote', (_cm, p) => say(stubNotes[parseInt(p.argString ?? '', 10)] ?? ''))
  define('echo', 'ec', (_cm, p) => say((p.argString ?? '').trim().replace(/^(["'])(.*)\1$/, '$2')))
  define('echomsg', 'echom', (_cm, p) => say((p.argString ?? '').trim().replace(/^(["'])(.*)\1$/, '$2')))

  for (const [name, prefix] of [['quit', 'q'], ['wq', 'wq'], ['xit', 'x'], ['update', 'up'], ['qall', 'qa'], ['wall', 'wa'], ['wqall', 'wqa'], ['xall', 'xa']] as const) {
    define(name, prefix, () => say('nothing to save or close in the sandbox'))
  }
  for (const [name, prefix] of [
    ['close', 'clo'], ['only', 'on'], ['split', 'sp'], ['vsplit', 'vs'], ['new', 'new'], ['vnew', 'vne'], ['resize', 'res'],
    ['vertical', 'vert'], ['wincmd', 'winc'], ['enew', 'ene'],
  ] as const) {
    define(name, prefix, () => say(`:${name} has no effect here: the browser terminal has no windows`))
  }

  define('retry', 'retry', () => sink.action?.('retry'))
  define('hint', 'hint', () => sink.action?.('hint'))
  define('nextchallenge', 'nextc', () => sink.action?.('next'))
  define('palette', 'palette', () => sink.action?.('palette'))

  define('tabnew', 'tabnew', () => sink.tab?.('new'))
  define('tabedit', 'tabe', () => sink.tab?.('new'))
  define('tabclose', 'tabc', () => sink.tab?.('close'))
  define('tabnext', 'tabn', () => sink.tab?.('next'))
  define('tabprevious', 'tabp', () => sink.tab?.('prev'))
  define('tabNext', 'tabN', () => sink.tab?.('prev'))
  define('bnext', 'bn', () => sink.tab?.('next'))
  define('bprevious', 'bp', () => sink.tab?.('prev'))
  define('bNext', 'bN', () => sink.tab?.('prev'))
  define('bdelete', 'bd', () => sink.tab?.('close'))
  define('bwipeout', 'bw', () => sink.tab?.('close'))

  define('archoon', 'archoon', (_cm, p) => {
    const arg = (p.argString ?? '').trim()
    const m = /^(add|jump)\s+([a-d])$/i.exec(arg)
    if (!m) return say('Usage: :archoon add|jump {a-d}')
    sink.harpoon?.(m[1].toLowerCase() as 'add' | 'jump', m[2].toLowerCase())
  })

  define('move', 'm', (cm, p) => {
    const cursor = cm.getCursor().line + 1
    const last = cm.lastLine() + 1
    const a = (p.selectionLine ?? cm.getCursor().line) + 1
    const b = (Number.isNaN(p.selectionLineEnd) || p.selectionLineEnd === undefined ? a - 1 : p.selectionLineEnd) + 1
    const from = Math.min(a, b)
    const to = Math.max(a, b)
    // '< and '> are the range of a visual selection; both are the range itself here
    const dest = resolveAddress(p.argString ?? '', cursor, last, { '<': from, '>': to })
    if (dest === null) return say('E14: invalid address')
    const lines = Array.from({ length: last }, (_, i) => cm.getLine(i))
    const moved = moveLines(lines, from, to, dest)
    if (!moved) return say('E134: cannot move a range of lines into itself')
    cm.replaceRange(moved.lines.join('\n'), { line: 0, ch: 0 }, { line: last - 1, ch: lines[last - 1].length })
    cm.setCursor({ line: moved.start - 1 + (to - from), ch: 0 })
  })
}

let installed = false
export function installExCommands() {
  if (installed) return
  installed = true
  install()
}
