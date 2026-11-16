import type { SnakeLevel } from './types'

const VIM_FOOD_POOL = [
  { label: 'dd', tip: 'Deletes the entire current line', points: 10 },
  { label: 'yy', tip: 'Yanks (copies) the current line', points: 10 },
  { label: 'p', tip: 'Pastes text after cursor/line', points: 5 },
  { label: 'P', tip: 'Pastes text before cursor/line', points: 5 },
  { label: 'ciw', tip: 'Change inner word - replaces word under cursor', points: 15 },
  { label: 'diw', tip: 'Delete inner word without entering insert mode', points: 15 },
  { label: 'gg', tip: 'Jump to first line of file', points: 10 },
  { label: 'G', tip: 'Jump to last line of file', points: 10 },
  { label: '/search', tip: 'Search forward for pattern', points: 15 },
  { label: '?search', tip: 'Search backward for pattern', points: 15 },
  { label: ':%s/a/b/g', tip: 'Global find and replace', points: 20 },
  { label: 'u', tip: 'Undo last change', points: 5 },
  { label: 'Ctrl-r', tip: 'Redo last undone change', points: 5 },
  { label: 'x', tip: 'Delete character under cursor', points: 5 },
  { label: 'r', tip: 'Replace single character under cursor', points: 5 },
  { label: 'J', tip: 'Join current line with next line', points: 10 },
  { label: '>>', tip: 'Indent current line right', points: 10 },
  { label: '<<', tip: 'Indent current line left', points: 10 },
  { label: 'daw', tip: 'Delete a word including trailing space', points: 15 },
  { label: 'yiw', tip: 'Yank inner word to register', points: 15 },
  { label: 'vip', tip: 'Visually select inner paragraph', points: 15 },
  { label: 'dap', tip: 'Delete a paragraph', points: 15 },
  { label: 'dt)', tip: 'Delete up to (but not including) closing paren', points: 15 },
  { label: 'f{char}', tip: 'Find character forward on current line', points: 10 },
]

function pickFood(count: number, usedIndices: Set<number>): Array<{ label: string; tip: string; points: number }> {
  const result: Array<{ label: string; tip: string; points: number }> = []
  let idx = 0
  while (result.length < count && idx < VIM_FOOD_POOL.length) {
    if (!usedIndices.has(idx)) {
      result.push(VIM_FOOD_POOL[idx])
      usedIndices.add(idx)
    }
    idx++
  }
  return result
}

function placeFood(
  width: number,
  height: number,
  walls: Array<{ row: number; col: number }>,
  count: number,
): Array<{ position: { row: number; col: number }; label: string; tip: string; points: number }> {
  const wallSet = new Set(walls.map((w) => `${w.row},${w.col}`))
  const usedIndices = new Set<number>()
  const foods = pickFood(count, usedIndices)
  const positions: Array<{ row: number; col: number }> = []

  // Place food in open cells, avoiding walls and previously placed food
  let attempts = 0
  for (let fi = 0; fi < foods.length; fi++) {
    let placed = false
    while (!placed && attempts < 200) {
      const r = Math.floor(Math.random() * height)
      const c = Math.floor(Math.random() * width)
      const key = `${r},${c}`
      if (!wallSet.has(key) && !positions.some((p) => p.row === r && p.col === c)) {
        positions.push({ row: r, col: c })
        placed = true
      }
      attempts++
    }
    if (!placed) {
      // Fallback: scan for any open cell
      for (let r = 0; r < height && !placed; r++) {
        for (let c = 0; c < width && !placed; c++) {
          const key = `${r},${c}`
          if (!wallSet.has(key) && !positions.some((p) => p.row === r && p.col === c)) {
            positions.push({ row: r, col: c })
            placed = true
          }
        }
      }
    }
  }

  return foods.map((f, i) => ({
    position: positions[i] ?? { row: 1, col: 1 },
    ...f,
  }))
}

// Level 1: Basic Movement - 10x8, no internal walls, slow speed, hjkl only
const level1Walls: Array<{ row: number; col: number }> = []
const level1Food = placeFood(10, 8, level1Walls, 5)

// Level 2: Count Prefixes - 14x10, border walls only, medium speed
const level2Walls: Array<{ row: number; col: number }> = []
for (let c = 0; c < 14; c++) {
  level2Walls.push({ row: 0, col: c })
  level2Walls.push({ row: 9, col: c })
}
for (let r = 1; r < 9; r++) {
  level2Walls.push({ row: r, col: 0 })
  level2Walls.push({ row: r, col: 13 })
}
const level2Food = placeFood(14, 10, level2Walls, 8)

// Level 3: Word Motions - 14x10, internal corridor walls, faster speed
const level3Walls: Array<{ row: number; col: number }> = [...level2Walls]
// Horizontal corridors
for (let c = 3; c < 11; c++) {
  level3Walls.push({ row: 3, col: c })
  level3Walls.push({ row: 6, col: c })
}
// Vertical connectors
for (let r = 3; r <= 6; r++) {
  level3Walls.push({ row: r, col: 7 })
}
const level3Food = placeFood(14, 10, level3Walls, 10)

// Level 4: Expert - 16x12, complex wall layout, fast speed
const level4Walls: Array<{ row: number; col: number }> = []
// Border
for (let c = 0; c < 16; c++) {
  level4Walls.push({ row: 0, col: c })
  level4Walls.push({ row: 11, col: c })
}
for (let r = 1; r < 11; r++) {
  level4Walls.push({ row: r, col: 0 })
  level4Walls.push({ row: r, col: 15 })
}
// Internal maze-like structure
for (let c = 4; c < 12; c++) {
  level4Walls.push({ row: 3, col: c })
  level4Walls.push({ row: 8, col: c })
}
for (let r = 3; r <= 8; r++) {
  level4Walls.push({ row: r, col: 4 })
  level4Walls.push({ row: r, col: 11 })
}
// Central obstacle
for (let r = 5; r <= 6; r++) {
  for (let c = 7; c <= 8; c++) {
    level4Walls.push({ row: r, col: c })
  }
}
const level4Food = placeFood(16, 12, level4Walls, 12)

export const SNAKE_LEVELS: SnakeLevel[] = [
  {
    id: 'snake-basic',
    name: 'Basic Movement',
    width: 10,
    height: 8,
    walls: level1Walls,
    initialFood: level1Food,
    spawnRate: 5000,
    baseSpeed: 300,
    speedIncreasePerFood: 10,
    parFoods: 5,
    parTime: 60,
    hints: ['Use h/j/k/l to move the snake', 'Eat food to learn Vim commands'],
    allowWordMotions: false,
  },
  {
    id: 'snake-count',
    name: 'Count Prefixes',
    width: 14,
    height: 10,
    walls: level2Walls,
    initialFood: level2Food,
    spawnRate: 4000,
    baseSpeed: 250,
    speedIncreasePerFood: 12,
    parFoods: 8,
    parTime: 90,
    hints: ['Type a number before h/j/k/l for count prefix', '3j moves 3 cells down at once'],
    allowWordMotions: false,
  },
  {
    id: 'snake-word',
    name: 'Word Motions',
    width: 14,
    height: 10,
    walls: level3Walls,
    initialFood: level3Food,
    spawnRate: 3500,
    baseSpeed: 200,
    speedIncreasePerFood: 15,
    parFoods: 10,
    parTime: 120,
    hints: ['w/b/e jump along the snake body segments', 'Use word motions to navigate tight corridors'],
    allowWordMotions: true,
  },
  {
    id: 'snake-expert',
    name: 'Expert',
    width: 16,
    height: 12,
    walls: level4Walls,
    initialFood: level4Food,
    spawnRate: 3000,
    baseSpeed: 150,
    speedIncreasePerFood: 10,
    parFoods: 12,
    parTime: 150,
    hints: ['Combine all motion types for maximum efficiency', 'Plan your route through the maze'],
    allowWordMotions: true,
  },
]