export interface CardPair {
  id: string
  command: string
  description: string
  category: 'motion' | 'operator' | 'text-object' | 'combo'
}

export interface MemoryLevel {
  id: string
  name: string
  pairs: CardPair[]
  gridCols: number
  gridRows: number
  parTime: number
  parMoves: number
  hints?: string[]
}

export interface MemoryState {
  flippedIndices: number[]
  matchedIds: Set<string>
  moves: number
  elapsedMs: number
  isComplete: boolean
  score: number
  cursorRow: number
  cursorCol: number
}