import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { DefenderRenderer } from './DefenderRenderer'
import { codeToChar, findMatch, splitCommand } from './matching'
import { WAVE_CONFIGS } from './waves'
import type { DefenderState, Enemy, Explosion } from './types'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const BASE_WIDTH = 40
const BUFFER_TIMEOUT_MS = 500
const EXPLOSION_DURATION_MS = 300
const WAVE_ANNOUNCE_MS = 1500
const WAVE_COMPLETE_PAUSE_MS = 2000

export class DefenderGame implements GameEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOver: (finalScore: number) => void
  // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
  private colors: GameColors

  private loop: GameLoop
  private renderer: DefenderRenderer

  private score = 0
  private lives = 3
  private wave = 1
  private running = false
  private paused = false
  private gameOver = false

  // Wave state
  private enemies: Enemy[] = []
  private explosions: Explosion[] = []
  private bufferTokens: string[] = []
  private streak = 0
  private nextEnemyId = 0
  private spawnedCount = 0
  private spawnTimerMs = 0
  private waveActive = false
  private waveCompleteTimerMs = 0
  private waveAnnounceStartMs = 0

  // Input
  private lastInputTime = 0
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(config: GameConfig) {
    this.canvas = config.canvas
    this.ctx = config.canvas.getContext('2d')!
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOver = config.onGameOver

    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT

    this.renderer = new DefenderRenderer(this.ctx, CANVAS_WIDTH, CANVAS_HEIGHT, config.colors)
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )
  }

  start(): void {
    if (this.running) return
    this.resetForNewGame()
    this.running = true
    this.bindInput()
    this.startWave(1)
    this.loop.start()
    this.emitState()
  }

  stop(): void {
    this.running = false
    this.loop.stop()
    this.unbindInput()
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
      wave: this.wave,
      isRunning: this.running,
      isPaused: this.paused,
      isGameOver: this.gameOver,
    }
  }

  getDefenderState(): DefenderState {
    const waveConfig = WAVE_CONFIGS[this.wave - 1]
    const enemiesLeft = waveConfig
      ? waveConfig.enemyCount - this.spawnedCount + this.enemies.filter((e) => e.alive).length
      : 0
    return {
      ...this.getState(),
      buffer: this.bufferTokens.join(''),
      streak: this.streak,
      waveEnemiesLeft: enemiesLeft,
      waveActive: this.waveActive,
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

  private resetForNewGame(): void {
    this.score = 0
    this.lives = 3
    this.wave = 1
    this.gameOver = false
    this.paused = false
    this.streak = 0
    this.enemies = []
    this.explosions = []
    this.bufferTokens = []
    this.nextEnemyId = 0
    this.spawnedCount = 0
    this.spawnTimerMs = 0
    this.waveActive = false
    this.waveCompleteTimerMs = 0
    this.waveAnnounceStartMs = 0
    this.lastInputTime = 0
  }

  private startWave(waveNum: number): void {
    this.wave = waveNum
    this.enemies = []
    this.explosions = []
    this.bufferTokens = []
    this.spawnedCount = 0
    this.spawnTimerMs = 0
    this.waveActive = true
    this.waveCompleteTimerMs = 0
    this.waveAnnounceStartMs = performance.now()
    this.emitState()
  }

  private update(dt: number): void {
    if (this.paused || this.gameOver) return

    const now = performance.now()

    // Buffer timeout
    if (this.bufferTokens.length > 0 && now - this.lastInputTime > BUFFER_TIMEOUT_MS) {
      this.bufferTokens = []
    }

    // Wave complete pause
    if (!this.waveActive && this.waveCompleteTimerMs > 0) {
      this.waveCompleteTimerMs -= dt
      if (this.waveCompleteTimerMs <= 0) {
        if (this.wave < WAVE_CONFIGS.length) {
          this.startWave(this.wave + 1)
        } else {
          // All waves cleared — game over (victory)
          this.endGame()
        }
      }
      return
    }

    const waveConfig = WAVE_CONFIGS[this.wave - 1]
    if (!waveConfig) return

    // Spawn enemies
    if (this.spawnedCount < waveConfig.enemyCount) {
      this.spawnTimerMs += dt
      if (this.spawnTimerMs >= waveConfig.spawnIntervalMs) {
        this.spawnTimerMs -= waveConfig.spawnIntervalMs
        this.spawnEnemy(waveConfig)
      }
    }

    // Move enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue
      enemy.x -= enemy.speed * (dt / 1000)

      // Check base collision
      if (enemy.x <= BASE_WIDTH) {
        enemy.alive = false
        this.lives--
        this.streak = 0
        if (this.lives <= 0) {
          this.endGame()
          return
        }
      }
    }

    // Clean up dead enemies
    this.enemies = this.enemies.filter((e) => e.alive)

    // Clean up expired explosions
    this.explosions = this.explosions.filter((e) => now - e.startTime < e.duration)

    // Check wave complete
    if (this.spawnedCount >= waveConfig.enemyCount && this.enemies.length === 0 && this.waveActive) {
      this.waveActive = false
      this.score += 500 * this.wave // wave clear bonus
      this.waveCompleteTimerMs = WAVE_COMPLETE_PAUSE_MS
    }

    this.emitState()
  }

  private render(): void {
    this.renderer.draw(this.getDefenderState(), this.enemies, this.explosions, this.waveAnnounceStartMs)
  }

  private spawnEnemy(waveConfig: typeof WAVE_CONFIGS[number]): void {
    const command = waveConfig.commands[Math.floor(Math.random() * waveConfig.commands.length)]
    const speed = waveConfig.baseSpeed + Math.random() * waveConfig.speedVariance
    // Spread enemies vertically with some padding
    const padding = 40
    const y = padding + Math.random() * (CANVAS_HEIGHT - padding * 2)

    this.enemies.push({
      id: this.nextEnemyId++,
      command,
      tokens: splitCommand(command),
      typedCount: 0,
      x: CANVAS_WIDTH,
      y,
      speed,
      alive: true,
    })
    this.spawnedCount++
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Prevent default for game keys to avoid scrolling etc.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault()
    }

    // Global shortcuts
    if (e.code === 'Backspace') {
      if (!this.running || this.gameOver) {
        this.onNavigateBack?.()
      }
      return
    }

    if (this.gameOver) {
      if (e.code === 'Enter') {
        this.onRequestStart?.()
      }
      return
    }

    if (this.paused) {
      if (e.code === 'Escape') {
        this.resume()
      } else if (e.code === 'KeyR') {
        this.onRequestReset?.()
      }
      return
    }

    if (!this.running) {
      if (e.code === 'Enter') {
        this.onRequestStart?.()
      }
      return
    }

    if (e.code === 'Escape') {
      this.pause()
      return
    }

    if (e.code === 'KeyR') {
      this.onRequestReset?.()
      return
    }

    // Character input for typing commands
    const char = codeToChar(e.code, e.key)
    if (char !== null) {
      this.handleCharInput(char)
    }
  }

  private handleCharInput(char: string): void {
    this.lastInputTime = performance.now()
    this.bufferTokens.push(char)

    const match = findMatch(this.bufferTokens, this.enemies)

    if (match === null) {
      // No match — clear buffer
      this.bufferTokens = []
      return
    }

    if (match.fullMatch) {
      // Destroy enemy
      const enemy = this.enemies.find((e) => e.id === match.enemyId)
      if (enemy) {
        enemy.alive = false
        this.explosions.push({
          x: enemy.x,
          y: enemy.y,
          startTime: performance.now(),
          duration: EXPLOSION_DURATION_MS,
        })
        // Scoring: killScore = round(100 * min(3, 1 + streak * 0.1))
        const multiplier = Math.min(3, 1 + this.streak * 0.1)
        this.score += Math.round(100 * multiplier)
        this.streak++
      }
      this.bufferTokens = []
    } else {
      // Partial match — update typedCount on the matched enemy
      const enemy = this.enemies.find((e) => e.id === match.enemyId)
      if (enemy) {
        enemy.typedCount = this.bufferTokens.length
      }
    }
  }

  private endGame(): void {
    this.gameOver = true
    this.loop.stop()
    this.emitState()
    this.onGameOver(this.score)
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }

  private bindInput(): void {
    const target = this.canvas.parentElement ?? this.canvas
    this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e)
    target.addEventListener('keydown', this.keydownHandler)
  }

  private unbindInput(): void {
    if (!this.keydownHandler) return
    const target = this.canvas.parentElement ?? this.canvas
    target.removeEventListener('keydown', this.keydownHandler)
    this.keydownHandler = null
  }
}