import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { RefObject } from 'react'
import { trackPlay } from '../analytics/track'
import { check, linesEqual } from '../core/compare'
import { judgeTrack, stepTrack } from '../core/track'
import type { Challenge, Cursor } from '../core/types'
import type { VimEditorHandle } from '../components/play/VimEditor'

export interface PlayState {
  keys: number
  t0: number | null
  elapsed: number
  mode: string
  passed: { keys: number; secs: number } | null
  /** Parts of the end state that still differ ("text", "cursor"). */
  miss: string[]
  /** Track only: checkpoints reached in order so far. */
  cp: number
  /** Track only: last forbidden key that was swallowed. */
  blocked: string | null
}

interface SyncAction {
  type: 'sync'
  now: number
  mode: string
  matches: boolean
  miss: string[]
  /** Track only: cursor after the key, and the verdict inputs. */
  track?: { cursor: Cursor; step: (cp: number) => number; solved: (cp: number) => boolean }
}

type Action =
  | { type: 'key'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'blocked'; key: string }
  | { type: 'reset' }
  | SyncAction

const INITIAL: PlayState = { keys: 0, t0: null, elapsed: 0, mode: 'normal', passed: null, miss: [], cp: 0, blocked: null }

function reduce(s: PlayState, a: Action): PlayState {
  if (a.type === 'reset') return INITIAL
  if (a.type === 'blocked') return s.passed ? s : { ...s, blocked: a.key }
  if (a.type === 'key') {
    if (s.passed) return s
    return { ...s, keys: s.keys + 1, t0: s.t0 ?? a.now }
  }
  if (a.type === 'tick') return s.t0 === null || s.passed ? s : { ...s, elapsed: (a.now - s.t0) / 1000 }
  if (s.passed) return { ...s, mode: a.mode }
  const cp = a.track ? a.track.step(s.cp) : s.cp
  // same semantics as the plugin: end state only, and the editor must be in normal mode
  const matches = a.track ? a.track.solved(cp) && a.matches : a.matches
  if (s.keys > 0 && matches && a.mode === 'normal') {
    const secs = s.t0 === null ? 0 : (a.now - s.t0) / 1000
    return { ...s, cp, mode: a.mode, miss: [], elapsed: secs, passed: { keys: s.keys, secs } }
  }
  return { ...s, cp, mode: a.mode, miss: a.miss }
}

const ARG_KEYS = new Set(['f', 'F', 't', 'T', 'r', 'm', '`', "'", '"', 'q', '@'])
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

/** One play session: counts keys, runs the clock from the first key, and judges the end state. */
export function usePlay(draft: Challenge, editor: RefObject<VimEditorHandle | null>) {
  const [state, dispatch] = useReducer(reduce, INITIAL)
  const latest = useRef(draft)
  const awaitingArg = useRef(false)
  useEffect(() => {
    latest.current = draft
  })

  // anonymous counts of started / finished plays (only published challenges are counted)
  const started = state.t0 !== null
  const finished = state.passed !== null
  useEffect(() => {
    if (started) trackPlay(latest.current.id, false)
  }, [started])
  useEffect(() => {
    if (finished) trackPlay(latest.current.id, true)
  }, [finished])

  const running = state.t0 !== null && !state.passed
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100)
    return () => clearInterval(id)
  }, [running])

  /** Called before Vim sees a key. Returns true to swallow it (a key family the track forbids). */
  const onKey = (key: string, mode: string): boolean => {
    const forbid = latest.current.track?.forbid
    if (forbid?.length && mode !== 'insert') {
      const isArg = awaitingArg.current
      const blockedKey =
        (forbid.includes('hjkl') && !isArg && key.length === 1 && 'hjkl'.includes(key)) ||
        (forbid.includes('arrows') && ARROW_KEYS.has(key))
      if (blockedKey) {
        dispatch({ type: 'blocked', key })
        return true
      }
    }
    awaitingArg.current = mode === 'normal' && !awaitingArg.current && ARG_KEYS.has(key)
    dispatch({ type: 'key', now: performance.now() })
    return false
  }

  const onSync = () => {
    const ed = editor.current
    if (!ed) return
    const d = latest.current
    const chk = check(
      { text: d.expect.text, cursor: d.expect.cursor },
      { text: ed.text(), cursor: ed.cursor() },
      !!d.loose,
    )
    const t = d.track
    dispatch({
      type: 'sync',
      now: performance.now(),
      mode: ed.mode(),
      matches: chk.ok,
      miss: chk.parts.filter((p) => !p.ok).map((p) => p.name),
      track: t
        ? {
            cursor: ed.cursor(),
            step: (cp) => stepTrack(t, cp, ed.cursor()),
            solved: (cp) => judgeTrack(t, cp, ed.cursor(), linesEqual(d.text, ed.text(), false)).solved,
          }
        : undefined,
    })
  }

  const reset = useCallback(() => {
    awaitingArg.current = false
    dispatch({ type: 'reset' })
  }, [])

  return { state, onKey, onSync, reset }
}
