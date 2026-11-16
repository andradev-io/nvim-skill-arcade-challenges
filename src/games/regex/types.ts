import type { GameState } from '../engine/types'

export interface RegexTarget {
  line: number // 0-based
  startCol: number // 0-based inclusive
  endCol: number // 0-based exclusive
}

export interface RegexPuzzle {
  bufferLines: string[]
  targets: RegexTarget[]
  feature?: string // e.g., 'literal', 'character-class', 'quantifier'
}

export interface RegexLevel {
  id: string
  name: string
  puzzles: ReadonlyArray<RegexPuzzle>
  parSeconds: number
  maxAttemptsPerPuzzle: number
  allowedFeatures?: string[]
  hints?: string[]
}

export interface RegexState extends GameState {
  currentPuzzleIndex: number
  currentPattern: string
  patternCursorPos: number
  currentAttempts: number
  totalAttempts: number
  puzzlesCompleted: number
  elapsedMs: number
  lastResult: 'none' | 'correct' | 'partial' | 'wrong' | 'skipped'
  matchHighlights: RegexTarget[]
  hintIndex: number
}