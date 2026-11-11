// Mirrors lua/skill_arcade/schema.lua so authors get instant feedback.
// The real gate is CI (schema + replay in Neovim).
import { tokens } from './keys'
import type { Challenge, Cursor, DraftForm, Expect, Forbid, Track } from './types'

export const REPO = 'andradev-io/nvim-skill-arcade-challenges'
export const AREAS = ['motions', 'textobjects', 'editing', 'search', 'macros', 'registers', 'marks', 'windows', 'quickfix', 'diagnostics', 'track', 'refactor', 'plugins']
export const FILETYPES = ['text', 'lua', 'python', 'javascript', 'typescript', 'go', 'cs', 'markdown', 'json', 'html']
export const GROUPS = ['jump', 'surround', 'textobjects', 'comment', 'picker', 'keyhints', 'files', 'bookmarks', 'trouble', 'replace', 'multicursor', 'move', 'treesitter']
export const PRESETS = ['', 'diagnostics', 'splits', 'alt_buffer', 'quickfix_hits']

const EX_ALLOWED = new Set(
  's substitute g global v vglobal m move t co copy d delete y yank j join norm normal sort noh nohlsearch tabnew copen cclose cc cn cnext cp cprev vim vimgrep only sp split vs vsplit b buffer tabclose'.split(' '),
)

export const EMPTY_FORM: DraftForm = {
  title: '', id: '', idTouched: false, area: 'motions', level: '2', brief: '', text: '', crow: '1', ccol: '0', ft: 'text',
  etext: '', erow: '', ecol: '', windows: '', layout: '', extraTabs: '', qidx: '', qsize: '', qall: '', floatText: '',
  marks: '', altBuffer: false, preset: '', presetRows: '', solution: '', why: '', hint: '', author: '',
  hgroup: '', htip: '', pluginPar: '', needs: '',
  goalRow: '', goalCol: '', checkpoints: '', forbidHjkl: false, forbidArrows: false, forbidMouse: false,
}

/** Inverse of buildChallenge: fills the form from a challenge (an example or a published one). */
export function challengeToForm(c: Partial<Challenge>): DraftForm {
  const e: Expect = c.expect ?? {}
  const num = (n: number | undefined): string => (n === undefined ? '' : String(n))
  const [hgroup, htip] = Object.entries(c.helps ?? {})[0] ?? ['', '']
  return {
    ...EMPTY_FORM,
    title: c.title ?? '',
    id: c.id ?? '',
    idTouched: !!c.id,
    area: c.area ?? 'motions',
    level: String(c.level ?? 2),
    brief: c.brief ?? '',
    text: c.text ?? '',
    crow: String(c.cursor?.[0] ?? 1),
    ccol: String(c.cursor?.[1] ?? 0),
    ft: c.ft ?? 'text',
    etext: e.text ?? '',
    erow: num(e.cursor?.[0]),
    ecol: num(e.cursor?.[1]),
    windows: num(e.windows),
    layout: e.layout ?? '',
    extraTabs: num(e.extra_tabs),
    qidx: num(e.quickfix?.idx),
    qsize: num(e.quickfix?.size),
    qall: e.quickfix?.all_contain ?? '',
    floatText: e.float_text ?? '',
    marks: Object.entries(e.marks ?? {}).map(([k, v]) => `${k}=${v}`).join(','),
    altBuffer: !!e.alt_buffer,
    preset: c.preset ?? '',
    presetRows: (c.preset_rows ?? []).join(','),
    solution: c.solution ?? '',
    why: c.why ?? '',
    hint: c.hint ?? '',
    author: c.author ?? '',
    hgroup,
    htip,
    pluginPar: num(c.plugin_par),
    needs: c.needs ?? '',
    goalRow: num(c.track?.goal[0]),
    goalCol: num(c.track?.goal[1]),
    checkpoints: formatCheckpoints(c.track?.checkpoints),
    forbidHjkl: !!c.track?.forbid?.includes('hjkl'),
    forbidArrows: !!c.track?.forbid?.includes('arrows'),
    forbidMouse: !!c.track?.forbid?.includes('mouse'),
  }
}

function exName(cmdline: string): string | null {
  let s = cmdline
  let before: string
  do {
    before = s
    s = s.replace(/^[\s\d,;%.$+-]+/, '').replace(/^'[\w<>'`[\]]/, '').replace(/^\/[^/]*\//, '')
  } while (s !== before)
  const m = s.match(/^[A-Za-z]+/)
  return m ? m[0] : null
}

/** Returns why a reference solution is not allowed, or null when it is fine. */
export function unsafeSolution(sol: string): string | null {
  if (!sol) return 'solution is required'
  if (sol.length > 120) return 'solution too long (max 120)'
  if (sol.toLowerCase().includes('<c-r>=') || sol.includes('\\=')) return 'expression evaluation is not allowed'
  if (sol.includes(':') && /[:/%\s\d,$.]!/.test(sol)) return "'!' in a command line is not allowed"
  if (sol.includes('|')) return "'|' command chaining is not allowed"
  let pos = 0
  for (;;) {
    const s = sol.indexOf(':', pos)
    if (s < 0) break
    let e = sol.indexOf('<CR>', s)
    if (e < 0) e = sol.toLowerCase().indexOf('<cr>', s)
    if (e < 0) e = sol.length
    const name = exName(sol.slice(s + 1, e))
    if (!name || !EX_ALLOWED.has(name)) {
      return `command ':${name || sol.slice(s + 1, s + 11)}' is not allowed in solutions`
    }
    pos = e + 1
  }
  return null
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

const intOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))

function parseMarks(s: string): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const raw of s.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^([a-z])\s*=\s*(\d+)$/)
    if (!m) return null
    out[m[1]] = Number(m[2])
  }
  return out
}

function parseRows(s: string): number[] | null | false {
  if (!s.trim()) return null
  const rows = s.split(',').map((x) => Number(x.trim()))
  return rows.every((n) => Number.isInteger(n) && n > 0) ? rows : false
}

function buildExpect(f: DraftForm, errors: string[]): Expect {
  const expect: Expect = {}
  const et = f.etext.replace(/\r\n/g, '\n').replace(/\n+$/, '')
  if (et !== '') expect.text = et
  const er = intOrNull(f.erow)
  const ec = intOrNull(f.ecol)
  if (er !== null) expect.cursor = ec === null ? [er] : [er, ec]
  const w = intOrNull(f.windows)
  if (w !== null) expect.windows = w
  if (f.layout === 'row' || f.layout === 'col') expect.layout = f.layout
  const xt = intOrNull(f.extraTabs)
  if (xt !== null) expect.extra_tabs = xt
  const q: NonNullable<Expect['quickfix']> = {}
  const qi = intOrNull(f.qidx)
  const qs = intOrNull(f.qsize)
  if (qi !== null) q.idx = qi
  if (qs !== null) q.size = qs
  if (f.qall) q.all_contain = f.qall
  if (Object.keys(q).length) expect.quickfix = q
  if (f.floatText) expect.float_text = f.floatText
  if (f.altBuffer) expect.alt_buffer = true
  const marks = parseMarks(f.marks)
  if (marks === null) errors.push('marks must look like a=3,b=11')
  else if (Object.keys(marks).length) expect.marks = marks
  return expect
}

export const MAX_CHECKPOINTS = 6

/** "2:3, 4:5" -> [[2,3],[4,5]]; null when the text is not a list of row:col cells. */
export function parseCheckpoints(s: string): Cursor[] | null {
  const out: Cursor[] = []
  for (const raw of s.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^(\d+)\s*:\s*(\d+)$/)
    if (!m) return null
    out.push([Number(m[1]), Number(m[2])])
  }
  return out
}

export const formatCheckpoints = (cps: Cursor[] = []): string => cps.map(([r, c]) => `${r}:${c}`).join(', ')

/** Is (row, col) a cell of the map? Rows are 1-based, columns 0-based; maps are plain ASCII. */
export function inMap(lines: string[], cell: Cursor): boolean {
  const line = lines[cell[0] - 1]
  return line !== undefined && Number.isInteger(cell[1]) && cell[1] >= 0 && cell[1] <= Math.max(0, line.length - 1)
}

/** Goal, checkpoints and key rules of a track, with the same checks as validate_track in the plugin. */
function buildTrack(f: DraftForm, text: string, start: Cursor, errors: string[]): Track | null {
  const lines = text.split('\n')
  if ([...text].some((ch) => ch.charCodeAt(0) > 127)) errors.push('track maps must be plain ASCII (columns are bytes in Neovim)')
  const gr = intOrNull(f.goalRow)
  const gc = intOrNull(f.goalCol)
  if (gr === null || gc === null) {
    errors.push('set the goal cell (row and column)')
    return null
  }
  const goal: Cursor = [gr, gc]
  if (!inMap(lines, goal)) {
    errors.push('track goal is outside the map')
    return null
  }
  const t: Track = { goal }
  const cps = parseCheckpoints(f.checkpoints)
  if (cps === null) errors.push('checkpoints must look like 2:3, 4:5 (row:col)')
  else if (cps.length) {
    const seen = new Set([`${gr}:${gc}`])
    if (cps.length > MAX_CHECKPOINTS) errors.push(`at most ${MAX_CHECKPOINTS} checkpoints`)
    for (const cp of cps) {
      if (!inMap(lines, cp)) errors.push(`checkpoint ${cp[0]}:${cp[1]} is outside the map`)
      else if (seen.has(`${cp[0]}:${cp[1]}`)) errors.push('checkpoints must be different cells, none of them the goal')
      seen.add(`${cp[0]}:${cp[1]}`)
    }
    t.checkpoints = cps
  }
  const forbid: Forbid[] = []
  if (f.forbidHjkl) forbid.push('hjkl')
  if (f.forbidArrows) forbid.push('arrows')
  if (f.forbidMouse) forbid.push('mouse')
  if (forbid.length) t.forbid = forbid
  if (start[0] === gr && start[1] === gc && !t.checkpoints) errors.push('the start cell is already the goal')
  return t
}

export interface BuildResult {
  data: Challenge
  errors: string[]
}

/** Builds the challenge JSON from the form and applies the same checks as schema.lua. */
export function buildChallenge(f: DraftForm): BuildResult {
  const errors: string[] = []
  const title = f.title.trim()
  const text = f.text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
  const lineCount = text === '' ? 0 : text.split('\n').length
  const isTrack = f.area === 'track'
  let expect: Expect = isTrack ? {} : buildExpect(f, errors)
  const c: Challenge = {
    id: f.id.trim() || slug(title),
    title,
    area: f.area,
    level: Number(f.level),
    brief: f.brief.trim(),
    text,
    cursor: [Number(f.crow || 1), Number(f.ccol || 0)],
    expect,
    solution: f.solution,
    why: f.why.trim(),
  }
  if (isTrack) {
    // like the plugin: the assertions of a track are derived (cursor on the goal, map untouched)
    const t = buildTrack(f, text, c.cursor, errors)
    if (t) {
      c.track = t
      expect = { text, cursor: [t.goal[0], t.goal[1]] }
      c.expect = expect
    }
  }
  if (f.ft !== 'text') c.ft = f.ft
  if (f.preset) c.preset = f.preset
  const rows = parseRows(f.presetRows)
  if (rows === false) errors.push('preset lines must be positive numbers like 4,9')
  else if (rows) c.preset_rows = rows
  if (f.hint.trim()) c.hint = f.hint.trim()
  if (f.author.trim()) c.author = f.author.trim()
  const pp = intOrNull(f.pluginPar)
  if (pp !== null) c.plugin_par = pp
  if (f.needs) c.needs = f.needs
  if (f.hgroup) {
    if (!f.htip.trim()) errors.push('add a tip for the plugin group')
    c.helps = { [f.hgroup]: f.htip.trim() }
  }

  if (!c.title) errors.push('title is required')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push('id must be lowercase letters, digits and dashes')
  if (!c.brief) errors.push('task description is required')
  if (!c.text) errors.push('start buffer is required')
  if (lineCount > 40) errors.push('start buffer has more than 40 lines')
  if (c.text.length > 2000 || (expect.text || '').length > 2000) errors.push('text is longer than 2000 characters')
  if (!Number.isInteger(c.cursor[0]) || c.cursor[0] < 1 || c.cursor[0] > Math.max(1, lineCount) || c.cursor[1] < 0) {
    errors.push('cursor is outside the start buffer')
  }
  if (!c.why) errors.push('explain why (shown after the round)')
  const unsafe = unsafeSolution(c.solution)
  if (unsafe) errors.push(unsafe)
  if (!Object.keys(expect).length) errors.push('set at least one expected end state')
  if (expect.text !== undefined && expect.text === text && !expect.cursor) {
    errors.push('expected text equals the start text: nothing to do')
  }
  for (const row of c.preset_rows ?? []) {
    if (row > Math.max(1, lineCount)) errors.push(`preset line ${row} is outside the text`)
  }
  if (c.preset === 'quickfix_hits' && !c.preset_rows) errors.push('quickfix_hits needs preset lines')
  return { data: c, errors }
}

/** Par = key count of the reference solution (0 when there is none). */
export const parOf = (c: Pick<Challenge, 'solution'>): number => (c.solution ? tokens(c.solution).length : 0)

export function submitUrl(data: Challenge, json: string): string {
  return (
    `https://github.com/${REPO}/new/main?filename=${encodeURIComponent(`challenges/${data.id}.json`)}` +
    `&value=${encodeURIComponent(json)}`
  )
}
export const MAX_URL = 7500
