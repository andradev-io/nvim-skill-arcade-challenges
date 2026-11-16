import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { RegexRenderer } from './RegexRenderer'
import { evaluateRegex, matchesExactly } from './matching'
import type { RegexLevel, RegexPuzzle, RegexState, RegexTarget } from './types'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const FEEDBACK_DURATION_MS = 1200
const BASE_SCORE_PER_PUZZLE = 100

export class RegexGame implements GameEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOver: (finalScore: number) => void
  // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
  private colors: GameColors

  private loop: GameLoop
  private input: InputManager
  private renderer: RegexRenderer

  private level: RegexLevel | null = null
  private currentPuzzleIndex = 0
  private currentPattern = ''
  private patternCursorPos = 0
  private currentAttempts = 0
  private totalAttempts = 0
  private puzzlesCompleted = 0
  private elapsedMs = 0
  private score = 0
  private running = false
  private paused = false
  private gameOver = false

  private lastResult: RegexState['lastResult'] = 'none'
  private matchHighlights: RegexTarget[] = []
  private hintIndex = -1
  private feedbackTimerMs = 0

  constructor(config: GameConfig) {
    this.canvas = config.canvas
    this.ctx = config.canvas.getContext('2d')!
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOver = config.onGameOver

    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT

    this.renderer = new RegexRenderer(this.ctx, CANVAS_WIDTH, CANVAS_HEIGHT, config.colors)
    this.input = new InputManager()
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )

    this.input.setHandler((code, event) => this.handleKey(code, event))
  }

  loadLevel(level: RegexLevel): void {
    this.level = level
    this.currentPuzzleIndex = 0
    this.currentPattern = ''
    this.patternCursorPos = 0
    this.currentAttempts = 0
    this.totalAttempts = 0
    this.puzzlesCompleted = 0
    this.elapsedMs = 0
    this.score = 0
    this.gameOver = false
    this.paused = false
    this.lastResult = 'none'
    this.matchHighlights = []
    this.hintIndex = -1
    this.feedbackTimerMs = 0
    this.emitState()
  }

  start(): void {
    if (!this.level || this.running) return
    this.running = true
    this.input.bind(this.canvas.parentElement ?? this.canvas)
    this.loop.start()
    this.emitState()
  }

  stop(): void {
    this.running = false
    this.loop.stop()
    this.input.unbind(this.canvas.parentElement ?? this.canvas)
  }

  pause(): void {
    if (!this.running || this.gameOver) return
    this.paused = true
    this.loop.stop()
    this.emitState()
  }

  resume(): void {
    if (!this.running || !this.paused || this.gameOver) return
    this.paused = false
    this.loop.start()
    this.emitState()
  }

  getState(): GameState {
    return {
      score: this.score,
      lives: 1,
      wave: 0,
      isRunning: this.running,
      isPaused: this.paused,
      isGameOver: this.gameOver,
    }
  }

  getRegexState(): RegexState {
    return {
      ...this.getState(),
      currentPuzzleIndex: this.currentPuzzleIndex,
      currentPattern: this.currentPattern,
      patternCursorPos: this.patternCursorPos,
      currentAttempts: this.currentAttempts,
      totalAttempts: this.totalAttempts,
      puzzlesCompleted: this.puzzlesCompleted,
      elapsedMs: this.elapsedMs,
      lastResult: this.lastResult,
      matchHighlights: this.matchHighlights,
      hintIndex: this.hintIndex,
    }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
    this.renderer.setColors(colors)
  }

  /** Callback invoked when Backspace is pressed outside active gameplay. */
  onNavigateBack: (() => void) | null = null

  /** Callback invoked when Enter requests a start/restart. */
  onRequestStart: (() => void) | null = null

  /** Callback invoked when r requests a reset during gameplay. */
  onRequestReset: (() => void) | null = null

  private getCurrentPuzzle(): RegexPuzzle | null {
    if (!this.level) return null
    return this.level.puzzles[this.currentPuzzleIndex] ?? null
  }

  private update(dt: number): void {
    if (this.paused || this.gameOver) return

    this.elapsedMs += dt

    // Clear feedback after timer expires
    if (this.feedbackTimerMs > 0) {
      this.feedbackTimerMs -= dt
      if (this.feedbackTimerMs <= 0) {
        this.lastResult = 'none'
        this.matchHighlights = []
      }
    }

    this.emitState()
  }

  private render(): void {
    if (!this.level) return
    const puzzle = this.getCurrentPuzzle()
    if (!puzzle) return
    this.renderer.draw(puzzle, this.getRegexState(), this.level)
  }

  private handleKey(code: string, event: KeyboardEvent): void {
    // Global shortcuts
    if (code === 'Backspace') {
      if (!this.running || this.gameOver) {
        this.onNavigateBack?.()
      } else if (this.currentPattern.length > 0) {
        // Delete character before cursor
        if (this.patternCursorPos > 0) {
          this.currentPattern =
            this.currentPattern.slice(0, this.patternCursorPos - 1) +
            this.currentPattern.slice(this.patternCursorPos)
          this.patternCursorPos--
        }
      }
      return
    }

    if (this.gameOver) {
      if (code === 'Enter') {
        this.onRequestStart?.()
      }
      return
    }

    if (this.paused) {
      if (code === 'Escape') {
        this.resume()
      } else if (code === 'KeyR') {
        this.onRequestReset?.()
      }
      return
    }

    if (!this.running) {
      if (code === 'Enter') {
        this.onRequestStart?.()
      }
      return
    }

    // Active gameplay keys
    if (code === 'Escape') {
      if (this.currentPattern.length > 0) {
        // Clear pattern first
        this.currentPattern = ''
        this.patternCursorPos = 0
      } else {
        this.pause()
      }
      return
    }

    if (code === 'KeyR') {
      this.resetCurrentPuzzle()
      return
    }

    if (code === 'Enter') {
      this.submitPattern()
      return
    }

    // Hint cycling with j/k
    if (code === 'KeyJ') {
      this.cycleHint(1)
      return
    }
    if (code === 'KeyK') {
      this.cycleHint(-1)
      return
    }

    // Cursor movement within pattern with h/l (only when pattern is non-empty)
    if (code === 'KeyH' && this.currentPattern.length > 0) {
      this.patternCursorPos = Math.max(0, this.patternCursorPos - 1)
      return
    }
    if (code === 'KeyL' && this.currentPattern.length > 0) {
      this.patternCursorPos = Math.min(this.currentPattern.length, this.patternCursorPos + 1)
      return
    }

    // Character input — printable characters build the pattern
    const char = this.codeToChar(code, event.key)
    if (char !== null) {
      this.currentPattern =
        this.currentPattern.slice(0, this.patternCursorPos) +
        char +
        this.currentPattern.slice(this.patternCursorPos)
      this.patternCursorPos++
    }
  }

  /**
   * Convert keyboard code/key to a printable character for pattern input.
   * Handles letters, digits, and common regex symbols.
   */
  private codeToChar(code: string, key: string): string | null {
    // Letters
    if (code.startsWith('Key') && code.length === 4) {
      return key.length === 1 ? key : null
    }
    // Digits
    if (code.startsWith('Digit') && code.length === 6) {
      return key.length === 1 ? key : null
    }
    // Common regex symbols
    const symbolMap: Record<string, string> = {
      Period: '.',
      Comma: ',',
      Slash: '/',
      Backslash: '\\',
      BracketLeft: '[',
      BracketRight: ']',
      ParenLeft: '(',
      ParenRight: ')',
      Equal: '=',
      Minus: '-',
      Semicolon: ';',
      Quote: "'",
      Backquote: '`',
    }
    if (code in symbolMap) {
      return symbolMap[code]
    }
    // Shift-modified symbols come through as key
    if (key.length === 1 && /[+\-*?{}|^$<>!@#%&_:~]/.test(key)) {
      return key
    }
    return null
  }

  private cycleHint(direction: number): void {
    if (!this.level?.hints || this.level.hints.length === 0) return
    if (this.hintIndex < 0) {
      this.hintIndex = direction > 0 ? 0 : this.level.hints.length - 1
    } else {
      this.hintIndex = (this.hintIndex + direction + this.level.hints.length) % this.level.hints.length
    }
  }

  private resetCurrentPuzzle(): void {
    this.currentPattern = ''
    this.patternCursorPos = 0
    this.currentAttempts = 0
    this.lastResult = 'none'
    this.matchHighlights = []
    this.hintIndex = -1
    this.feedbackTimerMs = 0
    this.emitState()
  }

  private submitPattern(): void {
    const puzzle = this.getCurrentPuzzle()
    if (!puzzle || this.currentPattern.length === 0) return

    const found = evaluateRegex(this.currentPattern, puzzle.bufferLines)
    const exact = matchesExactly(found, puzzle.targets)

    this.currentAttempts++
    this.totalAttempts++
    this.matchHighlights = found

    if (exact) {
      this.lastResult = 'correct'
      this.feedbackTimerMs = FEEDBACK_DURATION_MS
      this.awardPuzzleScore(puzzle)
      this.puzzlesCompleted++

      // Advance to next puzzle after brief feedback
      if (this.currentPuzzleIndex < (this.level?.puzzles.length ?? 0) - 1) {
        setTimeout(() => this.advancePuzzle(), FEEDBACK_DURATION_MS)
      } else {
        setTimeout(() => this.completeLevel(), FEEDBACK_DURATION_MS)
      }
    } else {
      // Check if max attempts exceeded
      const maxAttempts = this.level?.maxAttemptsPerPuzzle ?? 5
      if (this.currentAttempts >= maxAttempts) {
        this.lastResult = 'skipped'
        this.feedbackTimerMs = FEEDBACK_DURATION_MS
        if (this.currentPuzzleIndex < (this.level?.puzzles.length ?? 0) - 1) {
          setTimeout(() => this.advancePuzzle(), FEEDBACK_DURATION_MS)
        } else {
          setTimeout(() => this.completeLevel(), FEEDBACK_DURATION_MS)
        }
      } else {
        this.lastResult = found.length > 0 ? 'partial' : 'wrong'
        this.feedbackTimerMs = FEEDBACK_DURATION_MS
      }
    }

    this.emitState()
  }

  private awardPuzzleScore(puzzle: RegexPuzzle): void {
    // Base score
    let puzzleScore = BASE_SCORE_PER_PUZZLE

    // Efficiency bonus: fewer chars in pattern = more bonus
    // Optimal pattern length estimated from target text
    const optimalLength = this.estimateOptimalLength(puzzle)
    const efficiencyBonus = Math.max(0, (optimalLength * 3 - this.currentPattern.length) * 5)
    puzzleScore += efficiencyBonus

    // Speed bonus based on par time per puzzle
    const parMsPerPuzzle = ((this.level?.parSeconds ?? 60) * 1000) / (this.level?.puzzles.length ?? 1)
    const speedBonus = Math.max(0, Math.round((parMsPerPuzzle - this.elapsedMs / (this.puzzlesCompleted + 1)) / 100)) * 5
    puzzleScore += speedBonus

    // Attempt penalty
    const attemptPenalty = Math.max(0, (this.currentAttempts - 1) * 15)
    puzzleScore -= attemptPenalty

    this.score += Math.max(0, puzzleScore)
  }

  private estimateOptimalLength(puzzle: RegexPuzzle): number {
    // Simple heuristic: average target span length
    if (puzzle.targets.length === 0) return 1
    const totalLen = puzzle.targets.reduce((sum, t) => sum + (t.endCol - t.startCol), 0)
    return Math.ceil(totalLen / puzzle.targets.length)
  }

  private advancePuzzle(): void {
    this.currentPuzzleIndex++
    this.currentPattern = ''
    this.patternCursorPos = 0
    this.currentAttempts = 0
    this.lastResult = 'none'
    this.matchHighlights = []
    this.hintIndex = -1
    this.feedbackTimerMs = 0
    this.emitState()
  }

  private completeLevel(): void {
    this.gameOver = true
    this.loop.stop()
    this.emitState()
    this.onGameOver(this.score)
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }
}