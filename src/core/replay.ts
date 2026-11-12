// APPROXIMATE interpreter for common normal-mode keys, so an author can see whether the reference solution
// reaches the expected state. It is not Neovim: unsupported keys are reported, never guessed.
// The CI replay in real Neovim stays the authority.
import { tokens } from './keys'
import { toggleLines } from '../plugins/comment'
import { findSurround, pairFor } from '../plugins/surround'
import { treesitterObjectAt } from '../plugins/textobjects'
import { findDefinition, findNextDiagnostic, findPrevDiagnostic } from '../plugins/lsp/lookup'
import type { Cursor, HarpoonConfig, JumpTargetData, LspConfig, TreesitterObjects } from './types'

export interface ReplayResult {
  text: string
  cursor: Cursor
  /** First key the interpreter could not handle, if it stopped early. */
  unsupported: string | null
  /** Cursor after every command (row 1-based, col 0-based), starting cell included. Used for track checkpoints. */
  visited: Cursor[]
  /** First key of a forbidden family (hjkl / arrows) the solution used, if any. */
  blocked: string | null
}

const ARROWS = new Set(['<Left>', '<Right>', '<Up>', '<Down>'])

interface Motion {
  o?: number
  inclusive?: boolean
  line?: number
  from?: number
}

const lit = (t: string): string => (t === '<Space>' ? ' ' : t === '<lt>' ? '<' : t)
const cls = (ch: string): number => (/\s/.test(ch) ? 0 : /\w/.test(ch) ? 2 : 1)

export function replay(text: string, cursor: Cursor, solution: string, forbid: string[] = [], ft: string = 'text', jumpTargets?: JumpTargetData[], harpoon?: HarpoonConfig, treesitterObjects?: TreesitterObjects, lspData?: LspConfig): ReplayResult & { activeSlot?: string } {
  let lines = String(text).replace(/\r\n/g, '\n').split('\n')
  let r = Math.max(0, Math.min(lines.length, cursor[0] || 1) - 1)
  let c = cursor[1] || 0
  let reg = { s: '', line: false }
  /** the yank register ("0): set by y only, a delete leaves it alone */
  let reg0 = { s: '', line: false }
  const toks = tokens(solution)
  let i = 0
  let fail: string | null = null
  let blocked: string | null = null
  const visited: Cursor[] = [[r + 1, c]]
  const marks: Record<string, Cursor> = {}
  /** Harpoon virtual slots: saved buffer snapshots keyed by slot name (a-d). */
  const hSlots: Record<string, { text: string; cursor: Cursor; ft?: string }> = {}
  let activeSlot: string | undefined
  if (harpoon) {
    for (const [name, slot] of Object.entries(harpoon.slots)) {
      hSlots[name] = { text: slot.text, cursor: slot.cursor ?? [1, 0], ft: slot.ft }
    }
  }
  const isForbidden = (k: string | undefined): boolean => {
    if (!k) return false
    if (forbid.includes('hjkl') && 'hjkl'.includes(k) && k.length === 1) return true
    return forbid.includes('arrows') && ARROWS.has(k)
  }

  const clamp = () => {
    r = Math.max(0, Math.min(lines.length - 1, r))
    c = Math.max(0, Math.min(Math.max(0, lines[r].length - 1), c))
  }
  const off = (rr: number, cc: number): number => {
    let o = 0
    for (let k = 0; k < rr; k++) o += lines[k].length + 1
    return o + cc
  }
  const pos = (o: number): [number, number] => {
    let rr = 0
    while (rr < lines.length - 1 && o > lines[rr].length) {
      o -= lines[rr].length + 1
      rr++
    }
    return [rr, o]
  }
  const flat = () => lines.join('\n')
  const setFlat = (s: string) => {
    lines = s.split('\n')
  }
  const unsupported = (what: string) => {
    fail = what
  }
  const firstNonBlank = (row: number) => Math.max(0, lines[row].search(/\S/))

  function motion(k: string, count: number, arg: string | null): Motion | null {
    const f = flat()
    const o = off(r, c)
    const L = lines[r]
    let p: number
    switch (k) {
      case 'h':
        return { o: Math.max(off(r, 0), o - count) }
      case 'l':
        return { o: Math.min(off(r, L.length), o + count) }
      case '0':
        return { o: off(r, 0) }
      case '^':
        return { o: off(r, firstNonBlank(r)) }
      case '$':
        return { o: off(r, Math.max(0, L.length - 1)), inclusive: true }
      case 'w':
      case 'W':
        p = o
        for (let n = 0; n < count; n++) {
          const c0 = cls(f[p] || ' ')
          while (p < f.length && c0 !== 0 && cls(f[p]) === c0 && f[p] !== '\n') p++
          while (p < f.length && cls(f[p]) === 0) p++
        }
        return { o: Math.min(p, f.length) }
      case 'e':
        p = o
        for (let n = 0; n < count; n++) {
          p++
          while (p < f.length && cls(f[p]) === 0) p++
          const c1 = cls(f[p] || ' ')
          while (p + 1 < f.length && cls(f[p + 1]) === c1 && c1 !== 0) p++
        }
        return { o: Math.min(p, f.length - 1), inclusive: true }
      case 'b':
        p = o
        for (let n = 0; n < count; n++) {
          p--
          while (p > 0 && cls(f[p]) === 0) p--
          const c2 = cls(f[p] || ' ')
          while (p > 0 && cls(f[p - 1]) === c2) p--
        }
        return { o: Math.max(0, p) }
      case 'j':
        return { line: Math.min(lines.length - 1, r + count), from: r }
      case 'k':
        return { line: Math.max(0, r - count), from: r }
      case '+':
        return { line: Math.min(lines.length - 1, r + count), from: r }
      case '-':
        return { line: Math.max(0, r - count), from: r }
      case '|':
        return { o: off(r, Math.min(count - 1, Math.max(0, L.length - 1))) }
      case '}':
      case '{': {
        // paragraph: next blank line in the direction (or the buffer edge)
        const dir = k === '}' ? 1 : -1
        let row = r
        for (let n = 0; n < count; n++) {
          while (row + dir >= 0 && row + dir < lines.length && lines[row].trim() === '') row += dir
          while (row + dir >= 0 && row + dir < lines.length && lines[row].trim() !== '') row += dir
          if (lines[row].trim() !== '') break
        }
        const edge = lines[row].trim() !== ''
        return { o: off(row, edge && dir === 1 ? Math.max(0, lines[row].length - 1) : 0), inclusive: edge && dir === 1 }
      }
      case '%': {
        const pairs = '()[]{}'
        let s = o
        while (s < f.length && f[s] !== '\n' && !pairs.includes(f[s])) s++
        if (s >= f.length || f[s] === '\n') return null
        const idx = pairs.indexOf(f[s])
        const open = idx % 2 === 0
        const self = f[s]
        const other = pairs[open ? idx + 1 : idx - 1]
        let depth = 0
        for (let q = s; q >= 0 && q < f.length; q += open ? 1 : -1) {
          if (f[q] === self) depth++
          else if (f[q] === other) {
            depth--
            if (depth === 0) return { o: q, inclusive: true }
          }
        }
        return null
      }
      case 'G':
        return {
          line: arg === 'none' ? lines.length - 1 : Math.min(lines.length - 1, count - 1),
          from: r,
        }
      case 'f':
      case 't':
      case 'F':
      case 'T':
        p = c
        for (let n = 0; n < count; n++) {
          if (k === 'f' || k === 't') p = L.indexOf(arg as string, p + 1)
          else p = p < 1 ? -1 : L.lastIndexOf(arg as string, p - 1)
          if (p < 0) return null
        }
        if (k === 't') p--
        if (k === 'T') p++
        return { o: off(r, p), inclusive: k === 'f' || k === 't' }
    }
    return null
  }

  function textObject(kind: string, ch: string): [number, number] | null {
    // Check treesitter objects first when available
    if (treesitterObjects) {
      const tsKeyMap: Record<string, keyof TreesitterObjects> = { f: 'function', c: 'class', s: 'statement', p: 'parameter', b: 'block', t: 'tag' }
      const tsKey = tsKeyMap[ch]
      if (tsKey) {
        const entries = treesitterObjects[tsKey]
        if (entries && entries.length) {
          const mlr = treesitterObjectAt(entries, r, c, kind === 'i')
          if (mlr) {
            return [off(mlr[0], mlr[1]), off(mlr[2], mlr[3])]
          }
        }
      }
    }
    const f = flat()
    const o = off(r, c)
    const L = lines[r]
    const base = off(r, 0)
    if (ch === 'w') {
      let s = c
      let e = c
      const k0 = cls(L[c] || ' ')
      while (s > 0 && cls(L[s - 1]) === k0) s--
      while (e < L.length && cls(L[e]) === k0) e++
      if (kind === 'a') {
        if (k0 !== 0 && L[e] === ' ') {
          while (e < L.length && cls(L[e]) === 0) e++
        } else {
          while (s > 0 && cls(L[s - 1]) === 0) s--
        }
      }
      return [base + s, base + e]
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const qs: number[] = []
      let q = -1
      while ((q = L.indexOf(ch, q + 1)) >= 0) qs.push(q)
      for (let k = 0; k + 1 < qs.length; k += 2) {
        if (c <= qs[k + 1]) {
          return kind === 'i' ? [base + qs[k] + 1, base + qs[k + 1]] : [base + qs[k], base + qs[k + 1] + 1]
        }
      }
      return null
    }
    const pairs: Record<string, string> = {
      '(': '()', ')': '()', b: '()', '[': '[]', ']': '[]', '{': '{}', '}': '{}', B: '{}', '<': '<>', '>': '<>',
    }
    const pr = pairs[ch]
    if (!pr) return null
    const open = pr[0]
    const close = pr[1]
    let depth = 0
    let s: number
    for (s = o; s >= 0; s--) {
      if (f[s] === close && s !== o) depth++
      else if (f[s] === open) {
        if (depth === 0) break
        depth--
      }
    }
    if (s < 0) return null
    depth = 0
    let e: number
    for (e = s + 1; e < f.length; e++) {
      if (f[e] === open) depth++
      else if (f[e] === close) {
        if (depth === 0) break
        depth--
      }
    }
    if (e >= f.length) return null
    return kind === 'i' ? [s + 1, e] : [s, e + 1]
  }

  const putCursor = (o: number) => {
    const p = pos(o)
    r = p[0]
    c = p[1]
    clamp()
  }

  function deleteRange(a: number, b: number, yankOnly = false) {
    const f = flat()
    reg = { s: f.slice(a, b), line: false }
    if (yankOnly) reg0 = reg
    if (!yankOnly) setFlat(f.slice(0, a) + f.slice(b))
    putCursor(a)
  }
  function deleteLines(a: number, b: number, yankOnly = false) {
    reg = { s: lines.slice(a, b + 1).join('\n'), line: true }
    if (yankOnly) reg0 = reg
    if (!yankOnly) {
      lines.splice(a, b - a + 1)
      if (!lines.length) lines = ['']
    }
    r = Math.min(a, lines.length - 1)
    if (!yankOnly) c = firstNonBlank(r)
    clamp()
  }

  function readInsert(insertAt: number) {
    const f = flat()
    let buf = ''
    while (i < toks.length && toks[i] !== '<Esc>' && toks[i] !== '<C-[>') {
      const t = toks[i++]
      if (t === '<CR>') buf += '\n'
      else if (t === '<Space>') buf += ' '
      else if (t === '<BS>') buf = buf.slice(0, -1)
      else if (t === '<C-r>') {
        const rr = toks[i++]
        if (rr === '"') buf += reg.s
        else if (rr === '0') buf += reg0.s
        else {
          unsupported('<C-r>' + rr)
          return
        }
      } else if (t.length > 1 && t[0] === '<') {
        unsupported(t)
        return
      } else buf += t
    }
    i++ // <Esc>
    setFlat(f.slice(0, insertAt) + buf + f.slice(insertAt))
    putCursor(insertAt + Math.max(0, buf.length - 1))
  }

  function readCount(): number | null {
    let n = ''
    while (i < toks.length && /^[0-9]$/.test(toks[i]) && !(n === '' && toks[i] === '0')) n += toks[i++]
    return n === '' ? null : Number(n)
  }

  function exCommand() {
    let s = ''
    while (i < toks.length && toks[i] !== '<CR>') {
      s += toks[i] === '<Space>' ? ' ' : toks[i]
      i++
    }
    i++
    // `:cmd1|cmd2` chains (a bar inside a pattern is written \|)
    const parts = s.split(/(?<!\\)\|/)
    if (parts.length > 1) {
      for (const p of parts) if (!fail) runEx(p.trim())
      return
    }
    runEx(s)
  }

  /** Vim regex (magic or \v) to a JS one: word anchors, groups, +, |, ?. null when it is not understood. */
  function vimRegex(p: string): string | null {
    let very = false
    if (p.startsWith('\\v')) {
      very = true
      p = p.slice(2)
    }
    let out = ''
    for (let k = 0; k < p.length; k++) {
      const ch = p[k]
      if (ch === '\\') {
        const n = p[++k]
        if (n === undefined) return null
        if (n === '<' || n === '>') out += '\\b'
        else if (!very && '()+|{}'.includes(n)) out += n
        else if (!very && n === '=') out += '?'
        else if (n === '/') out += '/'
        else if ('dDwWsS.*[]$^\\'.includes(n)) out += '\\' + n
        else return null
      } else if (very && (ch === '<' || ch === '>')) out += '\\b'
      else if (very && ch === '=') out += '?'
      else if (!very && '()+|{}?'.includes(ch)) out += '\\' + ch
      else out += ch
    }
    return out
  }

  /** Vim replacement to a JS one: \1 -> $1, & -> the match. null for \= expressions and line breaks. */
  function vimReplacement(p: string): string | null {
    let out = ''
    for (let k = 0; k < p.length; k++) {
      const ch = p[k]
      if (ch === '\\') {
        const n = p[++k]
        if (n && /[0-9]/.test(n)) out += '$' + n
        else if (n === '&' || n === '/' || n === '\\' || n === '#') out += n === '\\' ? '\\' : n
        else return null
      } else if (ch === '&') out += '$&'
      else if (ch === '$') out += '$$'
      else out += ch
    }
    return out
  }

  function runEx(s: string) {
    const sm = s.match(/^(%|\d+,\d+)?s([/#])((?:[^\\]|\\.)*?)\2((?:[^\\]|\\.)*?)\2([gi]*)$/)
    if (sm) {
      const pat = vimRegex(sm[3])
      const rep = vimReplacement(sm[4])
      if (pat === null || rep === null) return unsupported(':' + s)
      let re: RegExp
      try {
        re = new RegExp(pat, (sm[5].includes('g') ? 'g' : '') + (sm[5].includes('i') ? 'i' : ''))
      } catch {
        return unsupported(':' + s)
      }
      let from = r
      let to = r
      if (sm[1] === '%') {
        from = 0
        to = lines.length - 1
      } else if (sm[1]) {
        const [a, b] = sm[1].split(',').map(Number)
        from = Math.max(0, a - 1)
        to = Math.min(lines.length - 1, b - 1)
      }
      for (let k = from; k <= to; k++) lines[k] = lines[k].replace(re, rep)
      clamp()
      return
    }
    // :{n}m{target} moves line n below line target (0 = top); n and target may be $ or .
    const mv = s.match(/^(\d+|\$|\.)?m\s*(\d+|\$|\.)$/)
    if (mv) {
      const addr = (a: string | undefined): number => (a === undefined || a === '.' ? r + 1 : a === '$' ? lines.length : Number(a))
      const src = addr(mv[1])
      const dst = addr(mv[2])
      if (src < 1 || src > lines.length || dst < 0 || dst > lines.length) return unsupported(':' + s)
      if (dst === src || dst === src - 1) return
      const [moved] = lines.splice(src - 1, 1)
      const at = dst > src ? dst - 1 : dst
      lines.splice(at, 0, moved)
      r = at
      c = 0
      clamp()
      return
    }
    if (/^\d+$/.test(s)) {
      r = Number(s) - 1
      c = 0
      clamp()
      return
    }
    if (s === 'noh' || s === 'nohlsearch') return
// :Telescope is UI-only; the browser picker handles selection separately, so skip without error.
    if (/^Telescope\b/i.test(s)) return
    // :archoon add {name} — save current buffer state to a harpoon slot
    const hAdd = s.match(/^archoon\s+add\s+([a-d])$/i)
    if (hAdd) {
      const name = hAdd[1].toLowerCase()
      hSlots[name] = { text: flat(), cursor: [r + 1, c], ft }
      activeSlot = name
      return
    }
    // :archoon jump {name} — restore saved slot state
    const hJump = s.match(/^archoon\s+jump\s+([a-d])$/i)
    if (hJump) {
      const name = hJump[1].toLowerCase()
      const saved = hSlots[name]
      if (!saved) return unsupported(':' + s)
      setFlat(saved.text)
      r = Math.max(0, Math.min(lines.length - 1, (saved.cursor[0] || 1) - 1))
      c = saved.cursor[1] || 0
      clamp()
      activeSlot = name
      return
    }
    unsupported(':' + s)
  }

  function operator(t: string, cnt: number, count: number | null, L: string, o: number) {
    const cnt2 = readCount()
    const total = cnt * (cnt2 || 1)
    const k = toks[i++]
    if (k === t) {
      // dd cc yy
      const last = Math.min(lines.length - 1, r + total - 1)
      if (t === 'y') deleteLines(r, last, true)
      else if (t === 'd') deleteLines(r, last)
      else {
        reg = { s: lines.slice(r, last + 1).join('\n'), line: true }
        lines.splice(r, last - r + 1, '')
        c = 0
        readInsert(off(r, 0))
      }
      return
    }
    if (k === 'i' || k === 'a') {
      const obj = textObject(k, toks[i++])
      if (!obj) {
        unsupported(t + k + (toks[i - 1] || ''))
        return
      }
      if (t === 'y') {
        deleteRange(obj[0], obj[1], true)
        putCursor(obj[0])
      } else {
        deleteRange(obj[0], obj[1])
        if (t === 'c') readInsert(obj[0])
      }
      return
    }
    let arg: string | null = null
    if (k === 'f' || k === 't' || k === 'F' || k === 'T') arg = lit(toks[i++])
    if (k === 'G') arg = count || cnt2 ? 'n' : 'none'
    let wk = k
    if (t === 'c' && k === 'w' && /\S/.test(L[c] || ' ')) wk = 'e'
    const mo = motion(wk, total, arg)
    if (!mo) {
      unsupported(t + (k || ''))
      return
    }
    if (mo.line !== undefined) {
      const from = mo.from as number
      const a = Math.min(from, mo.line)
      const b = Math.max(from, mo.line)
      if (t === 'y') deleteLines(a, b, true)
      else if (t === 'd') deleteLines(a, b)
      else {
        reg = { s: lines.slice(a, b + 1).join('\n'), line: true }
        lines.splice(a, b - a + 1, '')
        r = a
        c = 0
        readInsert(off(r, 0))
      }
      return
    }
    let s0 = o
    let e0 = (mo.o as number) + (mo.inclusive ? 1 : 0)
    if (e0 < s0) [s0, e0] = [e0, s0]
    if (t === 'y') {
      deleteRange(s0, e0, true)
      putCursor(s0)
    } else {
      deleteRange(s0, e0)
      if (t === 'c') readInsert(s0)
    }
  }

  // NOTE: Visual mode S{char} is not supported in replay. Authors should use ys{motion}{ch}.
  function surroundOp(kind: 'add' | 'delete' | 'change', cnt: number): boolean {
    if (kind === 'add') {
      if (toks[i] === 's') {
        // yss: surround whole line (first-non-blank to end-of-line)
        i++
        const ch = toks[i++]
        if (!ch) { unsupported('yss'); return true }
        const pair = pairFor(ch)
        if (!pair) { unsupported('yss' + ch); return true }
        const f = flat()
        const fnb = off(r, firstNonBlank(r))
        const eol = off(r, lines[r].length)
        setFlat(f.slice(0, fnb) + pair.open + f.slice(fnb, eol) + pair.close + f.slice(eol))
        putCursor(fnb)
        return true
      }
      // ys[count]{motion}{ch} — read optional inner count
      const innerCount = readCount()
      const totalCnt = cnt * (innerCount || 1)
      const k = toks[i++]
      if (!k) { unsupported('ys'); return true }
      let range: [number, number] | null = null
      if (k === 'i' || k === 'a') {
        const obj = textObject(k, toks[i++])
        if (obj) range = obj
      } else {
        let arg: string | null = null
        if (k === 'f' || k === 't' || k === 'F' || k === 'T') arg = lit(toks[i++])
        const mo = motion(k, totalCnt, arg)
        if (mo && mo.o !== undefined) {
          const o = off(r, c)
          let s0 = o
          let e0 = mo.o + (mo.inclusive ? 1 : 0)
          if (e0 < s0) [s0, e0] = [e0, s0]
          range = [s0, e0]
        }
      }
      if (!range) { unsupported('ys' + k); return true }
      const ch = toks[i++]
      if (!ch) { unsupported('ys' + k); return true }
      const pair = pairFor(ch)
      if (!pair) { unsupported('ys' + k + ch); return true }
      const f = flat()
      // Trim trailing whitespace from range when surround char is unspaced (e.g. ')' not '(')
      let [rs, re] = range
      const isSpaced = pair.open.length > 1 || pair.close.length > 1
      if (!isSpaced && re > rs) {
        while (re > rs && /\s/.test(f[re - 1])) re--
      }
      setFlat(f.slice(0, rs) + pair.open + f.slice(rs, re) + pair.close + f.slice(re))
      putCursor(range[0])
      return true
    }
    if (kind === 'delete') {
      const ch = toks[i++]
      if (!ch) { unsupported('ds'); return true }
      const f = flat()
      const found = findSurround(f, off(r, c), ch)
      if (!found) { unsupported('ds' + ch); return true }
      const closeStart = found.closeAt - (found.closeLen - 1)
      setFlat(f.slice(0, found.openAt) + f.slice(found.openAt + found.openLen, closeStart) + f.slice(found.closeAt + 1))
      putCursor(found.openAt)
      return true
    }
    if (kind === 'change') {
      const oldCh = toks[i++]
      const newCh = toks[i++]
      if (!oldCh || !newCh) { unsupported('cs'); return true }
      const f = flat()
      const found = findSurround(f, off(r, c), oldCh)
      if (!found) { unsupported('cs' + oldCh); return true }
      const newPair = pairFor(newCh)
      if (!newPair) { unsupported('cs' + oldCh + newCh); return true }
      const closeStart = found.closeAt - (found.closeLen - 1)
      // Match surroundSwap in vimGlue.ts: simply replace old delimiters with new pair,
      // preserving inner text exactly as-is (no padding manipulation).
      const inner = f.slice(found.openAt + found.openLen, closeStart)
      const before = f.slice(0, found.openAt)
      const after = f.slice(found.closeAt + 1)
      setFlat(before + newPair.open + inner + newPair.close + after)
      putCursor(found.openAt)
      return true
    }
    return false
  }

  while (i < toks.length && !fail) {
    const count = readCount()
    const cnt = count || 1
    const t = toks[i++]
    if (t === undefined) break
    const o = off(r, c)
    const L = lines[r]
    let mo: Motion | null
    switch (t) {
      case '<Esc>':
        break
      case 'i':
        readInsert(o)
        break
      case 'a':
        readInsert(Math.min(o + 1, off(r, L.length)))
        break
      case 'I':
        readInsert(off(r, firstNonBlank(r)))
        break
      case 'A':
        readInsert(off(r, L.length))
        break
      case 'o':
        lines.splice(r + 1, 0, '')
        r++
        c = 0
        readInsert(off(r, 0))
        break
      case 'O':
        lines.splice(r, 0, '')
        c = 0
        readInsert(off(r, 0))
        break
      case 'x':
        deleteRange(o, Math.min(off(r, L.length), o + cnt))
        break
      case 's':
        if (jumpTargets && jumpTargets.length > 0) {
          // label-based jump: read label chars from token stream, find matching target
          let label = ''
          while (i < toks.length) {
            const ch = toks[i]
            if (ch.length !== 1 || !/[a-z;]/i.test(ch)) break
            label += ch.toLowerCase()
            i++
            const match = jumpTargets.find((t) => t.label === label)
            if (match) {
              r = match.row - 1 // row is 1-based in schema, r is 0-based internally
              c = match.col
              clamp()
              break
            }
            // check if any target starts with current prefix
            if (!jumpTargets.some((t) => t.label.startsWith(label))) break
          }
        } else {
          // substitute: delete char under cursor, enter insert mode
          deleteRange(o, Math.min(off(r, L.length), o + cnt))
          readInsert(o)
        }
        break
      case 'D':
        deleteRange(o, off(r, L.length))
        break
      case 'C':
        deleteRange(o, off(r, L.length))
        readInsert(off(r, lines[r].length))
        break
      case 'J': {
        // {n}J joins n lines (at least two)
        let joins = Math.max(2, count || 2) - 1
        while (joins-- > 0 && r + 1 < lines.length) {
          const left = lines[r].replace(/\s+$/, '')
          const next = lines[r + 1].replace(/^\s+/, '')
          lines[r] = next.startsWith(')') || next === '' ? left + next : left + ' ' + next
          lines.splice(r + 1, 1)
          c = left.length
        }
        clamp()
        break
      }
      case '<':
        // {n}<< : take one shiftwidth (8 columns, the Vim default) off the start of n lines
        if (toks[i] === '<') {
          i++
          for (let k = r; k < Math.min(lines.length, r + cnt); k++) lines[k] = lines[k].replace(/^( {1,8}|\t)/, '')
          c = firstNonBlank(r)
          clamp()
        } else unsupported('<')
        break
      case '~':
        lines[r] = L.slice(0, c) + (L[c] === L[c].toUpperCase() ? L[c].toLowerCase() : L[c].toUpperCase()) + L.slice(c + 1)
        c = Math.min(c + 1, L.length - 1)
        break
      case 'r': {
        const ch = toks[i++]
        if (ch && ch.length === 1 && L.length > c) lines[r] = L.slice(0, c) + ch + L.slice(c + 1)
        else unsupported('r' + ch)
        break
      }
      case 'p':
      case 'P':
        if (!reg.s && !reg.line) break
        if (reg.line) {
          const at = t === 'p' ? r + 1 : r
          lines.splice(at, 0, ...reg.s.split('\n'))
          r = at
          c = firstNonBlank(r)
          clamp()
        } else {
          const po = t === 'p' ? Math.min(o + 1, off(r, L.length)) : o
          const f = flat()
          setFlat(f.slice(0, po) + reg.s + f.slice(po))
          putCursor(po + reg.s.length - 1)
        }
        break
      case ':':
        exCommand()
        break
      case 'K':
        // LSP hover: no state change in replay (tooltip is UI-only)
        break
      case ']': {
        const bk = toks[i]
        if (bk === 'd' && lspData) {
          i++
          const diag = findNextDiagnostic(lspData, { line: r, ch: c })
          if (diag) {
            r = diag.row - 1
            c = diag.col
            clamp()
          }
        } else {
          unsupported(']')
        }
        break
      }
      case '[': {
        const bk2 = toks[i]
        if (bk2 === 'd' && lspData) {
          i++
          const diag = findPrevDiagnostic(lspData, { line: r, ch: c })
          if (diag) {
            r = diag.row - 1
            c = diag.col
            clamp()
          }
        } else {
          unsupported('[')
        }
        break
      }
      case 'g': {
        // NOTE: Visual mode gc is not supported in replay. Authors should use normal-mode gc{motion} or gcc.
        const gk = toks[i++]
        if (gk === 'g') {
          r = count ? Math.min(lines.length, count) - 1 : 0
          c = firstNonBlank(r)
          clamp()
        } else if (gk === 'd' && lspData) {
          // go-to-definition: move cursor to target position
          const def = findDefinition(lspData, { line: r, ch: c })
          if (def) {
            r = def.target_row - 1
            c = def.target_col
            clamp()
          }
        } else if (gk === 'c') {
          const next = toks[i]
          if (next === 'c') {
            // gcc: toggle current line (or {n}gcc for n lines)
            i++
            const cnt2 = readCount()
            const total = cnt * (cnt2 || 1)
            const last = Math.min(lines.length - 1, r + total - 1)
            const range = lines.slice(r, last + 1)
            const toggled = toggleLines(range, ft)
            lines.splice(r, last - r + 1, ...toggled)
            c = firstNonBlank(r)
            clamp()
          } else {
            // gc{motion}: consume motion tokens like operator() does
            let arg: string | null = null
            const mk = next
            i++
            if (mk === 'f' || mk === 't' || mk === 'F' || mk === 'T') arg = lit(toks[i++])
            if (mk === 'G') arg = count ? 'n' : 'none'
            let wk = mk
            const mo = motion(wk, cnt, arg)
            if (!mo) {
              unsupported('gc' + (mk || ''))
              break
            }
            let startLine: number
            let endLine: number
            if (mo.line !== undefined) {
              startLine = Math.min(r, mo.line)
              endLine = Math.max(r, mo.line)
            } else {
              const [er, ec] = pos(mo.o as number)
              startLine = Math.min(r, er)
              endLine = Math.max(r, er)
              // If motion ends at column 0 of a later line, exclude that line
              if (er > r && ec === 0) endLine = er - 1
              if (r > er && ec === 0) startLine = er + 1
            }
            if (startLine <= endLine) {
              const range = lines.slice(startLine, endLine + 1)
              const toggled = toggleLines(range, ft)
              lines.splice(startLine, endLine - startLine + 1, ...toggled)
            }
            r = startLine
            c = firstNonBlank(r)
            clamp()
          }
        } else {
          unsupported('g' + (gk || ''))
        }
        break
      }
      case 'm': {
        const name = toks[i++]
        if (name && /^[a-zA-Z]$/.test(name)) marks[name] = [r, c]
        else unsupported('m' + (name || ''))
        break
      }
      case '`':
      case "'": {
        const name = toks[i++]
        const mk = name ? marks[name] : undefined
        if (!mk) {
          unsupported(t + (name || ''))
          break
        }
        r = Math.min(mk[0], lines.length - 1)
        c = t === '`' ? mk[1] : firstNonBlank(r)
        clamp()
        break
      }
      case '/': {
        let pat = ''
        while (i < toks.length && toks[i] !== '<CR>') pat += lit(toks[i++])
        i++
        let re: RegExp
        try {
          re = new RegExp(pat, 'g')
        } catch {
          unsupported('/' + pat)
          break
        }
        const f = flat()
        re.lastIndex = o + 1
        let m = re.exec(f)
        if (!m) {
          re.lastIndex = 0
          m = re.exec(f)
        }
        if (!m) {
          unsupported('/' + pat)
          break
        }
        putCursor(m.index)
        break
      }
      case 'd':
      case 'c':
      case 'y':
        if (toks[i] === 's') {
          i++
          const kind = t === 'y' ? 'add' : t === 'd' ? 'delete' : 'change'
          surroundOp(kind, cnt)
        } else {
          if (isForbidden(toks[i])) blocked = blocked ?? toks[i]
          operator(t, cnt, count, L, o)
        }
        break
      default:
        if (isForbidden(t)) {
          blocked = blocked ?? t
          break
        }
        if (t === 'f' || t === 't' || t === 'F' || t === 'T') mo = motion(t, cnt, lit(toks[i++]))
        else if (t === 'G' && !count) mo = motion('G', 1, 'none')
        else mo = motion(t, cnt, count ? 'n' : 'none')
        if (!mo) {
          unsupported(t)
          break
        }
        if (mo.line !== undefined) {
          r = mo.line
          c = t === 'G' || t === '+' || t === '-' ? firstNonBlank(r) : Math.min(c, Math.max(0, lines[r].length - 1))
        } else putCursor(mo.o as number)
    }
    if (!fail) {
      clamp()
      visited.push([r + 1, c])
    }
  }
  return { text: lines.join('\n'), cursor: [r + 1, c], unsupported: fail, visited, blocked, activeSlot }
}
