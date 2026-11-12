import { describe, expect, it, vi } from 'vitest'
import { labelIndexes, niceMax, rate, shortDay, ticks } from '../components/admin/chartMath'
import { setPublished, shouldTrack, trackPlay, trackSession, trackView } from './track'

describe('shouldTrack', () => {
  it('respects Do Not Track and Global Privacy Control', () => {
    expect(shouldTrack({})).toBe(true)
    expect(shouldTrack({ doNotTrack: '0' })).toBe(true)
    expect(shouldTrack({ doNotTrack: '1' })).toBe(false)
    expect(shouldTrack({ globalPrivacyControl: true })).toBe(false)
  })
})

describe('tracking is quiet when it is not set up', () => {
  it('sends nothing in a test or development build', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    setPublished(['only-this-window'])
    trackView('home')
    trackPlay('only-this-window', false)
    expect(f).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('trackPlay with keys and par', () => {
  it('accepts optional keys, par and area without throwing', () => {
    setPublished(['test-challenge'])
    expect(() => trackPlay('test-challenge', true, { keys: 42, par: 10, area: 'motion' })).not.toThrow()
    expect(() => trackPlay('test-challenge', false, { area: 'motion', level: 2 })).not.toThrow()
  })

  it('ignores unpublished challenges even with extra fields', () => {
    setPublished([])
    expect(() => trackPlay('unknown', true, { keys: 5, par: 3 })).not.toThrow()
  })
})

describe('trackSession', () => {
  it('does not throw for valid durations', () => {
    expect(() => trackSession(1234)).not.toThrow()
    expect(() => trackSession(0.5)).not.toThrow()
  })

  it('silently ignores invalid durations', () => {
    expect(() => trackSession(0)).not.toThrow()
    expect(() => trackSession(-100)).not.toThrow()
    expect(() => trackSession(NaN)).not.toThrow()
    expect(() => trackSession(Infinity)).not.toThrow()
  })
})

describe('chart helpers', () => {
  it('rounds an axis maximum up to something readable', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(1)).toBe(1)
    expect(niceMax(3)).toBe(5)
    expect(niceMax(7)).toBe(8)
    expect(niceMax(9)).toBe(10)
    expect(niceMax(130)).toBe(200)
    expect(niceMax(4200)).toBe(5000)
  })

  it('never returns an axis smaller than the data', () => {
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 19, 21, 55, 99, 101, 999, 12345]) expect(niceMax(v)).toBeGreaterThanOrEqual(v)
  })

  it('makes evenly spaced ticks from zero', () => {
    expect(ticks(8)).toEqual([0, 2, 4, 6, 8])
    expect(ticks(10, 2)).toEqual([0, 5, 10])
  })

  it('picks a few labels along the time axis, always the first and the last', () => {
    expect(labelIndexes(0)).toEqual([])
    expect(labelIndexes(4)).toEqual([0, 1, 2, 3])
    const many = labelIndexes(30)
    expect(many[0]).toBe(0)
    expect(many[many.length - 1]).toBe(29)
    expect(many.length).toBeLessThanOrEqual(6)
    expect([...many].sort((a, b) => a - b)).toEqual(many)
  })

  it('formats a day and a rate', () => {
    expect(shortDay('2026-11-10')).toBe('Nov 10')
    expect(rate(1, 4)).toBe(25)
    expect(rate(0, 0)).toBeNull()
  })
})
