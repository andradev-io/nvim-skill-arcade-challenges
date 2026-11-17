import { describe, expect, it } from 'vitest'
import { fuzzyScore, filterEntries, matchPositions } from './fuzzyMatch'
import type { FuzzyEntry } from './types'

describe('fuzzyScore', () => {
  it('returns positive score for exact match', () => {
    expect(fuzzyScore('hello', 'hello')).toBeGreaterThan(0)
  })

  it('returns higher score for exact match than partial', () => {
    const exact = fuzzyScore('hello', 'hello')
    const partial = fuzzyScore('hlo', 'hello')
    expect(exact).toBeGreaterThan(partial)
  })

  it('returns positive score for prefix match', () => {
    expect(fuzzyScore('hel', 'hello')).toBeGreaterThan(0)
  })

  it('returns positive score for subsequence match', () => {
    expect(fuzzyScore('hlo', 'hello')).toBeGreaterThan(0)
  })

  it('returns 0 for no match', () => {
    expect(fuzzyScore('xyz', 'hello')).toBe(0)
  })

  it('returns 0 when query is longer than text', () => {
    expect(fuzzyScore('longquery', 'hi')).toBe(0)
  })

  it('gives bonus for consecutive matches', () => {
    const consecutive = fuzzyScore('hel', 'hello')
    const scattered = fuzzyScore('hlo', 'hello')
    expect(consecutive).toBeGreaterThan(scattered)
  })

  it('gives bonus for word boundary matches', () => {
    // 'src' matches at word boundaries in 'src/utils/format.ts'
    const boundary = fuzzyScore('sf', 'src/format.ts')
    const nonBoundary = fuzzyScore('cf', 'src/format.ts')
    expect(boundary).toBeGreaterThanOrEqual(nonBoundary)
  })

  it('gives bonus for prefix match', () => {
    const prefix = fuzzyScore('src', 'src/utils.ts')
    const mid = fuzzyScore('uti', 'src/utils.ts')
    expect(prefix).toBeGreaterThan(mid)
  })

  it('is case insensitive', () => {
    expect(fuzzyScore('HEL', 'hello')).toBeGreaterThan(0)
    expect(fuzzyScore('hel', 'Hello')).toBeGreaterThan(0)
  })

  it('returns minimal positive score for empty query', () => {
    expect(fuzzyScore('', 'anything')).toBeGreaterThan(0)
  })
})

describe('filterEntries', () => {
  const entries: FuzzyEntry[] = [
    { text: 'README.md' },
    { text: 'package.json' },
    { text: 'tsconfig.json' },
    { text: 'index.ts' },
    { text: 'utils.ts' },
  ]

  it('returns all indices for empty query in original order', () => {
    const result = filterEntries('', entries)
    expect(result).toEqual([0, 1, 2, 3, 4])
  })

  it('returns matching indices sorted by score descending', () => {
    const result = filterEntries('ts', entries)
    // tsconfig.json and index.ts and utils.ts should match
    expect(result.length).toBeGreaterThanOrEqual(3)
    // First result should be highest scoring
    expect(entries[result[0]].text).toContain('ts')
  })

  it('returns empty array when nothing matches', () => {
    const result = filterEntries('xyz', entries)
    expect(result).toEqual([])
  })

  it('exact match ranks first', () => {
    const exactEntries: FuzzyEntry[] = [
      { text: 'UserList.tsx' },
      { text: 'UserCard.tsx' },
      { text: 'UserProfile.tsx' },
    ]
    const result = filterEntries('UserProfile.tsx', exactEntries)
    expect(result[0]).toBe(2)
  })

  it('handles entries with categories', () => {
    const catEntries: FuzzyEntry[] = [
      { text: 'App.tsx', category: 'component' },
      { text: 'api.ts', category: 'service' },
    ]
    const result = filterEntries('app', catEntries)
    expect(result).toContain(0)
  })
})

describe('matchPositions', () => {
  it('returns positions of matched characters', () => {
    // Greedy left-to-right subsequence: h(0), first l(2), o(4)
    const pos = matchPositions('hlo', 'hello')
    expect(pos).toEqual([0, 2, 4])
  })

  it('returns empty array for no match', () => {
    expect(matchPositions('xyz', 'hello')).toEqual([])
  })

  it('returns empty array for empty query', () => {
    expect(matchPositions('', 'hello')).toEqual([])
  })

  it('is case insensitive', () => {
    const pos = matchPositions('HEL', 'hello')
    expect(pos).toEqual([0, 1, 2])
  })

  it('returns all positions for exact match', () => {
    const pos = matchPositions('abc', 'abc')
    expect(pos).toEqual([0, 1, 2])
  })
})