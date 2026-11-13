import type { HitGrade } from './types'

export const PERFECT_WINDOW_MS = 50
export const GOOD_WINDOW_MS = 150

export function classifyHit(deltaMs: number): HitGrade {
  const absDelta = Math.abs(deltaMs)
  if (absDelta <= PERFECT_WINDOW_MS) return 'perfect'
  if (absDelta <= GOOD_WINDOW_MS) return 'good'
  return 'miss'
}

export function computeMultiplier(combo: number): number {
  if (combo >= 30) return 4
  if (combo >= 20) return 3
  if (combo >= 10) return 2
  return 1
}

export const BASE_POINTS: Record<HitGrade, number> = {
  perfect: 100,
  good: 50,
  miss: 0,
}