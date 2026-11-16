import { describe, it, expect } from 'vitest'
import {
  calculateAccuracy,
  calculateComboMultiplier,
  calculateObstacleScore,
  calculateSpeedBonus,
} from './scoring'
import { RACER_LEVELS } from './levels'

describe('calculateComboMultiplier', () => {
  it('returns 1x at combo 0', () => {
    expect(calculateComboMultiplier(0)).toBe(1)
  })

  it('increases by 5% per combo level', () => {
    expect(calculateComboMultiplier(1)).toBeCloseTo(1.05)
    expect(calculateComboMultiplier(10)).toBeCloseTo(1.5)
    expect(calculateComboMultiplier(20)).toBeCloseTo(2.0)
  })

  it('caps at 3x', () => {
    expect(calculateComboMultiplier(40)).toBe(3)
    expect(calculateComboMultiplier(100)).toBe(3)
  })
})

describe('calculateSpeedBonus', () => {
  it('returns 3x for instant typing (0ms)', () => {
    expect(calculateSpeedBonus(0, 3000)).toBe(3)
  })

  it('returns 1x at timeout boundary', () => {
    expect(calculateSpeedBonus(3000, 3000)).toBe(1)
  })

  it('returns 2x at halfway point', () => {
    expect(calculateSpeedBonus(1500, 3000)).toBeCloseTo(2)
  })

  it('clamps to 1x when typed slower than timeout', () => {
    expect(calculateSpeedBonus(5000, 3000)).toBe(1)
  })

  it('returns 1x when timeout is 0', () => {
    expect(calculateSpeedBonus(100, 0)).toBe(1)
  })
})

describe('calculateObstacleScore', () => {
  it('base score with no combo and 1x speed', () => {
    expect(calculateObstacleScore(100, 0, 1)).toBe(100)
  })

  it('applies combo multiplier', () => {
    // combo 20 = 2x multiplier, speed 1x
    expect(calculateObstacleScore(100, 20, 1)).toBe(200)
  })

  it('applies speed bonus', () => {
    // combo 0 = 1x, speed 3x
    expect(calculateObstacleScore(100, 0, 3)).toBe(300)
  })

  it('combines both multipliers', () => {
    // combo 20 = 2x, speed 2x → 100 * 2 * 2 = 400
    expect(calculateObstacleScore(100, 20, 2)).toBe(400)
  })

  it('rounds to integer', () => {
    const result = calculateObstacleScore(33, 1, 1.5)
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('calculateAccuracy', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateAccuracy(0, 0)).toBe(0)
  })

  it('returns 100 when all cleared', () => {
    expect(calculateAccuracy(10, 10)).toBe(100)
  })

  it('returns correct percentage', () => {
    expect(calculateAccuracy(3, 4)).toBe(75)
    expect(calculateAccuracy(1, 3)).toBe(33)
  })
})

describe('RACER_LEVELS', () => {
  it('has 4 levels', () => {
    expect(RACER_LEVELS).toHaveLength(4)
  })

  it('each level has valid config', () => {
    for (const level of RACER_LEVELS) {
      expect(level.id).toBeTruthy()
      expect(level.name).toBeTruthy()
      expect(level.laneCount).toBeGreaterThanOrEqual(2)
      expect(level.laneCount).toBeLessThanOrEqual(4)
      expect(level.trackLength).toBeGreaterThan(0)
      expect(level.baseSpeed).toBeGreaterThan(0)
      expect(level.maxSpeed).toBeGreaterThan(level.baseSpeed)
      expect(level.obstacles.length).toBeGreaterThan(0)
      expect(level.parSeconds).toBeGreaterThan(0)
      expect(level.parAccuracy).toBeGreaterThan(0)
      expect(level.parAccuracy).toBeLessThanOrEqual(100)
    }
  })

  it('obstacles have valid positions within 0-1 range', () => {
    for (const level of RACER_LEVELS) {
      for (const obs of level.obstacles) {
        expect(obs.position).toBeGreaterThan(0)
        expect(obs.position).toBeLessThanOrEqual(1)
        expect(obs.command).toBeTruthy()
        expect(obs.label).toBeTruthy()
        expect(obs.points).toBeGreaterThan(0)
        expect(obs.timeoutMs).toBeGreaterThan(0)
        expect(obs.lane).toBeGreaterThanOrEqual(0)
        expect(obs.lane).toBeLessThan(level.laneCount)
      }
    }
  })

  it('obstacles are ordered by position within each level', () => {
    for (const level of RACER_LEVELS) {
      for (let i = 1; i < level.obstacles.length; i++) {
        expect(level.obstacles[i].position).toBeGreaterThanOrEqual(level.obstacles[i - 1].position)
      }
    }
  })

  it('level difficulty increases progressively', () => {
    for (let i = 1; i < RACER_LEVELS.length; i++) {
      expect(RACER_LEVELS[i].baseSpeed).toBeGreaterThan(RACER_LEVELS[i - 1].baseSpeed)
    }
  })
})