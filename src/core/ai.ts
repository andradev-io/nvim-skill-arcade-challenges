import type { Challenge } from './types'

export interface AiFilters {
  date: string
  area: string
  level: string
  ft: string
  model: string
}

export const NO_FILTERS: AiFilters = { date: '', area: '', level: '', ft: '', model: '' }

/** Challenges of the model-written collection, newest first (date, then id). */
export function sortNewest(list: Challenge[]): Challenge[] {
  return [...list].sort((a, b) => {
    const da = a.date ?? ''
    const db = b.date ?? ''
    return da === db ? a.id.localeCompare(b.id) : db.localeCompare(da)
  })
}

export const langOf = (c: Challenge): string => c.ft ?? 'text'

/** Keeps the challenges that match every filter that is set (an empty filter matches everything). */
export function filterAi(list: Challenge[], f: AiFilters): Challenge[] {
  return list.filter(
    (c) =>
      (!f.date || c.date === f.date) &&
      (!f.area || c.area === f.area) &&
      (!f.level || String(c.level) === f.level) &&
      (!f.ft || langOf(c) === f.ft) &&
      (!f.model || c.model === f.model),
  )
}

/** The distinct, sorted values of each filter, for the drop-downs (dates newest first). */
export function filterOptions(list: Challenge[]) {
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))]
  return {
    date: uniq(list.map((c) => c.date)).sort().reverse(),
    area: uniq(list.map((c) => c.area)).sort(),
    level: uniq(list.map((c) => String(c.level))).sort(),
    ft: uniq(list.map(langOf)).sort(),
    model: uniq(list.map((c) => c.model)).sort(),
  }
}

/** "v1.1:abcdef123456" -> { version: '1.1', hash: 'abcdef123456' }; null when it does not have that shape. */
export function parsePrompt(p: string | undefined): { version: string; hash: string } | null {
  const m = /^v([^:]+):([0-9a-f]+)$/.exec(p ?? '')
  return m ? { version: m[1], hash: m[2] } : null
}
