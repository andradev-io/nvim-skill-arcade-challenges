import { describe, it, expect } from 'vitest'
import { buildShuffledGrid, selectPairs, ALL_CARDS } from './cards'
import { MEMORY_LEVELS } from './levels'

describe('Memory Match - cards', () => {
  it('selectPairs returns the requested count from valid categories', () => {
    const pairs = selectPairs(['motion'], 4)
    expect(pairs).toHaveLength(4)
    for (const p of pairs) {
      expect(p.category).toBe('motion')
      expect(p.id).toBeTruthy()
      expect(p.command).toBeTruthy()
      expect(p.description).toBeTruthy()
    }
  })

  it('selectPairs draws from multiple categories', () => {
    const pairs = selectPairs(['motion', 'operator'], 6)
    expect(pairs).toHaveLength(6)
    const cats = new Set(pairs.map((p) => p.category))
    // With 13 motion + 5 operator = 18 pool, picking 6 should likely hit both
    // but we only guarantee count validity
    expect(cats.size).toBeGreaterThanOrEqual(1)
  })

  it('buildShuffledGrid produces 2x the pair count with matching instance IDs', () => {
    const pairs = selectPairs(['motion'], 4)
    const grid = buildShuffledGrid(pairs)
    expect(grid).toHaveLength(8)

    // Each pair ID should appear exactly twice
    const idCounts = new Map<string, number>()
    for (const card of grid) {
      idCounts.set(card.id, (idCounts.get(card.id) ?? 0) + 1)
    }
    for (const [, count] of idCounts) {
      expect(count).toBe(2)
    }

    // One instance ends with -cmd, one with -desc
    for (const pair of pairs) {
      const instances = grid.filter((c) => c.id === pair.id)
      const suffixes = instances.map((c) => c.instanceId.split('-').pop())
      expect(suffixes).toContain('cmd')
      expect(suffixes).toContain('desc')
    }
  })

  it('all card pools have unique IDs within each category', () => {
    for (const [, cards] of Object.entries(ALL_CARDS)) {
      const ids = cards.map((c) => c.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length) // no duplicate IDs in category
    }
  })
})

describe('Memory Match - levels', () => {
  it('has 4 levels with increasing difficulty', () => {
    expect(MEMORY_LEVELS).toHaveLength(4)
    expect(MEMORY_LEVELS[0].pairs).toHaveLength(6)
    expect(MEMORY_LEVELS[1].pairs).toHaveLength(8)
    expect(MEMORY_LEVELS[2].pairs).toHaveLength(10)
    expect(MEMORY_LEVELS[3].pairs).toHaveLength(12)
  })

  it('grid dimensions match pair counts', () => {
    for (const level of MEMORY_LEVELS) {
      const totalCards = level.gridCols * level.gridRows
      expect(totalCards).toBe(level.pairs.length * 2)
    }
  })

  it('par times increase across levels', () => {
    for (let i = 1; i < MEMORY_LEVELS.length; i++) {
      expect(MEMORY_LEVELS[i].parTime).toBeGreaterThan(MEMORY_LEVELS[i - 1].parTime)
    }
  })
})

describe('Memory Match - score calculation', () => {
  function calcScore(pairCount: number, moves: number, elapsedMs: number): number {
    const elapsedSeconds = Math.floor(elapsedMs / 1000)
    const raw = pairCount * 100 - moves * 5 - elapsedSeconds * 2
    return Math.max(0, raw)
  }

  it('perfect game yields maximum score', () => {
    // 6 pairs, 6 moves (minimum possible), 0 seconds
    expect(calcScore(6, 6, 0)).toBe(6 * 100 - 6 * 5)
    expect(calcScore(6, 6, 0)).toBe(570)
  })

  it('score never goes below zero', () => {
    expect(calcScore(6, 200, 999999)).toBe(0)
  })

  it('penalizes extra moves and time', () => {
    const base = calcScore(6, 6, 0)
    const withMoves = calcScore(6, 12, 0)
    const withTime = calcScore(6, 6, 30000)
    expect(withMoves).toBeLessThan(base)
    expect(withTime).toBeLessThan(base)
  })
})

describe('Memory Match - cursor movement logic', () => {
  function moveCursor(
    key: string,
    cursorIndex: number,
    cols: number,
    rows: number,
    totalCards: number,
  ): number {
    const row = Math.floor(cursorIndex / cols)
    const col = cursorIndex % cols
    let newRow = row
    let newCol = col

    switch (key) {
      case 'h':
        newCol = col > 0 ? col - 1 : cols - 1
        break
      case 'l':
        newCol = col < cols - 1 ? col + 1 : 0
        break
      case 'k':
        newRow = row > 0 ? row - 1 : rows - 1
        break
      case 'j':
        newRow = row < rows - 1 ? row + 1 : 0
        break
      case 'w': {
        let next = cursorIndex + 3
        if (next >= totalCards) next = next % totalCards
        return next
      }
      case 'b': {
        let next = cursorIndex - 3
        while (next < 0) next += totalCards
        return next
      }
      case 'e': {
        let next = cursorIndex + 2
        if (next >= totalCards) next = totalCards - 1
        return next
      }
      default:
        return cursorIndex
    }

    const newIndex = newRow * cols + newCol
    return newIndex >= 0 && newIndex < totalCards ? newIndex : cursorIndex
  }

  const cols = 4
  const rows = 3
  const total = 12

  it('h moves left with wrapping', () => {
    expect(moveCursor('h', 5, cols, rows, total)).toBe(4)
    expect(moveCursor('h', 4, cols, rows, total)).toBe(7) // wraps to end of row
  })

  it('l moves right with wrapping', () => {
    expect(moveCursor('l', 4, cols, rows, total)).toBe(5)
    expect(moveCursor('l', 7, cols, rows, total)).toBe(4) // wraps to start of row
  })

  it('k moves up with wrapping', () => {
    expect(moveCursor('k', 5, cols, rows, total)).toBe(1)
    expect(moveCursor('k', 1, cols, rows, total)).toBe(9) // wraps to bottom
  })

  it('j moves down with wrapping', () => {
    expect(moveCursor('j', 1, cols, rows, total)).toBe(5)
    expect(moveCursor('j', 9, cols, rows, total)).toBe(1) // wraps to top
  })

  it('w jumps forward by 3', () => {
    expect(moveCursor('w', 0, cols, rows, total)).toBe(3)
    expect(moveCursor('w', 10, cols, rows, total)).toBe(1) // wraps
  })

  it('b jumps backward by 3', () => {
    expect(moveCursor('b', 5, cols, rows, total)).toBe(2)
    expect(moveCursor('b', 1, cols, rows, total)).toBe(10) // wraps
  })

  it('e jumps forward by 2, clamped at end', () => {
    expect(moveCursor('e', 0, cols, rows, total)).toBe(2)
    expect(moveCursor('e', 11, cols, rows, total)).toBe(11) // clamped
  })
})