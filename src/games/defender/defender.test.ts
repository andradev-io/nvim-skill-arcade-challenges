import { describe, it, expect } from 'vitest'
import { findMatch, splitCommand } from './matching'
import { WAVE_CONFIGS } from './waves'
import type { Enemy } from './types'

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 0,
    command: 'h',
    tokens: ['h'],
    typedCount: 0,
    x: 100,
    y: 100,
    speed: 30,
    alive: true,
    ...overrides,
  }
}

describe('findMatch', () => {
  it('returns null for empty buffer', () => {
    const enemies = [makeEnemy()]
    expect(findMatch([], enemies)).toBeNull()
  })

  it('matches single-char command', () => {
    const enemies = [makeEnemy({ id: 1, command: 'h', tokens: ['h'], x: 200 })]
    const result = findMatch(['h'], enemies)
    expect(result).toEqual({ enemyId: 1, fullMatch: true })
  })

  it('returns partial match for multi-token command', () => {
    const enemies = [makeEnemy({ id: 2, command: 'dw', tokens: ['d', 'w'], x: 300 })]
    const result = findMatch(['d'], enemies)
    expect(result).toEqual({ enemyId: 2, fullMatch: false })
  })

  it('prefers full match over partial', () => {
    const enemies = [
      makeEnemy({ id: 1, command: 'd', tokens: ['d'], x: 400 }),
      makeEnemy({ id: 2, command: 'dw', tokens: ['d', 'w'], x: 200 }),
    ]
    const result = findMatch(['d'], enemies)
    // 'd' fully matches enemy 1, even though enemy 2 is closer
    expect(result).toEqual({ enemyId: 1, fullMatch: true })
  })

  it('picks leftmost among equal matches', () => {
    const enemies = [
      makeEnemy({ id: 1, command: 'h', tokens: ['h'], x: 500 }),
      makeEnemy({ id: 2, command: 'h', tokens: ['h'], x: 200 }),
    ]
    const result = findMatch(['h'], enemies)
    expect(result).toEqual({ enemyId: 2, fullMatch: true })
  })

  it('excludes dead enemies', () => {
    const enemies = [
      makeEnemy({ id: 1, command: 'h', tokens: ['h'], x: 100, alive: false }),
      makeEnemy({ id: 2, command: 'h', tokens: ['h'], x: 300, alive: true }),
    ]
    const result = findMatch(['h'], enemies)
    expect(result).toEqual({ enemyId: 2, fullMatch: true })
  })

  it('returns null when no enemy matches', () => {
    const enemies = [makeEnemy({ command: 'j', tokens: ['j'] })]
    expect(findMatch(['h'], enemies)).toBeNull()
  })
})

describe('splitCommand', () => {
  it('splits simple commands into individual chars', () => {
    expect(splitCommand('dw')).toEqual(['d', 'w'])
  })

  it('handles special key notation', () => {
    expect(splitCommand('ci"')).toEqual(['c', 'i', '"'])
  })
})

describe('scoring', () => {
  function killScore(streak: number): number {
    const multiplier = Math.min(3, 1 + streak * 0.1)
    return Math.round(100 * multiplier)
  }

  function waveClearBonus(wave: number): number {
    return 500 * wave
  }

  it('killScore at streak 0 is 100', () => {
    expect(killScore(0)).toBe(100)
  })

  it('killScore at streak 10 is 200', () => {
    expect(killScore(10)).toBe(200)
  })

  it('killScore caps at 3x (300)', () => {
    expect(killScore(20)).toBe(300)
    expect(killScore(50)).toBe(300)
  })

  it('waveClearBonus for wave 3 is 1500', () => {
    expect(waveClearBonus(3)).toBe(1500)
  })
})

describe('wave configs', () => {
  it('has 5 waves', () => {
    expect(WAVE_CONFIGS).toHaveLength(5)
  })

  it('each wave has valid config', () => {
    for (const config of WAVE_CONFIGS) {
      expect(config.commands.length).toBeGreaterThan(0)
      expect(config.enemyCount).toBeGreaterThan(0)
      expect(config.spawnIntervalMs).toBeGreaterThan(0)
      expect(config.baseSpeed).toBeGreaterThan(0)
      expect(config.speedVariance).toBeGreaterThanOrEqual(0)
    }
  })

  it('wave numbers are sequential starting from 1', () => {
    for (let i = 0; i < WAVE_CONFIGS.length; i++) {
      expect(WAVE_CONFIGS[i].wave).toBe(i + 1)
    }
  })
})