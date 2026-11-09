import { useEffect, useReducer, useRef } from 'react'
import type { RefObject } from 'react'
import { check } from '../core/compare'
import type { Challenge } from '../core/types'
import type { VimEditorHandle } from '../components/play/VimEditor'

export interface PlayState {
  keys: number
  t0: number | null
  elapsed: number
  mode: string
  passed: { keys: number; secs: number } | null
  /** Parts of the end state that still differ ("text", "cursor"). */
  miss: string[]
}

type Action =
  | { type: 'key'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'sync'; now: number; mode: string; matches: boolean; miss: string[] }

const INITIAL: PlayState = { keys: 0, t0: null, elapsed: 0, mode: 'normal', passed: null, miss: [] }

function reduce(s: PlayState, a: Action): PlayState {
  if (a.type === 'key') {
    if (s.passed) return s
    return { ...s, keys: s.keys + 1, t0: s.t0 ?? a.now }
  }
  if (a.type === 'tick') return s.t0 === null || s.passed ? s : { ...s, elapsed: (a.now - s.t0) / 1000 }
  if (s.passed) return { ...s, mode: a.mode }
  // same semantics as the plugin: end state only, and the editor must be in normal mode
  if (s.keys > 0 && a.matches && a.mode === 'normal') {
    const secs = s.t0 === null ? 0 : (a.now - s.t0) / 1000
    return { ...s, mode: a.mode, miss: [], elapsed: secs, passed: { keys: s.keys, secs } }
  }
  return { ...s, mode: a.mode, miss: a.miss }
}

/** One play session: counts keys, runs the clock from the first key, and judges the end state. */
export function usePlay(draft: Challenge, editor: RefObject<VimEditorHandle | null>) {
  const [state, dispatch] = useReducer(reduce, INITIAL)
  const latest = useRef(draft)
  useEffect(() => {
    latest.current = draft
  })

  const running = state.t0 !== null && !state.passed
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 100)
    return () => clearInterval(id)
  }, [running])

  const onKey = () => dispatch({ type: 'key', now: performance.now() })

  const onSync = () => {
    const ed = editor.current
    if (!ed) return
    const d = latest.current
    const chk = check(
      { text: d.expect.text, cursor: d.expect.cursor },
      { text: ed.text(), cursor: ed.cursor() },
      !!d.loose,
    )
    dispatch({
      type: 'sync',
      now: performance.now(),
      mode: ed.mode(),
      matches: chk.ok,
      miss: chk.parts.filter((p) => !p.ok).map((p) => p.name),
    })
  }

  return { state, onKey, onSync }
}
