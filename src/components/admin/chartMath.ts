/** Small helpers for the admin charts, kept free of React so they can be tested. */

/** A round upper bound for an axis: 0 -> 1, 7 -> 8, 130 -> 200, 4200 -> 5000. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  const f = max / exp
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  const top = step * exp
  // 7 -> 8 reads better than 7 -> 10: allow halves of the step for small values
  if (step === 10 && max <= 8 * exp) return 8 * exp
  return top
}

/** Evenly spaced tick values from 0 to `top`, `count` intervals. */
export function ticks(top: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i)
}

/** Which labels to show on a time axis of `n` points: first, last and a few between, never more than `max`. */
export function labelIndexes(n: number, max = 6): number[] {
  if (n <= 0) return []
  if (n <= max) return Array.from({ length: n }, (_, i) => i)
  const out = new Set<number>([0, n - 1])
  for (let i = 1; i < max - 1; i += 1) out.add(Math.round((i * (n - 1)) / (max - 1)))
  return [...out].sort((a, b) => a - b)
}

/** `2026-11-10` -> `Nov 10`. */
export function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** `completed / started` as a whole percent, or null when nothing was started. */
export function rate(completed: number, started: number): number | null {
  return started > 0 ? Math.round((completed / started) * 100) : null
}
