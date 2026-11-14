import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computeStars, useCampaignStore } from './campaignStore'
import type { StarThresholds } from './campaignStore'

// Mock localStorage
const storage = new Map<string, string>()
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value) }),
  removeItem: vi.fn((key: string) => { storage.delete(key) }),
  clear: vi.fn(() => { storage.clear() }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('computeStars', () => {
  const scoreThresholds: StarThresholds = { oneStar: 100, twoStars: 200, threeStars: 300, metric: 'score' }
  const parRatioThresholds: StarThresholds = { oneStar: 1.5, twoStars: 1.0, threeStars: 0.75, metric: 'parRatio' }
  const accuracyThresholds: StarThresholds = { oneStar: 50, twoStars: 75, threeStars: 90, metric: 'accuracy' }

  it('computes stars for score metric (higher is better)', () => {
    expect(computeStars(50, scoreThresholds)).toBe(0)
    expect(computeStars(100, scoreThresholds)).toBe(1)
    expect(computeStars(150, scoreThresholds)).toBe(1)
    expect(computeStars(200, scoreThresholds)).toBe(2)
    expect(computeStars(250, scoreThresholds)).toBe(2)
    expect(computeStars(300, scoreThresholds)).toBe(3)
    expect(computeStars(500, scoreThresholds)).toBe(3)
  })

  it('computes stars for parRatio metric (lower is better)', () => {
    expect(computeStars(2.0, parRatioThresholds)).toBe(0)
    expect(computeStars(1.5, parRatioThresholds)).toBe(1)
    expect(computeStars(1.2, parRatioThresholds)).toBe(1)
    expect(computeStars(1.0, parRatioThresholds)).toBe(2)
    expect(computeStars(0.8, parRatioThresholds)).toBe(2)
    expect(computeStars(0.75, parRatioThresholds)).toBe(3)
    expect(computeStars(0.5, parRatioThresholds)).toBe(3)
  })

  it('computes stars for accuracy metric (higher is better)', () => {
    expect(computeStars(30, accuracyThresholds)).toBe(0)
    expect(computeStars(50, accuracyThresholds)).toBe(1)
    expect(computeStars(60, accuracyThresholds)).toBe(1)
    expect(computeStars(75, accuracyThresholds)).toBe(2)
    expect(computeStars(85, accuracyThresholds)).toBe(2)
    expect(computeStars(90, accuracyThresholds)).toBe(3)
    expect(computeStars(100, accuracyThresholds)).toBe(3)
  })
})

describe('useCampaignStore', () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
    useCampaignStore.getState().clearAll()
  })

  it('starts with empty progress', () => {
    const state = useCampaignStore.getState()
    expect(state.getTotalStars()).toBe(0)
    expect(state.getMaxStars()).toBe(45) // 15 stages * 3 stars
    expect(state.getCompletionPercent()).toBe(0)
  })

  it('completes a stage and updates progress', () => {
    const state = useCampaignStore.getState()
    state.completeStage('ch1-maze-l0', 100, 0.8)

    const progress = useCampaignStore.getState().progress['ch1-maze-l0']
    expect(progress).toBeDefined()
    expect(progress.status).toBe('completed')
    expect(progress.stars).toBe(2) // parRatio 0.8 <= 1.0 but > 0.75
    expect(progress.bestScore).toBe(100)
    expect(progress.attempts).toBe(1)
  })

  it('does not downgrade stars on worse attempt', () => {
    const state = useCampaignStore.getState()
    state.completeStage('ch1-maze-l0', 100, 0.7) // 3 stars
    state.completeStage('ch1-maze-l0', 50, 1.2) // would be 1 star

    const progress = useCampaignStore.getState().progress['ch1-maze-l0']
    expect(progress.stars).toBe(3) // kept at 3
    expect(progress.bestScore).toBe(100) // kept at 100
    expect(progress.attempts).toBe(2)
  })

  it('propagates unlocks via completePrevious', () => {
    const state = useCampaignStore.getState()
    // ch1-maze-l1 requires ch1-maze-l0 completed
    expect(state.isUnlocked('ch1-maze-l1')).toBe(false)

    state.completeStage('ch1-maze-l0', 100, 0.8)
    expect(state.isUnlocked('ch1-maze-l1')).toBe(true)
  })

  it('propagates unlocks via starTotal', () => {
    const state = useCampaignStore.getState()
    // ch1-gate requires 8+ total stars
    expect(state.isUnlocked('ch1-gate')).toBe(false)

    // Complete enough stages to reach 8 stars
    state.completeStage('ch1-maze-l0', 100, 0.7) // 3 stars
    state.completeStage('ch1-maze-l1', 100, 0.7) // 3 stars
    state.completeStage('ch1-rhythm-l0', 100, 90) // 3 stars = 9 total

    expect(state.isUnlocked('ch1-gate')).toBe(true)
  })

  it('initial stage is always unlocked', () => {
    const state = useCampaignStore.getState()
    expect(state.isUnlocked('ch1-maze-l0')).toBe(true)
  })

  it('persists and reloads progress', () => {
    const state = useCampaignStore.getState()
    state.completeStage('ch1-maze-l0', 100, 0.8)

    // Verify localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalled()

    // Reload
    state.load()
    const progress = useCampaignStore.getState().progress['ch1-maze-l0']
    expect(progress).toBeDefined()
    expect(progress.stars).toBe(2)
  })

  it('clears all progress', () => {
    const state = useCampaignStore.getState()
    state.completeStage('ch1-maze-l0', 100, 0.8)
    state.clearAll()

    expect(useCampaignStore.getState().getTotalStars()).toBe(0)
    expect(Object.keys(useCampaignStore.getState().progress)).toHaveLength(0)
  })

  it('calculates getTotalStars correctly', () => {
    const state = useCampaignStore.getState()
    state.completeStage('ch1-maze-l0', 100, 0.7) // 3 stars
    state.completeStage('ch1-maze-l1', 100, 1.0) // 2 stars

    expect(state.getTotalStars()).toBe(5)
  })

  it('calculates getCompletionPercent correctly', () => {
    const state = useCampaignStore.getState()
    // Max is 45 stars (15 * 3)
    state.completeStage('ch1-maze-l0', 100, 0.7) // 3 stars
    // 3/45 = 6.67% -> rounds to 7%
    expect(state.getCompletionPercent()).toBe(7)
  })

  it('handles unknown stageId gracefully', () => {
    const state = useCampaignStore.getState()
    state.completeStage('nonexistent-stage', 100, 50)
    // Should not throw or create progress entry
    expect(useCampaignStore.getState().progress['nonexistent-stage']).toBeUndefined()
  })
})