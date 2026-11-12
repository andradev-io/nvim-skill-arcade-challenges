import type { BuiltinChallenge } from './builtin'

/** The built-ins in the order the buffer picker lists them: areas as they first appear, easiest first inside an area. */
export function orderedBuiltin(list: BuiltinChallenge[]): BuiltinChallenge[] {
  const byArea = new Map<string, BuiltinChallenge[]>()
  for (const c of list) byArea.set(c.area, [...(byArea.get(c.area) ?? []), c])
  return [...byArea.values()].flatMap((items) => [...items].sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)))
}

/** The challenge after `currentId` in picker order (same area first), or null at the end or when the id is unknown. */
export function nextChallenge(list: BuiltinChallenge[], currentId: string): BuiltinChallenge | null {
  const flat = orderedBuiltin(list)
  const at = flat.findIndex((c) => c.id === currentId)
  return at < 0 ? null : (flat[at + 1] ?? null)
}

/** 0 = no par to compare with; 3 at or under par, 2 within 1.5x par, 1 otherwise. */
export function stars(keys: number, par: number | undefined): 0 | 1 | 2 | 3 {
  if (!par || par <= 0 || keys <= 0) return 0
  if (keys <= par) return 3
  if (keys <= Math.ceil(par * 1.5)) return 2
  return 1
}

/** How close the key count is to par, 0-100 (100 = at or under par). */
export function efficiency(keys: number, par: number | undefined): number {
  if (!par || par <= 0 || keys <= 0) return 0
  return Math.min(100, Math.round((par / keys) * 100))
}

/** The text a player can paste to show a result. */
export function resultText(c: { title: string; area: string }, keys: number, secs: number, par: number | undefined, hints: number, url: string): string {
  const star = stars(keys, par)
  return [
    `nvim-skill-arcade: ${c.title} (${c.area})`,
    `${keys} keys in ${secs.toFixed(1)}s${par ? `, par ${par}` : ''}${star ? ` ${'*'.repeat(star)}` : ''}${hints ? `, ${hints} hint${hints > 1 ? 's' : ''}` : ''}`,
    url,
  ].join('\n')
}

const AREA_HINTS: Record<string, string> = {
  editing: 'Editing: an operator (d, c, y) plus a motion or text object is usually the shortest way.',
  motion: 'Motion: move with the fewest keys. Think word, line, search or character jumps, not hjkl.',
  search: 'Search: / or ? with a short pattern, then n or N, often beats counting lines.',
  refactor: 'Refactor: a substitution (:s), a macro (q) or a dot repeat (.) saves repeating yourself.',
  registers: 'Registers: yank or delete into a named register ("a) and paste from it.',
  macros: 'Macros: record once with q, then replay with @ and a count.',
}
const GENERIC_AREA = 'Think about the least keys: an operator with a text object, a search, or a repeat with `.`.'

const FAMILIES: Record<string, string> = {
  d: 'It starts with the delete operator: d plus a motion or text object.',
  c: 'It starts with the change operator: c plus a motion or text object, then type the new text.',
  y: 'It starts with the yank operator, then a paste somewhere.',
  f: 'It jumps to a character on the line with f (or t, F, T).',
  F: 'It jumps to a character on the line with f (or t, F, T).',
  t: 'It jumps to a character on the line with f (or t, F, T).',
  T: 'It jumps to a character on the line with f (or t, F, T).',
  '/': 'It searches with / and a pattern.',
  '?': 'It searches backwards with ? and a pattern.',
  w: 'It moves by words (w, b, e).',
  b: 'It moves by words (w, b, e).',
  e: 'It moves by words (w, b, e).',
  G: 'It jumps to a line (G, gg or a line number).',
  g: 'It starts with g: gg, gu, gU, gJ or similar.',
  q: 'It records a macro with q.',
  ':': 'It uses an Ex command (:s, :g, :normal ...).',
  v: 'It selects first (v, V or Ctrl-v), then acts on the selection.',
  V: 'It selects first (v, V or Ctrl-v), then acts on the selection.',
  i: 'It enters insert mode (i, a, o, I, A or O) and types.',
  a: 'It enters insert mode (i, a, o, I, A or O) and types.',
  o: 'It enters insert mode (i, a, o, I, A or O) and types.',
  O: 'It enters insert mode (i, a, o, I, A or O) and types.',
  x: 'It deletes characters with x.',
  r: 'It replaces a character with r.',
  '>': 'It indents with > or <.',
  '<': 'It indents with > or <.',
  '.': 'It repeats the last change with `.`.',
  J: 'It joins lines with J.',
  u: 'It uses undo (u) or redo (Ctrl-r).',
  '~': 'It toggles case with ~ or g~.',
}

/** The first key press of a reference solution: "ciwfoo<Esc>" -> "c", "2dd" -> "2d", "<C-v>jj" -> "<C-v>". */
export function firstKey(solution: string): string | null {
  const m = /^(?:<[^>\s]+>|\d*[^\s\d])/.exec(solution.trim())
  return m ? m[0] : null
}

/** Up to three hints, each more revealing: the area, the kind of key, the first key. */
export function hintSteps(c: { area: string; solution?: string }): string[] {
  const out = [AREA_HINTS[c.area] ?? GENERIC_AREA]
  const first = c.solution ? firstKey(c.solution) : null
  if (!first) return out
  const letter = first.replace(/^\d+/, '')
  out.push(FAMILIES[letter] ?? 'Look at the first key of the shortest solution; it is an operator or a jump.')
  out.push(`Start with \`${first}\`.`)
  return out
}

export interface DiffRow {
  kind: 'same' | 'del' | 'add'
  text: string
}

const norm = (l: string, loose: boolean) => (loose ? l.replace(/\s+$/, '').replace(/^\s+/, '') : l.replace(/\s+$/, ''))
const split = (t: string) => {
  const lines = t.replace(/\r\n/g, '\n').split('\n')
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Line diff of what the buffer holds ("del": not wanted) against the expected end state ("add": still missing). */
export function lineDiff(actual: string, expected: string, loose = false): DiffRow[] {
  const a = split(actual)
  const b = split(expected)
  const n = a.length
  const m = b.length
  if (n * m > 60000) {
    // too big for the table: compare line by line
    const rows: DiffRow[] = []
    for (let i = 0; i < Math.max(n, m); i++) {
      if (i < n && i < m && norm(a[i], loose) === norm(b[i], loose)) rows.push({ kind: 'same', text: a[i] })
      else {
        if (i < n) rows.push({ kind: 'del', text: a[i] })
        if (i < m) rows.push({ kind: 'add', text: b[i] })
      }
    }
    return rows
  }
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = norm(a[i], loose) === norm(b[j], loose) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (norm(a[i], loose) === norm(b[j], loose)) {
      rows.push({ kind: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) rows.push({ kind: 'del', text: a[i++] })
    else rows.push({ kind: 'add', text: b[j++] })
  }
  while (i < n) rows.push({ kind: 'del', text: a[i++] })
  while (j < m) rows.push({ kind: 'add', text: b[j++] })
  return rows
}

export interface VimInput {
  keyBuffer?: string[]
  prefixRepeat?: string[]
  motionRepeat?: string[]
  operator?: string | null
  registerName?: string | null
}

// the editor names the pending operator ("delete"); showcmd writes the key
const OPERATOR_KEYS: Record<string, string> = {
  delete: 'd', change: 'c', yank: 'y', indent: '>', indentLeft: '<', fold: 'zf', format: 'gq', rot13: 'g?',
  lowercase: 'gu', uppercase: 'gU', toggleCase: 'g~', join: 'J',
}

/** What Vim is waiting for, the way `showcmd` writes it: `"a2d3` ... */
export function pendingText(i: VimInput | undefined): string {
  if (!i) return ''
  return [
    i.registerName ? `"${i.registerName}` : '',
    (i.prefixRepeat ?? []).join(''),
    i.operator ? (OPERATOR_KEYS[i.operator] ?? i.operator) : '',
    (i.motionRepeat ?? []).join(''),
    (i.keyBuffer ?? []).join(''),
  ].join('')
}

export interface Matchable {
  label: string
  group?: string
}

/** Subsequence match: lower is better, null when the letters of `query` do not appear in order. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, '')
  const t = text.toLowerCase()
  if (!q) return 0
  let at = -1
  let score = 0
  for (const ch of q) {
    const found = t.indexOf(ch, at + 1)
    if (found < 0) return null
    // gaps cost, and so does starting late; a match at a word start is cheaper
    score += found - at - 1
    if (found > 0 && /[a-z0-9]/.test(t[found - 1])) score += 1
    at = found
  }
  return score + t.length / 100
}

/** The items that match, best first (stable for equal scores); no query keeps the original order. */
export function filterCommands<T extends Matchable>(list: T[], query: string, limit = 50): T[] {
  if (!query.trim()) return list.slice(0, limit)
  return list
    .map((item, order) => ({ item, order, score: fuzzyScore(query, `${item.group ?? ''} ${item.label}`) }))
    .filter((x): x is { item: T; order: number; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.item)
}
