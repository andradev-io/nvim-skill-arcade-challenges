import { describe, it, expect } from 'vitest'
import type { CellType } from './types'
import { moveDirectional, wordForward, wordBackward, wordEnd, repeatWordMotion, findChar } from './motions'

// Helper to build grids concisely
function grid(rows: string[]): CellType[][] {
  return rows.map((row) =>
    row.split('').map((ch): CellType => {
      switch (ch) {
        case '#': return 'wall'
        case '.': return 'open'
        case 'S': return 'start'
        case 'G': return 'goal'
        case 'C': return 'collectible'
        case 'D': return 'door'
        case 'M': return 'marker'
        default: return 'open'
      }
    }),
  )
}

describe('moveDirectional', () => {
  const g = grid([
    '....',
    '.##.',
    '....',
  ])

  it('moves count cells in direction when unobstructed', () => {
    const result = moveDirectional(g, 0, 0, 0, 1, 3)
    expect(result).toEqual({ row: 0, col: 3 })
  })

  it('stops at wall with partial movement', () => {
    // Moving right from (1,0): hits wall at (1,1), stays at (1,0)
    const result = moveDirectional(g, 1, 0, 0, 1, 3)
    expect(result).toEqual({ row: 1, col: 0 })
  })

  it('stops at boundary', () => {
    const result = moveDirectional(g, 0, 0, -1, 0, 5)
    expect(result).toEqual({ row: 0, col: 0 })
  })

  it('moves down multiple cells', () => {
    const result = moveDirectional(g, 0, 0, 1, 0, 2)
    expect(result).toEqual({ row: 2, col: 0 })
  })

  it('count of 1 moves one cell', () => {
    const result = moveDirectional(g, 0, 0, 0, 1, 1)
    expect(result).toEqual({ row: 0, col: 1 })
  })

  it('returns same position when already blocked', () => {
    // At wall, can't move
    const wallGrid = grid(['.#.'])
    const result = moveDirectional(wallGrid, 0, 0, 0, 1, 1)
    expect(result).toEqual({ row: 0, col: 0 })
  })
})

describe('wordForward', () => {
  it('finds start of next word across wall gap', () => {
    const g = grid([
      '..#..',
    ])
    // From (0,0) which is in first word, should jump to (0,3)
    const result = wordForward(g, 0, 0)
    expect(result).toEqual({ row: 0, col: 3 })
  })

  it('advances from mid-word to next word', () => {
    const g = grid([
      '...#...',
    ])
    // From (0,1) mid-word, should skip to next word at (0,4)
    const result = wordForward(g, 0, 1)
    expect(result).toEqual({ row: 0, col: 4 })
  })

  it('returns null at end of grid', () => {
    const g = grid([
      '...',
    ])
    const result = wordForward(g, 0, 2)
    expect(result).toBeNull()
  })

  it('skips over walls to find next word', () => {
    const g = grid([
      '.###.',
    ])
    const result = wordForward(g, 0, 0)
    expect(result).toEqual({ row: 0, col: 4 })
  })

  it('works across rows in reading order', () => {
    const g = grid([
      '..#',
      '#..',
    ])
    // From (0,1), next word starts at (1,1) since (1,0) is wall
    const result = wordForward(g, 0, 1)
    expect(result).toEqual({ row: 1, col: 1 })
  })
})

describe('wordBackward', () => {
  it('goes to start of current word when mid-word', () => {
    const g = grid([
      '.....',
    ])
    const result = wordBackward(g, 0, 3)
    expect(result).toEqual({ row: 0, col: 0 })
  })

  it('goes to previous word start when at word start', () => {
    const g = grid([
      '..#..',
    ])
    // At (0,3) which is start of second word, go back to (0,0)
    const result = wordBackward(g, 0, 3)
    expect(result).toEqual({ row: 0, col: 0 })
  })

  it('returns null at beginning of grid', () => {
    const g = grid([
      '...',
    ])
    const result = wordBackward(g, 0, 0)
    expect(result).toBeNull()
  })

  it('skips walls backward to find previous word', () => {
    const g = grid([
      '.###.',
    ])
    const result = wordBackward(g, 0, 4)
    expect(result).toEqual({ row: 0, col: 0 })
  })
})

describe('wordEnd', () => {
  it('finds end of current word when mid-word', () => {
    const g = grid([
      '.....',
    ])
    const result = wordEnd(g, 0, 1)
    expect(result).toEqual({ row: 0, col: 4 })
  })

  it('finds end of next word when at end of current', () => {
    const g = grid([
      '..#...',
    ])
    // At (0,1) which is end of first word, should find end of next word at (0,5)
    const result = wordEnd(g, 0, 1)
    expect(result).toEqual({ row: 0, col: 5 })
  })

  it('returns null at end of grid', () => {
    const g = grid([
      '...',
    ])
    const result = wordEnd(g, 0, 2)
    expect(result).toBeNull()
  })

  it('handles single-cell words', () => {
    const g = grid([
      '.#.#.',
    ])
    // From (0,0), end of current word is (0,0) itself — but since next idx is wall, advance
    // Actually (0,0) is a word cell, next is wall, so we advance past and find next word end
    const result = wordEnd(g, 0, 0)
    expect(result).toEqual({ row: 0, col: 2 })
  })
})

describe('repeatWordMotion', () => {
  it('applies motion count times', () => {
    const g = grid([
      '..#..#..',
    ])
    // Two w motions from (0,0): first to (0,3), second to (0,6)
    const result = repeatWordMotion(wordForward, g, 0, 0, 2)
    expect(result).toEqual({ row: 0, col: 6 })
  })

  it('returns null if any iteration fails', () => {
    const g = grid([
      '...',
    ])
    // Only one word; second w should fail
    const result = repeatWordMotion(wordForward, g, 0, 0, 2)
    expect(result).toBeNull()
  })

  it('count of 1 applies motion once', () => {
    const g = grid([
      '..#..',
    ])
    const result = repeatWordMotion(wordForward, g, 0, 0, 1)
    expect(result).toEqual({ row: 0, col: 3 })
  })
})

describe('findChar', () => {
  const g = grid([
    '...M..',
    '..M...',
  ])
  const markers: Record<string, string> = {
    '0,3': 'a',
    '1,2': 'b',
  }

  it('finds marker matching char in reading order', () => {
    const result = findChar(g, markers, 0, 0, 'a', false)
    expect(result).toEqual({ row: 0, col: 3 })
  })

  it('finds later marker when earlier ones do not match', () => {
    const result = findChar(g, markers, 0, 0, 'b', false)
    expect(result).toEqual({ row: 1, col: 2 })
  })

  it('till variant stops one cell before target', () => {
    const result = findChar(g, markers, 0, 0, 'a', true)
    expect(result).toEqual({ row: 0, col: 2 })
  })

  it('returns null when no matching marker exists', () => {
    const result = findChar(g, markers, 0, 0, 'z', false)
    expect(result).toBeNull()
  })

  it('searches exclusively from current position', () => {
    // From (0,3) where marker 'a' is, searching for 'a' should not find itself
    const result = findChar(g, markers, 0, 3, 'a', false)
    expect(result).toBeNull()
  })

  it('till returns null when target is immediately adjacent', () => {
    // From (0,2), marker 'a' is at (0,3) — till would be (0,2) which is start
    const result = findChar(g, markers, 0, 2, 'a', true)
    expect(result).toBeNull()
  })
})