import type { Challenge, Cursor, Expect } from './types'

/** A built-in challenge of the plugin, as exported at deploy time (builtin.json). */
export interface BuiltinChallenge {
  id: string
  title: string
  area: string
  level: number
  ft: string
  text: string
  cursor: Cursor
  brief: string
  /** Present when the browser can judge it: the end state is buffer text and/or the cursor. */
  expect?: { text?: string; cursor?: [number] | [number, number] }
  loose?: boolean
  par_keys?: number
  par_seconds?: number
  solution?: string
  why?: string
}

/** The score API only takes ids of lowercase letters, digits and dashes, so "refactor.ts-x" is sent as "refactor-ts-x". */
export const scoreIdOf = (id: string): string => id.replace(/\./g, '-').toLowerCase().slice(0, 64)

/** The part of the id after the area ("refactor.ts-x" -> "ts-x"), used as the buffer name. */
export const shortName = (c: Pick<BuiltinChallenge, 'id' | 'area'>): string => c.id.slice(c.area.length + 1)

/** A built-in as a playable challenge, or null when its result cannot be judged in the browser. */
export function toChallenge(b: BuiltinChallenge | undefined): Challenge | null {
  if (!b?.expect) return null
  const expect: Expect = { text: b.expect.text, cursor: b.expect.cursor }
  return {
    id: b.id,
    title: b.title,
    area: b.area,
    level: b.level,
    brief: b.brief,
    text: b.text,
    cursor: b.cursor,
    ft: b.ft,
    expect,
    solution: b.solution ?? '',
    why: b.why ?? '',
    loose: b.loose,
    par_keys: b.par_keys,
  }
}
