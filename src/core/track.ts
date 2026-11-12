// Track rules shared by the simulator and the Play editor. Same semantics as lua/skill_arcade/track.lua:
// a checkpoint counts when the cursor lands exactly on the NEXT one, in order.
import type { Cursor, Forbid, Track } from './types'

export const FORBID_LABEL: Record<Forbid, string> = { hjkl: 'no hjkl', arrows: 'no arrows', mouse: 'no mouse' }

/** Next checkpoint index after the cursor visited `pos` (cp = checkpoints already reached). */
export function stepTrack(t: Track, cp: number, pos: Cursor): number {
  const next = t.checkpoints?.[cp]
  return next && next[0] === pos[0] && next[1] === pos[1] ? cp + 1 : cp
}

/** Replays a list of visited cells and returns how many checkpoints were reached in order. */
export function checkpointsReached(t: Track, visited: Cursor[]): number {
  let cp = 0
  for (const v of visited) cp = stepTrack(t, cp, v)
  return cp
}

export const rulesLine = (t: Track): string => (t.forbid ?? []).map((f) => FORBID_LABEL[f]).join(', ')

export interface TrackVerdict {
  solved: boolean
  reached: number
  total: number
}

/** Solved = cursor on the goal, every checkpoint reached in order, and the map untouched. */
export function judgeTrack(t: Track, cp: number, cursor: Cursor, textSame: boolean): TrackVerdict {
  const total = t.checkpoints?.length ?? 0
  const onGoal = cursor[0] === t.goal[0] && cursor[1] === t.goal[1]
  return { solved: onGoal && cp >= total && textSame, reached: cp, total }
}

/** Advance harpoon sequence checkpoint count when the active slot matches the next expected visit. */
export function stepHarpoonSequence(seq: string[], visited: number, activeSlot: string): number {
  if (visited >= seq.length) return visited
  return seq[visited] === activeSlot ? visited + 1 : visited
}
