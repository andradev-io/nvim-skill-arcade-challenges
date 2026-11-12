import { describe, it, expect, beforeEach } from 'vitest'
import { useArcadeStore } from './arcadeStore'

const STORAGE_KEY = 'nvim-arcade-highscores'

describe('arcadeStore', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    useArcadeStore.getState().clearAll()
  })

  it('saves and retrieves a high score', () => {
    const state = useArcadeStore.getState()
    const isNew = state.saveScore('maze', 1, 500)
    expect(isNew).toBe(true)
    expect(state.getBest('maze', 1)).toBe(500)
  })

  it('returns false when score is not better', () => {
    const state = useArcadeStore.getState()
    state.saveScore('maze', 1, 500)
    const isNew = state.saveScore('maze', 1, 400)
    expect(isNew).toBe(false)
    expect(state.getBest('maze', 1)).toBe(500)
  })

  it('updates when new score is higher', () => {
    const state = useArcadeStore.getState()
    state.saveScore('maze', 1, 500)
    const isNew = state.saveScore('maze', 1, 600)
    expect(isNew).toBe(true)
    expect(state.getBest('maze', 1)).toBe(600)
  })

  it('returns null for unsaved game+level', () => {
    const state = useArcadeStore.getState()
    expect(state.getBest('maze', 1)).toBeNull()
    expect(state.getBest('rhythm', 1)).toBeNull()
  })

  it('persists across store reload', () => {
    const state = useArcadeStore.getState()
    state.saveScore('maze', 2, 750)

    // Simulate reload by reading from localStorage directly
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.highScores['maze-2'].score).toBe(750)

    // Reload store
    state.load()
    expect(state.getBest('maze', 2)).toBe(750)
  })

  it('clears all scores', () => {
    const state = useArcadeStore.getState()
    state.saveScore('maze', 1, 500)
    state.saveScore('maze', 2, 600)
    state.clearAll()

    expect(state.getBest('maze', 1)).toBeNull()
    expect(state.getBest('maze', 2)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json{{{')
    const state = useArcadeStore.getState()
    state.load()
    expect(state.getBest('maze', 1)).toBeNull()
  })
})