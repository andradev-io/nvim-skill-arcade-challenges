import { Vim } from '@replit/codemirror-vim'
import { pairAction } from './autopairs'
import { openCommentLine, toggleLines } from './comment'
import { feedJumpKey, initJumpState, type JumpState, type JumpTarget } from './jumpLabels'
import { findSurround, pairFor } from './surround'
import { argumentAt, callAt, quoteAt, treesitterObjectAt } from './textobjects'
import type { Range } from './textobjects'
import type { TreesitterObjects } from '../core/types'

/**
 * Connects the plugin imitations to the Vim editor: operators and motions go into its tables, and a few keys
 * (the ones its tables cannot express: gcc, ys, ds, cs, insert-mode pairing) are handled before Vim sees them.
 */

interface Pos {
  line: number
  ch: number
}
interface InputState {
  operator?: string | null
  operatorArgs?: unknown
}
export interface Cm {
  getCursor: (which?: string) => Pos
  setCursor: (p: Pos) => void
  getLine: (n: number) => string
  getValue: () => string
  lastLine: () => number
  replaceRange: (text: string, from: Pos, to?: Pos) => void
  indexFromPos: (p: Pos) => number
  posFromIndex: (i: number) => Pos
  listSelections: () => { anchor: Pos; head: Pos }[]
  state: { vim?: { insertMode?: boolean; visualMode?: boolean; visualLine?: boolean; inputState: InputState } }
}

let filetype = 'text'
export const setFiletype = (ft: string) => {
  filetype = ft
}

// ---------- treesitter objects ----------

let tsObjects: TreesitterObjects | null = null
export const setTreesitterObjects = (objs: TreesitterObjects | null) => {
  tsObjects = objs
}

// ---------- jump motion ----------

let jumpTargets: JumpTarget[] = []
let jumpState: JumpState | null = null

export const setJumpTargets = (targets: JumpTarget[]) => {
  jumpTargets = targets
  jumpState = null
}
export const getJumpState = () => jumpState
export const clearJumpMode = () => {
  jumpState = null
}
export const isSurroundAwaiting = (): boolean => awaiting !== null

const P = (line: number, ch: number): Pos => ({ line, ch })
const before = (a: Pos, b: Pos) => a.line < b.line || (a.line === b.line && a.ch <= b.ch)
const firstNonBlank = (s: string) => s.length - s.trimStart().length

// ---------- comment ----------

function toggleRange(cm: Cm, from: number, to: number) {
  const lines: string[] = []
  for (let i = from; i <= to; i += 1) lines.push(cm.getLine(i))
  const out = toggleLines(lines, filetype)
  cm.replaceRange(out.join('\n'), P(from, 0), P(to, cm.getLine(to).length))
  cm.setCursor(P(from, firstNonBlank(cm.getLine(from))))
}

function openComment(cm: Cm, below: boolean) {
  const row = cm.getCursor().line
  const cur = cm.getLine(row)
  const { text, col } = openCommentLine(cur.slice(0, firstNonBlank(cur)), filetype)
  if (below) cm.replaceRange(`\n${text}`, P(row, cur.length))
  else cm.replaceRange(`${text}\n`, P(row, 0))
  const at = below ? row + 1 : row
  cm.setCursor(P(at, col))
  Vim.handleKey(cm as never, 'a', 'user')
}

// ---------- surround ----------

type Awaiting =
  | { kind: 'add'; from: Pos; to: Pos }
  | { kind: 'delete' }
  | { kind: 'change'; old?: string }
let awaiting: Awaiting | null = null

function surroundAdd(cm: Cm, from: Pos, to: Pos, ch: string) {
  const pair = pairFor(ch)
  if (!pair) return
  cm.replaceRange(pair.close, to)
  cm.replaceRange(pair.open, from)
  cm.setCursor(from)
}

function surroundSwap(cm: Cm, old: string, repl: string | null) {
  const text = cm.getValue()
  const found = findSurround(text, cm.indexFromPos(cm.getCursor()), old)
  if (!found) return
  const pair = repl === null ? { open: '', close: '' } : pairFor(repl)
  if (!pair) return
  // closing end first, so the opening offsets stay valid
  cm.replaceRange(pair.close, cm.posFromIndex(found.closeAt - (found.closeLen - 1)), cm.posFromIndex(found.closeAt + 1))
  cm.replaceRange(pair.open, cm.posFromIndex(found.openAt), cm.posFromIndex(found.openAt + found.openLen))
  cm.setCursor(cm.posFromIndex(found.openAt))
}

// ---------- text objects ----------

const OBJECTS: Record<string, (line: string, col: number, inner: boolean) => Range | null> = {
  a: argumentAt,
  q: quoteAt,
  f: callAt,
}

// ---------- install ----------

let defined = false

/** Put the operators, motions and key maps of the enabled shims into the editor's (global) tables. */
export function applyShims(on: ReadonlySet<string>) {
  if (!defined) {
    defined = true
    Vim.defineOperator('arcComment', ((cm: Cm, _args: unknown, ranges: { anchor: Pos; head: Pos }[]) => {
      const { anchor, head } = ranges[0]
      const lo = before(anchor, head) ? anchor : head
      let hi = before(anchor, head) ? head : anchor
      // a motion that ends at column 0 of a later line stops before that line
      if (hi.ch === 0 && hi.line > lo.line && !cm.state.vim?.visualMode) hi = P(hi.line - 1, 0)
      toggleRange(cm, lo.line, hi.line)
      return P(lo.line, firstNonBlank(cm.getLine(lo.line)))
    }) as never)
    Vim.defineOperator('arcSurround', ((_cm: Cm, _args: unknown, ranges: { anchor: Pos; head: Pos }[]) => {
      const { anchor, head } = ranges[0]
      const [from, to] = before(anchor, head) ? [anchor, head] : [head, anchor]
      awaiting = { kind: 'add', from, to }
      return from
    }) as never)
    Vim.defineMotion('arcObject', ((cm: Cm, head: Pos, args: { obj: string; textObjectInner?: boolean }) => {
      // Check treesitter objects first when available
      const tsKeyMap: Record<string, keyof TreesitterObjects> = { f: 'function', c: 'class', s: 'statement', p: 'parameter', b: 'block', t: 'tag' }
      const tsKey = tsKeyMap[args.obj]
      if (tsObjects && tsKey) {
        const entries = tsObjects[tsKey]
        if (entries && entries.length) {
          const mlr = treesitterObjectAt(entries, head.line, head.ch, !!args.textObjectInner)
          if (mlr) {
            const visual = !!cm.state.vim?.visualMode
            return [P(mlr[0], mlr[1]), P(mlr[2], visual ? mlr[3] - 1 : mlr[3])]
          }
        }
      }
      // Fall back to bracket-based single-line objects
      const r = OBJECTS[args.obj]?.(cm.getLine(head.line), head.ch, !!args.textObjectInner)
      if (!r) return null
      const visual = !!cm.state.vim?.visualMode
      return [P(head.line, r[0]), P(head.line, visual ? r[1] - 1 : r[1])]
    }) as never)
  }
  if (on.has('comment')) Vim.mapCommand('gc', 'operator', 'arcComment', {}, { isEdit: true })
  if (on.has('textobjects')) {
    for (const [obj, keys] of [['a', 'a'], ['q', 'q'], ['f', 'f']] as const) {
      for (const inner of [true, false]) {
        for (const context of ['operatorPending', 'visual']) {
          Vim.mapCommand(`${inner ? 'i' : 'a'}${keys}`, 'motion', 'arcObject', { obj, textObjectInner: inner }, { context })
        }
      }
    }
  }
  if (on.has('treesitter')) {
    // Register treesitter structural text objects: if/af, ic/ac, is/as, ip/ap, ib/ab, it/at
    for (const [obj, keys] of [['f', 'f'], ['c', 'c'], ['s', 's'], ['p', 'p'], ['b', 'b'], ['t', 't']] as const) {
      for (const inner of [true, false]) {
        for (const context of ['operatorPending', 'visual']) {
          Vim.mapCommand(`${inner ? 'i' : 'a'}${keys}`, 'motion', 'arcObject', { obj, textObjectInner: inner }, { context })
        }
      }
    }
  }
}

/**
 * Called on every keydown before Vim: returns true when the key was handled here (the caller cancels the event).
 * `on` is the set of enabled shims.
 */
export function handleShimKey(e: KeyboardEvent, cm: Cm, on: ReadonlySet<string>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  const vim = cm.state.vim
  if (!vim) return false
  const key = e.key
  const esc = () => Vim.handleKey(cm as never, '<Esc>', 'user')

  // jump motion state machine (active when targets exist and 's' was pressed in normal mode)
  if (jumpState) {
    const result = feedJumpKey(jumpState, key)
    if (result.type === 'cancel') {
      jumpState = null
      return true
    }
    if (result.type === 'jump') {
      jumpState = null
      cm.setCursor(P(result.target.row, result.target.col))
      return true
    }
    // continue: update state, caller will refresh decorations
    jumpState = result.state
    return true
  }

  // initiate jump mode: 's' in normal mode when motion plugin is active and targets exist
  if (!vim.insertMode && !vim.visualMode && key === 's' && on.has('motion') && jumpTargets.length > 0) {
    jumpState = initJumpState(jumpTargets)
    return true
  }

  // clear jump state on mode transitions
  if (vim.insertMode || vim.visualMode) {
    jumpState = null
  }

  // a surround waiting for its character
  if (awaiting) {
    const a = awaiting
    if (key === 'Shift') return false
    awaiting = null
    if (key === 'Escape' || key.length !== 1) return key === 'Escape'
    if (a.kind === 'add') surroundAdd(cm, a.from, a.to, key)
    else if (a.kind === 'delete') surroundSwap(cm, key, null)
    else if (a.old === undefined) awaiting = { kind: 'change', old: key }
    else surroundSwap(cm, a.old, key)
    return true
  }

  if (vim.insertMode) {
    if (!on.has('autopairs')) return false
    const c = cm.getCursor()
    const line = cm.getLine(c.line)
    const act = pairAction(key, line[c.ch - 1], line[c.ch])
    if (!act) return false
    if (act.type === 'insert') {
      cm.replaceRange(act.text, c)
      cm.setCursor(P(c.line, c.ch + 1))
    } else if (act.type === 'skip') cm.setCursor(P(c.line, c.ch + 1))
    else cm.replaceRange('', P(c.line, c.ch - 1), P(c.line, c.ch + 1))
    return true
  }

  if (vim.visualMode) {
    if (key === 'S' && on.has('surround') && !vim.visualLine) {
      const sel = cm.listSelections()[0]
      const [from, to] = before(sel.anchor, sel.head) ? [sel.anchor, sel.head] : [sel.head, sel.anchor]
      esc()
      awaiting = { kind: 'add', from, to: P(to.line, to.ch + 1) }
      return true
    }
    return false
  }

  const op = vim.inputState.operator
  if (!op) return false
  if (op === 'arcComment' && on.has('comment')) {
    if (key === 'c') {
      const row = cm.getCursor().line
      esc()
      toggleRange(cm, row, row)
      return true
    }
    if (key === 'o' || key === 'O') {
      esc()
      openComment(cm, key === 'o')
      return true
    }
  }
  if (!on.has('surround')) return false
  if (op === 'arcSurround' && key === 's') {
    const row = cm.getCursor().line
    esc()
    awaiting = { kind: 'add', from: P(row, firstNonBlank(cm.getLine(row))), to: P(row, cm.getLine(row).length) }
    return true
  }
  if (key === 's' && op === 'yank') {
    // `ys`: the yank operator becomes the surround operator, the motion that follows picks the text
    vim.inputState.operator = 'arcSurround'
    vim.inputState.operatorArgs = {}
    return true
  }
  if (key === 's' && op === 'delete') {
    esc()
    awaiting = { kind: 'delete' }
    return true
  }
  if (key === 's' && op === 'change') {
    esc()
    awaiting = { kind: 'change' }
    return true
  }
  return false
}
