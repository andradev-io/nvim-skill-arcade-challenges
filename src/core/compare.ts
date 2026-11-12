import type { Expect, HarpoonConfig, State } from './types'

function trimLines(text: string, loose: boolean): string[] {
  const out = String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => {
      const t = l.replace(/\s+$/, '')
      return loose ? t.replace(/^\s+/, '') : t
    })
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

/** Same comparison as `catalog.lines_equal` in the plugin. */
export function linesEqual(a: string, b: string, loose = false): boolean {
  const x = trimLines(a, loose)
  const y = trimLines(b, loose)
  return x.length === y.length && x.every((l, i) => l === y[i])
}

export interface CheckPart {
name: 'text' | 'cursor' | 'picker_selected' | 'marks'
  ok: boolean
}
export interface CheckResult {
  ok: boolean
  parts: CheckPart[]
}

/** End-state check for the assertions the browser can judge (buffer text, cursor, picker selection, marks). */
export function check(
  expect: Pick<Expect, 'text' | 'cursor' | 'marks'> & { picker_selected?: number | string },
  state: State & { pickerSelection?: number | string | null; marks?: Record<string, number> },
  loose = false,
): CheckResult {
  const parts: CheckPart[] = []
  let ok = true
  if (expect.text !== undefined) {
    const t = linesEqual(state.text, expect.text, loose)
    parts.push({ name: 'text', ok: t })
    ok = ok && t
  }
  if (expect.cursor) {
    const c =
      state.cursor[0] === expect.cursor[0] &&
      (expect.cursor[1] === undefined || state.cursor[1] === expect.cursor[1])
    parts.push({ name: 'cursor', ok: c })
    ok = ok && c
  }
if (expect.picker_selected !== undefined) {
    const sel = state.pickerSelection
    const p = sel !== null && sel !== undefined && sel === expect.picker_selected
    parts.push({ name: 'picker_selected', ok: p })
    ok = ok && p
  }
  if (expect.marks) {
    const sm = state.marks ?? {}
    let mOk = true
    for (const [k, v] of Object.entries(expect.marks)) {
      if (sm[k] !== v) { mOk = false; break }
    }
    parts.push({ name: 'marks', ok: mOk })
    ok = ok && mOk
  }
  if (!parts.length) ok = false
  return { ok, parts }
}

/** The browser can judge text, cursor, picker selection and marks; the rest needs real Neovim. */
export const BROWSER_KEYS = ['text', 'cursor', 'picker_selected', 'marks'] as const

export function neovimOnlyKeys(expect: Expect): string[] {
  return Object.keys(expect).filter((k) => !(BROWSER_KEYS as readonly string[]).includes(k))
}

export function isPlayable(c: { text?: string; expect?: Expect }): boolean {
  const e = c.expect
  return !!(e && (e.text !== undefined || e.cursor) && c.text)
}
