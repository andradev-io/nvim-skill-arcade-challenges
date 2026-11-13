import { describe, it, expect } from 'vitest'
import { classifyHit, computeMultiplier, PERFECT_WINDOW_MS, GOOD_WINDOW_MS } from '../scoring'

describe('classifyHit', () => {
  it('returns perfect for delta within ±50ms', () => {
    expect(classifyHit(0)).toBe('perfect')
    expect(classifyHit(50)).toBe('perfect')
    expect(classifyHit(-50)).toBe('perfect')
    expect(classifyHit(30)).toBe('perfect')
    expect(classifyHit(-49)).toBe('perfect')
  })

  it('returns good for delta within ±150ms but outside ±50ms', () => {
    expect(classifyHit(51)).toBe('good')
    expect(classifyHit(-51)).toBe('good')
    expect(classifyHit(150)).toBe('good')
    expect(classifyHit(-150)).toBe('good')
    expect(classifyHit(100)).toBe('good')
  })

  it('returns miss for delta beyond ±150ms', () => {
    expect(classifyHit(151)).toBe('miss')
    expect(classifyHit(-151)).toBe('miss')
    expect(classifyHit(300)).toBe('miss')
    expect(classifyHit(-500)).toBe('miss')
  })
})

describe('computeMultiplier', () => {
  it('returns 1 for combo 0-9', () => {
    expect(computeMultiplier(0)).toBe(1)
    expect(computeMultiplier(5)).toBe(1)
    expect(computeMultiplier(9)).toBe(1)
  })

  it('returns 2 for combo 10-19', () => {
    expect(computeMultiplier(10)).toBe(2)
    expect(computeMultiplier(15)).toBe(2)
    expect(computeMultiplier(19)).toBe(2)
  })

  it('returns 3 for combo 20-29', () => {
    expect(computeMultiplier(20)).toBe(3)
    expect(computeMultiplier(25)).toBe(3)
    expect(computeMultiplier(29)).toBe(3)
  })

  it('returns 4 for combo 30+', () => {
    expect(computeMultiplier(30)).toBe(4)
    expect(computeMultiplier(50)).toBe(4)
    expect(computeMultiplier(100)).toBe(4)
  })
})