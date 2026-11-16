import { useReducer } from 'react'
import type { PlayState } from './usePlay'

interface BestScoreState {
  bests: Record<string, number>
  lastCounted: unknown
}

type BestScoreAction =
  | { type: 'update'; passed: NonNullable<PlayState['passed']>; challengeId: string }

function bestScoreReducer(state: BestScoreState, action: BestScoreAction): BestScoreState {
  if (action.type === 'update') {
    const { passed, challengeId } = action
    if (passed === state.lastCounted) return state
    const existing = state.bests[challengeId]
    if (existing !== undefined && existing <= passed.keys) {
      return { bests: state.bests, lastCounted: passed }
    }
    return {
      bests: { ...state.bests, [challengeId]: passed.keys },
      lastCounted: passed,
    }
  }
  return state
}

const INITIAL_STATE: BestScoreState = { bests: {}, lastCounted: null }

/**
 * Tracks the fewest keys used per challenge this session.
 * Each solve is counted once; a retry has something to beat.
 * Uses useReducer to avoid both setState-in-effect and ref-during-render lint errors.
 */
export function useBestScoreTracking(passed: PlayState['passed'], challengeId: string | undefined) {
  const [state, dispatch] = useReducer(bestScoreReducer, INITIAL_STATE)

  // Dispatch synchronously when passed changes — useReducer dispatch during render
  // is the React-recommended pattern for deriving state from props without effects or refs.
  if (passed && challengeId) {
    dispatch({ type: 'update', passed, challengeId })
  }

  return state.bests
}