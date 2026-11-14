import { describe, it, expect, beforeEach } from 'vitest'
import type { Direction, Position, SnakeLevel } from './types'

// Pure logic tests for snake game mechanics (no canvas/DOM dependency)

function directionDelta(dir: Direction): { dr: number; dc: number } {
  switch (dir) {
    case 'h': return { dr: 0, dc: -1 }
    case 'j': return { dr: 1, dc: 0 }
    case 'k': return { dr: -1, dc: 0 }
    case 'l': return { dr: 0, dc: 1 }
  }
}

function isOpposite(a: Direction, b: Direction): boolean {
  const opposites: Record<Direction, Direction> = { h: 'l', l: 'h', j: 'k', k: 'j' }
  return opposites[a] === b
}

function isWall(pos: Position, walls: Position[], width: number, height: number): boolean {
  if (pos.row < 0 || pos.row >= height) return true
  if (pos.col < 0 || pos.col >= width) return true
  return walls.some((w) => w.row === pos.row && w.col === pos.col)
}

function isSelfCollision(pos: Position, snake: Position[]): boolean {
  return snake.some((seg) => seg.row === pos.row && seg.col === pos.col)
}

describe('Snake Game Logic', () => {
  describe('direction deltas', () => {
    it('h moves left', () => {
      expect(directionDelta('h')).toEqual({ dr: 0, dc: -1 })
    })

    it('j moves down', () => {
      expect(directionDelta('j')).toEqual({ dr: 1, dc: 0 })
    })

    it('k moves up', () => {
      expect(directionDelta('k')).toEqual({ dr: -1, dc: 0 })
    })

    it('l moves right', () => {
      expect(directionDelta('l')).toEqual({ dr: 0, dc: 1 })
    })
  })

  describe('opposite direction blocking', () => {
    it('blocks h when moving l', () => {
      expect(isOpposite('h', 'l')).toBe(true)
    })

    it('blocks l when moving h', () => {
      expect(isOpposite('l', 'h')).toBe(true)
    })

    it('blocks j when moving k', () => {
      expect(isOpposite('j', 'k')).toBe(true)
    })

    it('blocks k when moving j', () => {
      expect(isOpposite('k', 'j')).toBe(true)
    })

    it('allows same direction', () => {
      expect(isOpposite('l', 'l')).toBe(false)
    })

    it('allows perpendicular directions', () => {
      expect(isOpposite('l', 'j')).toBe(false)
      expect(isOpposite('h', 'k')).toBe(false)
    })
  })

  describe('wall collision', () => {
    const walls: Position[] = [{ row: 2, col: 3 }]
    const width = 10
    const height = 8

    it('detects out-of-bounds top', () => {
      expect(isWall({ row: -1, col: 5 }, walls, width, height)).toBe(true)
    })

    it('detects out-of-bounds bottom', () => {
      expect(isWall({ row: 8, col: 5 }, walls, width, height)).toBe(true)
    })

    it('detects out-of-bounds left', () => {
      expect(isWall({ row: 4, col: -1 }, walls, width, height)).toBe(true)
    })

    it('detects out-of-bounds right', () => {
      expect(isWall({ row: 4, col: 10 }, walls, width, height)).toBe(true)
    })

    it('detects wall cell', () => {
      expect(isWall({ row: 2, col: 3 }, walls, width, height)).toBe(true)
    })

    it('allows open cell', () => {
      expect(isWall({ row: 4, col: 5 }, walls, width, height)).toBe(false)
    })
  })

  describe('self collision', () => {
    const snake: Position[] = [
      { row: 4, col: 5 },
      { row: 4, col: 4 },
      { row: 4, col: 3 },
    ]

    it('detects head hitting body', () => {
      expect(isSelfCollision({ row: 4, col: 4 }, snake)).toBe(true)
    })

    it('detects head hitting tail', () => {
      expect(isSelfCollision({ row: 4, col: 3 }, snake)).toBe(true)
    })

    it('allows open position', () => {
      expect(isSelfCollision({ row: 5, col: 5 }, snake)).toBe(false)
    })
  })

  describe('movement with count prefix', () => {
    it('calculates multi-step destination', () => {
      const head = { row: 4, col: 5 }
      const delta = directionDelta('j')
      const count = 3
      const dest = {
        row: head.row + delta.dr * count,
        col: head.col + delta.dc * count,
      }
      expect(dest).toEqual({ row: 7, col: 5 })
    })

    it('validates each step in count movement', () => {
      const walls: Position[] = [{ row: 6, col: 5 }]
      const width = 10
      const height = 8
      const head = { row: 4, col: 5 }
      const delta = directionDelta('j')
      const count = 3

      // Check each intermediate step
      let blocked = false
      for (let i = 1; i <= count; i++) {
        const testPos = {
          row: head.row + delta.dr * i,
          col: head.col + delta.dc * i,
        }
        if (isWall(testPos, walls, width, height)) {
          blocked = true
          break
        }
      }
      expect(blocked).toBe(true)
    })
  })

  describe('food eating and growth', () => {
    it('grows snake when food is eaten', () => {
      const snake = [
        { row: 4, col: 5 },
        { row: 4, col: 4 },
        { row: 4, col: 3 },
      ]
      const food = [{ position: { row: 4, col: 6 }, label: 'dd', tip: 'test', points: 10 }]

      // Simulate eating: new head at food position, don't remove tail
      const newHead = { row: 4, col: 6 }
      const newSnake = [newHead, ...snake]
      // Don't pop tail since food was eaten

      expect(newSnake.length).toBe(4)
      expect(newSnake[0]).toEqual(newHead)
    })

    it('maintains length when no food eaten', () => {
      const snake = [
        { row: 4, col: 5 },
        { row: 4, col: 4 },
        { row: 4, col: 3 },
      ]

      // Simulate movement without food: add head, remove tail
      const newHead = { row: 4, col: 6 }
      const newSnake = [newHead, ...snake.slice(0, -1)]

      expect(newSnake.length).toBe(3)
    })
  })

  describe('score calculation', () => {
    it('sums food points', () => {
      const foodsEaten = [
        { points: 10 },
        { points: 15 },
        { points: 5 },
      ]
      const totalPoints = foodsEaten.reduce((sum, f) => sum + f.points, 0)
      expect(totalPoints).toBe(30)
    })

    it('calculates time bonus', () => {
      const parTime = 60 // seconds
      const elapsedSeconds = 45
      const timeBonus = Math.max(0, Math.round((parTime - elapsedSeconds) * 10))
      expect(timeBonus).toBe(150)
    })

    it('clamps negative time bonus to zero', () => {
      const parTime = 60
      const elapsedSeconds = 90
      const timeBonus = Math.max(0, Math.round((parTime - elapsedSeconds) * 10))
      expect(timeBonus).toBe(0)
    })
  })

  describe('game over conditions', () => {
    it('triggers on wall collision', () => {
      const head = { row: 0, col: 5 }
      const delta = directionDelta('k') // moving up
      const newHead = { row: head.row + delta.dr, col: head.col + delta.dc }
      const walls: Position[] = []
      const width = 10
      const height = 8

      expect(isWall(newHead, walls, width, height)).toBe(true)
    })

    it('triggers on self collision', () => {
      const snake = [
        { row: 4, col: 5 },
        { row: 4, col: 6 },
        { row: 5, col: 6 },
        { row: 5, col: 5 },
      ]
      // Head tries to move into body segment
      const newHead = { row: 5, col: 5 }
      expect(isSelfCollision(newHead, snake)).toBe(true)
    })
  })
})