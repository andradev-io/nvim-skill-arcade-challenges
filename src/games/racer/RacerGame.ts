import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { RacerRenderer } from './RacerRenderer'
import { calculateObstacleScore, calculateSpeedBonus } from './scoring'
import type { ActiveObstacle, RacerLevel, RacerState } from './types'

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 500
const PROMPT_ZONE_RATIO = 0.20 // rightmost 20% triggers prompt
const PLAYER_X_RATIO = 0.15 // player sits at 15% from left
const SPEED_BOOST_DECAY_MS = 2000
const SPEED_BOOST_AMOUNT = 0.4
const BUFFER_TIMEOUT_MS = 600

export class RacerGame implements GameEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOver: (finalScore: number) => void
  // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
  private colors: GameColors

  private loop: GameLoop
  private input: InputManager
  private renderer: RacerRenderer

  private level: RacerLevel | null = null
  private scrollPosition = 0
  private currentLane = 0
  private activeObstacles: ActiveObstacle[] = []
  private combo = 0
  private score = 0
  private lives = 3
  private elapsedMs = 0
  private speedMultiplier = 1
  private speedBoostEndMs = 0
  private running = false
  private paused = false
  private gameOver = false
  private won = false

  private lastInputTime = 0
  private typedBuffer = ''

  constructor(config: GameConfig) {
    this.canvas = config.canvas
    this.ctx = config.canvas.getContext('2d')!
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOver = config.onGameOver

    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT

    this.renderer = new RacerRenderer(this.ctx, CANVAS_WIDTH, CANVAS_HEIGHT, config.colors)
    this.input = new InputManager()
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )

    this.input.setHandler((code, event) => this.handleKey(code, event))
  }

  loadLevel(level: RacerLevel): void {
    this.level = level
    this.scrollPosition = 0
    this.currentLane = 0
    this.combo = 0
    this.score = 0
    this.lives = 3
    this.elapsedMs = 0
    this.speedMultiplier = 1
    this.speedBoostEndMs = 0
    this.running = false
    this.paused = false
    this.gameOver = false
    this.won = false
    this.typedBuffer = ''
    this.lastInputTime = 0

    // Initialize active obstacles from level spec
    this.activeObstacles = level.obstacles.map((spec) => ({
      ...spec,
      screenX: CANVAS_WIDTH + 100, // off-screen initially
      prompted: false,
      typedBuffer: '',
      cleared: false,
      missed: false,
      promptStartMs: 0,
    }))

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
      lives: this.lives,
      wave: 0,
      isRunning: this.running,
      isPaused: this.paused,
      isGameOver: this.gameOver,
    }
  }

  getRacerState(): RacerState {
    const totalObstacles = this.level?.obstacles.length ?? 0
    const clearedObstacles = this.activeObstacles.filter((o) => o.cleared).length
    return {
      ...this.getState(),
      scrollPosition: this.scrollPosition,
      currentLane: this.currentLane,
      activeObstacles: [...this.activeObstacles],
      combo: this.combo,
      totalObstacles,
      clearedObstacles,
      elapsedMs: this.elapsedMs,
      speedMultiplier: this.speedMultiplier,
      lives: this.lives,
    }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
    this.renderer.setColors(colors)
  }

  onNavigateBack: (() => void) | null = null
  onRequestStart: (() => void) | null = null
  onRequestReset: (() => void) | null = null

  private update(dt: number): void {
    if (this.paused || this.gameOver || !this.level) return

    this.elapsedMs += dt
    const now = performance.now()

    // Decay speed boost
    if (now > this.speedBoostEndMs) {
      this.speedMultiplier = Math.max(1, this.speedMultiplier - (dt / SPEED_BOOST_DECAY_MS) * SPEED_BOOST_AMOUNT)
    }

    // Scroll track
    const currentSpeed = this.level.baseSpeed * this.speedMultiplier
    this.scrollPosition += currentSpeed * (dt / 1000)

    // Update obstacle screen positions
    const playerScreenX = CANVAS_WIDTH * PLAYER_X_RATIO
    const promptZoneStart = CANVAS_WIDTH * (1 - PROMPT_ZONE_RATIO)

    for (const obs of this.activeObstacles) {
      if (obs.cleared || obs.missed) continue

      // Convert normalized position to pixel offset relative to scroll
      const worldX = obs.position * this.level.trackLength
      const relativeX = worldX - this.scrollPosition
      obs.screenX = playerScreenX + relativeX

      // Check if obstacle entered prompt zone
      if (!obs.prompted && obs.screenX <= promptZoneStart && obs.screenX > 0) {
        obs.prompted = true
        obs.promptStartMs = now
      }

      // Check timeout
      if (obs.prompted && now - obs.promptStartMs > obs.timeoutMs) {
        this.missObstacle(obs)
      }

      // Check collision (obstacle passed player)
      if (obs.screenX < playerScreenX - 30) {
        this.missObstacle(obs)
      }
    }

    // Clear buffer on timeout
    if (this.typedBuffer.length > 0 && now - this.lastInputTime > BUFFER_TIMEOUT_MS) {
      this.typedBuffer = ''
    }

    // Check win condition
    if (this.scrollPosition >= this.level.trackLength) {
      this.winGame()
      return
    }

    this.emitState()
  }

  private render(): void {
    if (!this.level) return
    this.renderer.draw(this.getRacerState(), this.level, this.typedBuffer)
  }

  private handleKey(code: string, event: KeyboardEvent): void {
    if (code === 'Backspace') {
      if (!this.running || this.gameOver) {
        this.onNavigateBack?.()
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

    if (code === 'Escape') {
      this.pause()
      return
    }

    if (code === 'KeyR') {
      this.onRequestReset?.()
      return
    }

    // Lane switching with j/k
    if (code === 'KeyJ') {
      if (this.level && this.currentLane < this.level.laneCount - 1) {
        this.currentLane++
      }
      return
    }

    if (code === 'KeyK') {
      if (this.currentLane > 0) {
        this.currentLane--
      }
      return
    }

    // Character input for typing commands
    const char = this.codeToChar(code, event.key)
    if (char !== null) {
      this.handleCharInput(char)
    }
  }

  private codeToChar(code: string, key: string): string | null {
    if (key.length === 1) return key
    if (key === ' ') return ' '
    return null
  }

  private handleCharInput(char: string): void {
    this.lastInputTime = performance.now()
    this.typedBuffer += char

    // Find the best matching prompted obstacle
    const candidates = this.activeObstacles.filter(
      (o) => o.prompted && !o.cleared && !o.missed && o.lane === this.currentLane,
    )

    let matchedObs: ActiveObstacle | null = null

    for (const obs of candidates) {
      if (obs.command.startsWith(this.typedBuffer)) {
        matchedObs = obs
        break
      }
    }

    if (!matchedObs) {
      // No match — wrong character, reset buffer and lose combo
      this.typedBuffer = ''
      this.combo = 0
      return
    }

    // Check full match
    if (this.typedBuffer === matchedObs.command) {
      this.clearObstacle(matchedObs)
      this.typedBuffer = ''
    }
    // Partial match — keep buffer, continue typing
  }

  private clearObstacle(obs: ActiveObstacle): void {
    obs.cleared = true
    const now = performance.now()
    const typedTime = now - obs.promptStartMs
    const speedBonus = calculateSpeedBonus(typedTime, obs.timeoutMs)
    const points = calculateObstacleScore(obs.points, this.combo, speedBonus)
    this.score += points
    this.combo++

    // Apply speed boost
    this.speedMultiplier = Math.min(
      this.level?.maxSpeed ? this.level.maxSpeed / (this.level?.baseSpeed ?? 1) : 3,
      this.speedMultiplier + SPEED_BOOST_AMOUNT,
    )
    this.speedBoostEndMs = now + SPEED_BOOST_DECAY_MS
  }

  private missObstacle(obs: ActiveObstacle): void {
    if (obs.missed || obs.cleared) return
    obs.missed = true
    this.lives--
    this.combo = 0
    this.speedMultiplier = 1

    if (this.lives <= 0) {
      this.endGame()
    }
  }

  private endGame(): void {
    this.gameOver = true
    this.loop.stop()
    this.emitState()
    this.onGameOver(this.score)
  }

  private winGame(): void {
    this.won = true
    this.gameOver = true
    this.loop.stop()
    this.emitState()
    this.onGameOver(this.score)
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }
}