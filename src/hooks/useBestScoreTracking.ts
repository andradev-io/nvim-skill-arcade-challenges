import { useEffect, useState } from 'react'
import type { PlayState } from './usePlay'

/**
 * Tracks the fewest keys used per challenge this session.
 * Each solve is counted once; a retry has something to beat.
 */
export function useBestScoreTracking(passed: PlayState['passed'], challengeId: string | undefined) {
  const [bests, setBests] = useState<Record<string, number>>({})
  const [counted, setCounted] = useState<unknown>(null)

  useEffect(() => {
    if (passed && passed !== counted) {
      setCounted(passed)
      if (challengeId && !(bests[challengeId] && bests[challengeId] <= passed.keys)) {
        setBests((prev) => ({ ...prev, [challengeId]: passed.keys }))
      }
    }
  }, [passed, counted, challengeId, bests])

  return bests
}