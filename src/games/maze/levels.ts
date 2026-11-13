import type { MazeLevel } from './types'

// Level 1: "First Steps" (8x6) — Teach hjkl + count prefixes
// Open grid, collectibles at positions requiring 5l and 4j. Goal at bottom-right. No doors.
const level1: MazeLevel = {
  id: 'maze-1',
  name: 'First Steps',
  width: 8,
  height: 6,
  parSeconds: 30,
  parMotions: 4,
  doors: [],
  markers: {},
  hints: ['Use h/j/k/l to move. Try count prefixes like 5l or 4j.'],
  grid: [
    ['start', 'open', 'open', 'open', 'open', 'collectible', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
  ],
}

// Level 2: "Word Hopper" (12x8) — Teach w/b/e
// Distinct word clusters separated by wall gaps. Collectibles at word starts and ends.
// One collectible behind player requiring b.
const level2: MazeLevel = {
  id: 'maze-2',
  name: 'Word Hopper',
  width: 12,
  height: 8,
  parSeconds: 45,
  parMotions: 6,
  doors: [],
  markers: {},
  hints: ['w jumps to next word start, e to word end, b goes backward.'],
  grid: [
    ['start', 'open', 'open', 'wall', 'wall', 'open', 'open', 'open', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['collectible', 'open', 'open', 'wall', 'wall', 'open', 'open', 'open', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['open', 'open', 'open', 'wall', 'wall', 'collectible', 'open', 'open', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['open', 'open', 'open', 'wall', 'wall', 'open', 'open', 'collectible', 'wall', 'wall', 'goal', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
  ],
}

// Level 3: "Find It" (10x8) — Teach f/t
// Scattered marker cells. Targets reachable efficiently only via f{char}/t{char}.
// One collectible one cell before a marker (rewarding t over f).
const level3: MazeLevel = {
  id: 'maze-3',
  name: 'Find It',
  width: 10,
  height: 8,
  parSeconds: 40,
  parMotions: 5,
  doors: [],
  markers: {
    '0,7': 'a',
    '2,4': 'b',
    '4,8': 'c',
    '6,2': 'd',
    '7,9': 'e',
  },
  hints: ['f{char} jumps to marker, t{char} stops one cell before.'],
  grid: [
    ['start', 'open', 'open', 'open', 'open', 'open', 'open', 'marker', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'marker', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'marker', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['open', 'open', 'marker', 'open', 'open', 'open', 'open', 'collectible', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'goal'],
  ],
}

// Level 4: "The Gauntlet" (14x10) — Combined: all motion types + doors
// Doors requiring specific motions. Multiple paths.
const level4: MazeLevel = {
  id: 'maze-4',
  name: 'The Gauntlet',
  width: 14,
  height: 10,
  parSeconds: 90,
  parMotions: 10,
  doors: [
    { row: 2, col: 6, requiredMotion: '3w' },
    { row: 5, col: 10, requiredMotion: 'fa' },
    { row: 8, col: 4, requiredMotion: '2e' },
  ],
  markers: {
    '5,12': 'a',
    '3,9': 'b',
    '7,7': 'c',
  },
  hints: ['Doors open only when you land on them with the correct motion.'],
  grid: [
    ['start', 'open', 'open', 'wall', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'open', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['open', 'open', 'open', 'wall', 'open', 'open', 'door', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
    ['open', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'marker', 'open', 'wall', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'door', 'open', 'marker', 'wall'],
    ['open', 'open', 'collectible', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open', 'wall'],
    ['open', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'marker', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['open', 'open', 'open', 'open', 'door', 'open', 'open', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
  ],
}

export const MAZE_LEVELS: MazeLevel[] = [level1, level2, level3, level4]