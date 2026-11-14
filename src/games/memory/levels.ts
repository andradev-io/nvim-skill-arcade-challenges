import type { MemoryLevel } from './types'
import { selectPairs } from './cards'

export const MEMORY_LEVELS: MemoryLevel[] = [
  {
    id: 'memory-l1',
    name: 'Basic Motions',
    pairs: selectPairs(['motion'], 6),
    gridCols: 4,
    gridRows: 3,
    parTime: 30,
    parMoves: 12,
    hints: ['Match each motion command with what it does.'],
  },
  {
    id: 'memory-l2',
    name: 'Operators',
    pairs: selectPairs(['motion', 'operator'], 8),
    gridCols: 4,
    gridRows: 4,
    parTime: 45,
    parMoves: 16,
    hints: ['Operators combine with motions: d + w = delete word.'],
  },
  {
    id: 'memory-l3',
    name: 'Text Objects',
    pairs: selectPairs(['motion', 'operator', 'text-object'], 10),
    gridCols: 5,
    gridRows: 4,
    parTime: 60,
    parMoves: 22,
    hints: ['Text objects select regions: iw = inner word, i" = inside quotes.'],
  },
  {
    id: 'memory-l4',
    name: 'Full Combo',
    pairs: selectPairs(['motion', 'operator', 'text-object', 'combo'], 12),
    gridCols: 6,
    gridRows: 4,
    parTime: 75,
    parMoves: 28,
    hints: ['Combos are full commands: ciw = change inner word, dap = delete paragraph.'],
  },
]