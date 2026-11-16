import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { filterEntries, fuzzyScore } from './fuzzyMatch'
import type { FuzzyLevel, FuzzyState } from './types'
import { FuzzyRenderer } from './FuzzyRenderer'

const FEEDBACK_DURATION_MS = 400

export class FuzzyGame implements GameEngine {
  private readonly loop: GameLoop
  private readonly input: InputManager
  private readonly renderer: FuzzyRenderer
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOverCb: (finalScore: number) => void

  private colors: GameColors
  private level: FuzzyLevel | null = null

  // Game state
  private score = 0
  private isRunning = false
  private isPaused = false
  private isGameOver = false
  private currentRoundIndex = 0
  private searchQuery = ''
  private filteredIndices: number[] = []
  private cursorIndex = 0
  private roundsCompleted = 0
  private currentWrongSelections = 0
  private totalKeystrokes = 0
  private elapsedMs = 0
  private lastResult: 'none' | 'correct' | 'wrong' | 'skipped' = 'none'
  private feedbackTimer = 0

  // Pending key for gg/G detection
  private pendingG = false

  onNavigateBack: (() => void) | null = null
  onRequestStart: (() => void) | null = null
  onRequestReset: (() => void) | null = null

  constructor(config: GameConfig) {
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOverCb = config.onGameOver

    const ctx = config.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    this.renderer = new FuzzyRenderer(ctx, config.canvas, this.colors)

    this.input = new InputManager()
    this.input.setHandler((code, event) => this.handleKey(code, event))

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )
  }

  loadLevel(level: FuzzyLevel): void {
    this.level = level
    this.resetRoundState()
    this.score = 0
    this.currentRoundIndex = 0
    this.roundsCompleted = 0
    this.totalKeystrokes = 0
    this.elapsedMs = 0
    this.isGameOver = false
    this.isPaused = false
    this.isRunning = false
    this.lastResult = 'none'
    this.feedbackTimer = 0
    this.pendingG = false
    this.recomputeFiltered()
    this.emitState()
  }

  start(): void {
    if (!this.level) return
    this.isRunning = true
    this.isPaused = false
    this.loop.start()
    this.input.bind(this.renderer.canvas)
    this.emitState()
  }

  stop(): void {
    this.isRunning = false
    this.loop.stop()
    this.input.unbind(this.renderer.canvas)
  }

  pause(): void {
    if (!this.isRunning || this.isGameOver) return
    this.isPaused = true
    this.emitState()
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return
    this.isPaused = false
    this.emitState()
  }

  getState(): GameState {
    return {
      score: this.score,
      lives: 1,
      wave: this.currentRoundIndex,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
    }
  }

  getFuzzyState(): FuzzyState {
    return {
      ...this.getState(),
      currentRoundIndex: this.currentRoundIndex,
      searchQuery: this.searchQuery,
      filteredIndices: [...this.filteredIndices],
      cursorIndex: this.cursorIndex,
      roundsCompleted: this.roundsCompleted,
      currentWrongSelections: this.currentWrongSelections,
      totalKeystrokes: this.totalKeystrokes,
      elapsedMs: this.elapsedMs,
      lastResult: this.lastResult,
    }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
    this.renderer.setColors(colors)
  }

  private resetRoundState(): void {
    this.searchQuery = ''
    this.cursorIndex = 0
    this.currentWrongSelections = 0
    this.lastResult = 'none'
    this.feedbackTimer = 0
    this.pendingG = false
    this.recomputeFiltered()
  }

  private recomputeFiltered(): void {
    if (!this.level) {
      this.filteredIndices = []
      return
    }
    const round = this.level.rounds[this.currentRoundIndex]
    if (!round) {
      this.filteredIndices = []
      return
    }
    this.filteredIndices = filterEntries(this.searchQuery, round.entries)
    // Clamp cursor
    if (this.cursorIndex >= this.filteredIndices.length) {
      this.cursorIndex = Math.max(0, this.filteredIndices.length - 1)
    }
  }

  private handleKey(code: string, event: KeyboardEvent): void {
    if (!this.isRunning || !this.level) return

    // Pause toggle
    if (code === 'Escape') {
      if (this.searchQuery.length > 0) {
        // Clear query first
        this.searchQuery = ''
        this.totalKeystrokes++
        this.recomputeFiltered()
        this.emitState()
        return
      }
      if (this.isPaused) {
        this.resume()
      } else {
        this.pause()
      }
      return
    }

    if (this.isPaused) return

    // Reset round
    if (code === 'KeyR') {
      this.resetRoundState()
      this.emitState()
      return
    }

    // Navigation: j/k
    if (code === 'KeyJ') {
      this.moveCursor(1)
      return
    }
    if (code === 'KeyK') {
      this.moveCursor(-1)
      return
    }

    // gg / G jump
    if (code === 'KeyG') {
      if (event.shiftKey || this.pendingG) {
        // Jump to last
        this.cursorIndex = Math.max(0, this.filteredIndices.length - 1)
        this.totalKeystrokes++
        this.pendingG = false
        this.emitState()
      } else {
        this.pendingG = true
        // Will be cleared after a short timeout or next non-g key
      }
      return
    }

    // Any other key clears pending g
    this.pendingG = false

    // Enter: select
    if (code === 'Enter') {
      this.selectCurrent()
      return
    }

    // Backspace: remove last char
    if (code === 'Backspace') {
      if (this.searchQuery.length > 0) {
        this.searchQuery = this.searchQuery.slice(0, -1)
        this.totalKeystrokes++
        this.recomputeFiltered()
        this.emitState()
      }
      return
    }

    // Typing characters: add to query
    const char = event.key
    if (char.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.searchQuery += char
      this.totalKeystrokes++
      this.recomputeFiltered()
      this.emitState()
    }
  }

  private moveCursor(delta: number): void {
    if (this.filteredIndices.length === 0) return
    this.cursorIndex = Math.max(0, Math.min(this.filteredIndices.length - 1, this.cursorIndex + delta))
    this.totalKeystrokes++
    this.emitState()
  }

  private selectCurrent(): void {
    if (!this.level || this.filteredIndices.length === 0) return

    const round = this.level.rounds[this.currentRoundIndex]
    const selectedOriginalIndex = this.filteredIndices[this.cursorIndex]

    if (selectedOriginalIndex === round.targetIndex) {
      // Correct selection
      this.lastResult = 'correct'
      this.feedbackTimer = FEEDBACK_DURATION_MS
      this.awardRoundScore()
      this.roundsCompleted++
      this.advanceRound()
    } else {
      // Wrong selection
      this.lastResult = 'wrong'
      this.feedbackTimer = FEEDBACK_DURATION_MS
      this.currentWrongSelections++
      this.totalKeystrokes++

      if (this.currentWrongSelections > this.level.maxWrongPerRound) {
        // Skip round with 0 points
        this.lastResult = 'skipped'
        this.roundsCompleted++
        this.advanceRound()
      }
    }

    this.emitState()
  }

  private awardRoundScore(): void {
    if (!this.level) return
    const baseScore = 100

    // Keystroke efficiency: fewer keystrokes = higher bonus
    // Par keystrokes ~ target name length + 3 (navigation + enter)
    const round = this.level.rounds[this.currentRoundIndex]
    const targetLen = round.entries[round.targetIndex].text.length
    const parKeystrokes = targetLen + 5
    const keystrokeBonus = Math.max(0, Math.round((parKeystrokes / Math.max(1, this.totalKeystrokes)) * 30))

    // Speed bonus based on par time
    const parMs = this.level.parSeconds * 1000 / this.level.rounds.length
    const speedRatio = parMs / Math.max(1, this.elapsedMs)
    const speedBonus = Math.max(0, Math.round(speedRatio * 20))

    // Wrong selection penalty
    const wrongPenalty = this.currentWrongSelections * 15

    const roundScore = Math.max(0, baseScore + keystrokeBonus + speedBonus - wrongPenalty)
    this.score += roundScore
  }

  private advanceRound(): void {
    if (!this.level) return
    if (this.currentRoundIndex + 1 >= this.level.rounds.length) {
      // All rounds complete
      this.isGameOver = true
      this.isRunning = false
      this.loop.stop()
      this.onGameOverCb(this.score)
      this.emitState()
    } else {
      this.currentRoundIndex++
      this.resetRoundState()
    }
  }

  private update(dt: number): void {
    if (this.isPaused || this.isGameOver) return

    this.elapsedMs += dt

    if (this.feedbackTimer > 0) {
      this.feedbackTimer = Math.max(0, this.feedbackTimer - dt)
      if (this.feedbackTimer <= 0) {
        this.lastResult = 'none'
      }
    }
  }

  private render(): void {
    if (!this.level) return
    const round = this.level.rounds[this.currentRoundIndex]
    if (!round) return

    this.renderer.draw({
      entries: round.entries,
      filteredIndices: this.filteredIndices,
      cursorIndex: this.cursorIndex,
      searchQuery: this.searchQuery,
      hint: round.hint ?? '',
      roundIndex: this.currentRoundIndex,
      totalRounds: this.level.rounds.length,
      score: this.score,
      keystrokes: this.totalKeystrokes,
      elapsedMs: this.elapsedMs,
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
      lastResult: this.lastResult,
      feedbackTimer: this.feedbackTimer,
      feedbackDuration: FEEDBACK_DURATION_MS,
      levelName: this.level.name,
    })
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }
}