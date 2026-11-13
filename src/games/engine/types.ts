export interface GameEngine {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  getState(): GameState
  setColors(colors: GameColors): void
  onNavigateBack: (() => void) | null
  onRequestStart: (() => void) | null
  onRequestReset: (() => void) | null
}

export interface GameState {
  score: number
  lives: number
  wave: number
  isRunning: boolean
  isPaused: boolean
  isGameOver: boolean
}

export interface GameColors {
  bg: string
  fg: string
  accent: string
  warn: string
  line: string
}

export interface GameConfig {
  canvas: HTMLCanvasElement
  colors: GameColors
  onStateChange: (state: GameState) => void
  onGameOver: (finalScore: number) => void
}