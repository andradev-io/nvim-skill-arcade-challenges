import { describe, expect, it } from 'vitest'
import { formatStars, parseCached } from './useStars'

describe('formatStars', () => {
  it('writes small counts in full and large ones short', () => {
    expect(formatStars(0)).toBe('0')
    expect(formatStars(1)).toBe('1')
    expect(formatStars(999)).toBe('999')
    expect(formatStars(1000)).toBe('1k')
    expect(formatStars(1234)).toBe('1.2k')
    expect(formatStars(9999)).toBe('9.9k')
    expect(formatStars(12_345)).toBe('12k')
  })
})

describe('parseCached', () => {
  const now = 1_800_000_000_000
  it('knows a fresh and a stale value', () => {
    expect(parseCached(JSON.stringify({ n: 7, at: now - 60_000 }), now)).toEqual({ n: 7, fresh: true })
    expect(parseCached(JSON.stringify({ n: 7, at: now - 2 * 3_600_000 }), now)).toEqual({ n: 7, fresh: false })
  })
  it('ignores anything that is not a saved count', () => {
    expect(parseCached(null, now)).toBeNull()
    expect(parseCached('not json', now)).toBeNull()
    expect(parseCached(JSON.stringify({ n: 'x', at: now }), now)).toBeNull()
    expect(parseCached(JSON.stringify({ n: -1, at: now }), now)).toBeNull()
    expect(parseCached(JSON.stringify({ n: 3 }), now)).toBeNull()
  })
})
