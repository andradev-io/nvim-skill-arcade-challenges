import type { CellType } from './types'

/**
 * Move up to `count` cells in direction (dr, dc), stopping at first wall or boundary.
 * Partial movement is allowed — returns the last valid position before obstruction.
 */
export function moveDirectional(
  grid: CellType[][],
  row: number,
  col: number,
  dr: number,
  dc: number,
  count: number,
): { row: number; col: number } {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  let r = row
  let c = col

  for (let i = 0; i < count; i++) {
    const nr = r + dr
    const nc = c + dc
    if (nr < 0 || nr >= height || nc < 0 || nc >= width) break
    if (grid[nr][nc] === 'wall') break
    r = nr
    c = nc
  }

  return { row: r, col: c }
}

/**
 * Flatten a 2D grid position to a 1D index in row-major order.
 */
function toIndex(width: number, row: number, col: number): number {
  return row * width + col
}

/**
 * Convert a 1D index back to row/col.
 */
function fromIndex(width: number, index: number): { row: number; col: number } {
  return { row: Math.floor(index / width), col: index % width }
}

/**
 * Check if a cell is non-wall (i.e., part of a "word").
 */
function isWordCell(grid: CellType[][], row: number, col: number): boolean {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  if (row < 0 || row >= height || col < 0 || col >= width) return false
  return grid[row][col] !== 'wall'
}

/**
 * Find start of NEXT word in reading order (row-major).
 * A word is a maximal contiguous run of non-wall cells in the flattened grid.
 * Returns null if no next word exists.
 */
export function wordForward(
  grid: CellType[][],
  row: number,
  col: number,
): { row: number; col: number } | null {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const total = height * width
  let idx = toIndex(width, row, col)

  // If currently on a word cell, skip past the end of this word
  if (isWordCell(grid, row, col)) {
    while (idx < total && isWordCell(grid, Math.floor(idx / width), idx % width)) {
      idx++
    }
  }

  // Now find the start of the next word
  while (idx < total && !isWordCell(grid, Math.floor(idx / width), idx % width)) {
    idx++
  }

  if (idx >= total) return null
  return fromIndex(width, idx)
}

/**
 * Find start of previous word, or current word start if mid-word.
 * Returns null if at beginning of grid with no prior word.
 */
export function wordBackward(
  grid: CellType[][],
  row: number,
  col: number,
): { row: number; col: number } | null {
  const width = grid[0]?.length ?? 0
  let idx = toIndex(width, row, col)

  // If currently on a word cell and not at the start of that word, go to word start
  if (isWordCell(grid, row, col)) {
    const prevIdx = idx - 1
    if (prevIdx >= 0 && isWordCell(grid, Math.floor(prevIdx / width), prevIdx % width)) {
      // We're mid-word or at end of word; walk backward to find word start
      while (idx > 0 && isWordCell(grid, Math.floor((idx - 1) / width), (idx - 1) % width)) {
        idx--
      }
      // If we moved, this is the start of the current word
      if (idx < toIndex(width, row, col)) {
        return fromIndex(width, idx)
      }
      // Otherwise we were already at word start; fall through to find previous word
    } else {
      // Already at word start; fall through to find previous word
    }
  }

  // Skip backward over non-word cells
  while (idx > 0 && !isWordCell(grid, Math.floor((idx - 1) / width), (idx - 1) % width)) {
    idx--
  }

  // Now find the start of this word by walking backward
  while (idx > 0 && isWordCell(grid, Math.floor((idx - 1) / width), (idx - 1) % width)) {
    idx--
  }

  if (idx <= 0 && !isWordCell(grid, 0, 0)) return null
  if (idx < 0) return null
  return fromIndex(width, idx)
}

/**
 * Find end of current or next word.
 * Returns null if at end of grid.
 */
export function wordEnd(
  grid: CellType[][],
  row: number,
  col: number,
): { row: number; col: number } | null {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const total = height * width
  let idx = toIndex(width, row, col)

  // If currently on a word cell, check if there's more of this word ahead
  if (isWordCell(grid, row, col)) {
    const nextIdx = idx + 1
    if (nextIdx < total && isWordCell(grid, Math.floor(nextIdx / width), nextIdx % width)) {
      // Walk forward to find end of current word
      while (idx + 1 < total && isWordCell(grid, Math.floor((idx + 1) / width), (idx + 1) % width)) {
        idx++
      }
      return fromIndex(width, idx)
    }
    // At end of current word; advance past it
    idx++
  }

  // Skip non-word cells to find next word
  while (idx < total && !isWordCell(grid, Math.floor(idx / width), idx % width)) {
    idx++
  }

  if (idx >= total) return null

  // Walk forward to find end of this word
  while (idx + 1 < total && isWordCell(grid, Math.floor((idx + 1) / width), (idx + 1) % width)) {
    idx++
  }

  return fromIndex(width, idx)
}

/**
 * Repeat a word motion `count` times. Returns null if any iteration returns null.
 */
export function repeatWordMotion(
  motionFn: (grid: CellType[][], row: number, col: number) => { row: number; col: number } | null,
  grid: CellType[][],
  row: number,
  col: number,
  count: number,
): { row: number; col: number } | null {
  let r = row
  let c = col

  for (let i = 0; i < count; i++) {
    const result = motionFn(grid, r, c)
    if (!result) return null
    r = result.row
    c = result.col
  }

  return { row: r, col: c }
}

/**
 * Scan forward in reading order from current position (exclusive) for a marker cell
 * whose label matches `char`. If `till=true`, stop one cell before the target.
 * Returns null if no matching marker found.
 */
export function findChar(
  grid: CellType[][],
  markers: Record<string, string>,
  row: number,
  col: number,
  char: string,
  till: boolean,
): { row: number; col: number } | null {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  const total = height * width
  const startIdx = toIndex(width, row, col) + 1

  for (let idx = startIdx; idx < total; idx++) {
    const r = Math.floor(idx / width)
    const c = idx % width
    const key = `${r},${c}`
    if (markers[key] === char) {
      if (till) {
        // Return one cell before the target
        if (idx - 1 <= startIdx - 1) return null // target is immediately after cursor
        const prevIdx = idx - 1
        return fromIndex(width, prevIdx)
      }
      return { row: r, col: c }
    }
  }

  return null
}