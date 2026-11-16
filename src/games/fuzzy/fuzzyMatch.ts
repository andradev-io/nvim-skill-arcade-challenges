import type { FuzzyEntry } from './types'

/**
 * Score how well `query` fuzzy-matches `text`.
 * Returns 0 for no match; higher values indicate better matches.
 *
 * Scoring bonuses:
 * - Base: 1 point per matched character
 * - Consecutive: +2 for each run of adjacent matched chars
 * - Word boundary: +3 when a matched char follows a separator or is at index 0
 * - Prefix: +5 when the match starts at position 0
 * - Exact (case-insensitive): +20 bonus on top of everything else
 */
export function fuzzyScore(query: string, text: string): number {
  if (query.length === 0) return 1 // empty query matches everything with minimal score
  if (query.length > text.length) return 0

  const qLower = query.toLowerCase()
  const tLower = text.toLowerCase()

  // Exact match bonus
  if (tLower === qLower) return 20 + query.length * 2

  let qi = 0
  let score = 0
  let consecutive = 0
  let firstMatchIndex = -1

  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      if (firstMatchIndex < 0) firstMatchIndex = ti

      score += 1

      // Word boundary bonus: start of string or preceded by separator
      if (ti === 0 || /[/\\._\-\s]/.test(text[ti - 1])) {
        score += 3
      }

      // Consecutive bonus
      if (consecutive > 0) {
        score += 2
      }
      consecutive++

      qi++
    } else {
      consecutive = 0
    }
  }

  // All query characters must be consumed for a valid match
  if (qi < qLower.length) return 0

  // Prefix bonus
  if (firstMatchIndex === 0) {
    score += 5
  }

  return score
}

/**
 * Filter entries by query, returning indices sorted by descending score.
 * Empty query returns all indices in original order.
 */
export function filterEntries(query: string, entries: readonly FuzzyEntry[]): number[] {
  if (query.length === 0) {
    return entries.map((_, i) => i)
  }

  const scored: Array<{ index: number; score: number }> = []
  for (let i = 0; i < entries.length; i++) {
    const s = fuzzyScore(query, entries[i].text)
    if (s > 0) {
      scored.push({ index: i, score: s })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.index)
}

/**
 * Return the set of character indices in `text` that match `query` as a subsequence.
 * Used by the renderer to highlight matched characters.
 */
export function matchPositions(query: string, text: string): number[] {
  if (query.length === 0) return []

  const qLower = query.toLowerCase()
  const tLower = text.toLowerCase()
  const positions: number[] = []
  let qi = 0

  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      positions.push(ti)
      qi++
    }
  }

  return positions.length === query.length ? positions : []
}