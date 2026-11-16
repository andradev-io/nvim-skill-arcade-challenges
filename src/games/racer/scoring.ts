/**
 * Scoring calculations for Vim Racer.
 * Pure functions — no side effects, no game state.
 */

/** Combo multiplier: 1x base + 5% per combo level, capped at 3x. */
export function calculateComboMultiplier(combo: number): number {
  return Math.min(3, 1 + combo * 0.05)
}

/** Speed bonus: 1x–3x based on how quickly the command was typed relative to timeout. */
export function calculateSpeedBonus(typedTimeMs: number, timeoutMs: number): number {
  if (timeoutMs <= 0) return 1
  const ratio = Math.max(0, 1 - typedTimeMs / timeoutMs)
  // Linear interpolation from 1x (at timeout) to 3x (instant)
  return 1 + ratio * 2
}

/** Final obstacle score: base points × combo multiplier × speed bonus. */
export function calculateObstacleScore(
  points: number,
  combo: number,
  speedMultiplier: number,
): number {
  const comboMult = calculateComboMultiplier(combo)
  return Math.round(points * comboMult * speedMultiplier)
}

/** Accuracy as a percentage (0–100). Returns 0 when total is 0. */
export function calculateAccuracy(cleared: number, total: number): number {
  if (total === 0) return 0
  return Math.round((cleared / total) * 100)
}