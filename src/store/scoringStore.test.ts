import { describe, it, expect, beforeEach } from 'vitest'
import { useScoringStore } from './scoringStore'

const STORAGE_KEY = 'nvim-arcade-scores'

describe('scoringStore', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    useScoringStore.getState().clearAll()
  })

  describe('saveResult', () => {
    it('returns true and stores a new best when no prior result exists', () => {
      const isNew = useScoringStore.getState().saveResult('editing-basics', 12, 5000, 'A')
      expect(isNew).toBe(true)
      const best = useScoringStore.getState().bests['editing-basics']
      expect(best).toBeDefined()
      expect(best.keys).toBe(12)
      expect(best.ms).toBe(5000)
      expect(best.rank).toBe('A')
    })

    it('returns true when keys are fewer than existing best', () => {
      useScoringStore.getState().saveResult('editing-basics', 15, 8000, 'B')
      const isNew = useScoringStore.getState().saveResult('editing-basics', 12, 9000, 'A')
      expect(isNew).toBe(true)
      expect(useScoringStore.getState().bests['editing-basics'].keys).toBe(12)
    })

    it('returns true when keys are equal but time is less', () => {
      useScoringStore.getState().saveResult('editing-basics', 12, 8000, 'A')
      const isNew = useScoringStore.getState().saveResult('editing-basics', 12, 5000, 'A')
      expect(isNew).toBe(true)
      expect(useScoringStore.getState().bests['editing-basics'].ms).toBe(5000)
    })

    it('returns false when keys are more than existing best', () => {
      useScoringStore.getState().saveResult('editing-basics', 12, 5000, 'A')
      const isNew = useScoringStore.getState().saveResult('editing-basics', 15, 3000, 'B')
      expect(isNew).toBe(false)
      expect(useScoringStore.getState().bests['editing-basics'].keys).toBe(12)
    })

    it('returns false when keys and time are both worse', () => {
      useScoringStore.getState().saveResult('editing-basics', 12, 5000, 'A')
      const isNew = useScoringStore.getState().saveResult('editing-basics', 12, 8000, 'A')
      expect(isNew).toBe(false)
    })

    it('increments totalCompleted on each save (not just new bests)', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S')
      useScoringStore.getState().saveResult('b', 10, 5000, 'S')
      useScoringStore.getState().saveResult('a', 8, 4000, 'S') // new best for a
      expect(useScoringStore.getState().totalCompleted).toBe(3)
    })

    it('persists to localStorage', () => {
      useScoringStore.getState().saveResult('editing-basics', 12, 5000, 'A')
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).toBeTruthy()
      const parsed = JSON.parse(raw!)
      expect(parsed.bests['editing-basics'].keys).toBe(12)
    })
  })

  describe('getStats', () => {
    it('returns zeros when no data exists', () => {
      const stats = useScoringStore.getState().getStats()
      expect(stats.total).toBe(0)
      expect(stats.sCount).toBe(0)
      expect(stats.avgEfficiency).toBe(0)
    })

    it('computes correct rank distribution', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S')
      useScoringStore.getState().saveResult('b', 10, 5000, 'S')
      useScoringStore.getState().saveResult('c', 10, 5000, 'A')
      useScoringStore.getState().saveResult('d', 10, 5000, 'B')
      useScoringStore.getState().saveResult('e', 10, 5000, 'C')
      const stats = useScoringStore.getState().getStats()
      expect(stats.total).toBe(5)
      expect(stats.sCount).toBe(2)
      expect(stats.aCount).toBe(1)
      expect(stats.bCount).toBe(1)
      expect(stats.cCount).toBe(1)
    })

    it('computes average efficiency from rank approximations', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S') // 100
      useScoringStore.getState().saveResult('b', 10, 5000, 'C') // 40
      const stats = useScoringStore.getState().getStats()
      expect(stats.avgEfficiency).toBe(70) // (100+40)/2
    })
  })

  describe('streak', () => {
    it('is 0 when no completions exist', () => {
      expect(useScoringStore.getState().streak).toBe(0)
    })

    it('is at least 1 after a completion today', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S')
      expect(useScoringStore.getState().streak).toBeGreaterThanOrEqual(1)
    })
  })

  describe('clearAll', () => {
    it('removes all stored data', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S')
      useScoringStore.getState().clearAll()
      expect(useScoringStore.getState().bests).toEqual({})
      expect(useScoringStore.getState().totalCompleted).toBe(0)
      expect(useScoringStore.getState().streak).toBe(0)
      expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy() // persists empty state
    })
  })

  describe('load', () => {
    it('rehydrates from localStorage', () => {
      useScoringStore.getState().saveResult('a', 10, 5000, 'S')
      // Simulate a fresh store instance by clearing in-memory state
      useScoringStore.setState({ bests: {}, totalCompleted: 0, streak: 0 })
      useScoringStore.getState().load()
      expect(useScoringStore.getState().bests['a']).toBeDefined()
      expect(useScoringStore.getState().bests['a'].keys).toBe(10)
    })
  })
})