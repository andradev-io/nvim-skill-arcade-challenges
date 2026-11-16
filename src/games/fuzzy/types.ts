import type { GameState } from '../engine/types'

export interface FuzzyEntry {
  text: string
  category?: string
}

export interface FuzzyRound {
  entries: ReadonlyArray<FuzzyEntry>
  targetIndex: number
  hint?: string
}

export interface FuzzyLevel {
  id: string
  name: string
  rounds: ReadonlyArray<FuzzyRound>
  parSeconds: number
  maxWrongPerRound: number
  hints?: string[]
}

export interface FuzzyState extends GameState {
  currentRoundIndex: number
  searchQuery: string
  filteredIndices: number[]
  cursorIndex: number
  roundsCompleted: number
  currentWrongSelections: number
  totalKeystrokes: number
  elapsedMs: number
  lastResult: 'none' | 'correct' | 'wrong' | 'skipped'
}