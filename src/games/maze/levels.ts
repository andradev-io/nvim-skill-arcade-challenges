import type { MazeLevel } from './types'

// Level 1: 8x8 simple path, 2 collectibles, no doors
const level1: MazeLevel = {
  id: 'maze-1',
  name: 'First Steps',
  width: 8,
  height: 8,
  parSeconds: 30,
  doors: [],
  grid: [
    ['start', 'open', 'open', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'wall', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'collectible', 'wall', 'open', 'wall'],
    ['wall', 'open', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'collectible', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
  ],
}

// Level 2: 12x10 moderate complexity, 4 collectibles, 1 door
const level2: MazeLevel = {
  id: 'maze-2',
  name: 'The Corridor',
  width: 12,
  height: 10,
  parSeconds: 60,
  doors: [{ row: 4, col: 6, command: 'w', direction: 'h' }],
  grid: [
    ['start', 'open', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'wall', 'open', 'open', 'open', 'wall', 'collectible', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open', 'wall'],
    ['wall', 'open', 'wall', 'wall', 'wall', 'wall', 'door', 'wall', 'open', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'collectible', 'open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'collectible', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'collectible', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
  ],
}

// Level 3: 16x12 complex paths, 6 collectibles, 2 doors
const level3: MazeLevel = {
  id: 'maze-3',
  name: 'Labyrinth',
  width: 16,
  height: 12,
  parSeconds: 90,
  doors: [
    { row: 3, col: 8, command: '3w', direction: 'h' },
    { row: 8, col: 10, command: 'dw', direction: 'l' },
  ],
  grid: [
    ['start', 'open', 'open', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'wall', 'wall', 'open', 'open', 'open', 'wall', 'collectible', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'wall', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'open', 'wall', 'wall', 'wall', 'open', 'open', 'open', 'door', 'open', 'open', 'collectible', 'open', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'collectible', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'open', 'open', 'open', 'open', 'open', 'open', 'wall', 'open', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'open', 'open', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'open', 'open', 'open', 'wall'],
    ['wall', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'collectible', 'open', 'wall', 'open', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'open', 'open', 'open', 'collectible', 'open', 'open', 'open', 'open', 'wall', 'door', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall', 'wall', 'wall', 'wall', 'wall', 'open', 'wall'],
    ['wall', 'collectible', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
  ],
}

export const MAZE_LEVELS: MazeLevel[] = [level1, level2, level3]