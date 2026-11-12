import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { MazeRenderer } from './MazeRenderer'
import type { CellType, DoorSpec, MazeLevel } from './types'

const CELL_SIZE = 32
const INPUT_BUFFER_TIMEOUT_MS = 1500

interface MazeState extends GameState {
  playerRow: number
  playerCol: number
  collectiblesLeft: number
  elapsedMs: number
  inputBuffer: string
  levelId: string
}

export class MazeGame implements GameEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOver: (finalScore: number) => void
  private colors: GameColors

  private loop: GameLoop
  private input: InputManager
  private renderer: MazeRenderer

  private level: MazeLevel | null = null
  private grid: CellType[][] = []
  private doors: DoorSpec[] = []
  private playerRow = 0
  private playerCol = 0
  private score = 0
  private collectiblesLeft = 0
  private elapsedMs = 0
  private running = false
  private paused = false
  private gameOver = false
  private won = false

  private inputBuffer = ''
  private lastInputTime = 0

  constructor(config: GameConfig) {
    this.canvas = config.canvas
    this.ctx = config.canvas.getContext('2d')!
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOver = config.onGameOver

    this.renderer = new MazeRenderer(this.ctx, CELL_SIZE)
    this.input = new InputManager()
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )

    this.input.setHandler((code) => this.handleKey(code))
  }

  loadLevel(level: MazeLevel): void {
    this.level = level
    // Deep copy grid so mutations don't affect the level definition
    this.grid = level.grid.map((row) => [...row])
    this.doors = [...level.doors]
    this.collectiblesLeft = 0

    // Find start position and count collectibles
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        if (this.grid[r][c] === 'start') {
          this.playerRow = r
          this.playerCol = c
        } else if (this.grid[r][c] === 'collectible') {
          this.collectiblesLeft++
        }
      }
    }

    this.score = 0
    this.elapsedMs = 0
    this.gameOver = false
    this.won = false
    this.paused = false
    this.inputBuffer = ''
    this.lastInputTime = 0

    // Size canvas to fit the level
    this.canvas.width = level.width * CELL_SIZE
    this.canvas.height = level.height * CELL_SIZE + 48 // extra space for HUD

    this.emitState()
  }

  start(): void {
    if (!this.level) return
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

  getMazeState(): MazeState {
    return {
      ...this.getState(),
      playerRow: this.playerRow,
      playerCol: this.playerCol,
      collectiblesLeft: this.collectiblesLeft,
      elapsedMs: this.elapsedMs,
      inputBuffer: this.inputBuffer,
      levelId: this.level?.id ?? '',
    }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
    this.renderer.setColors(colors)
  }

  private update(dt: number): void {
    if (this.paused || this.gameOver) return

    this.elapsedMs += dt

    // Clear input buffer after timeout
    if (this.inputBuffer.length > 0 && performance.now() - this.lastInputTime > INPUT_BUFFER_TIMEOUT_MS) {
      this.inputBuffer = ''
    }

    this.emitState()
  }

  private render(): void {
    if (!this.level) return
    this.renderer.draw(this.grid, this.doors, this.playerRow, this.playerCol, this.getMazeState())
  }

  private handleKey(code: string): void {
    if (this.gameOver || this.paused) {
      // Allow Escape to unpause
      if (code === 'Escape' && this.paused) {
        this.resume()
      }
      return
    }

    if (code === 'Escape') {
      this.pause()
      return
    }

    // Movement keys
    let dr = 0
    let dc = 0
    let vimKey = ''

    switch (code) {
      case 'KeyH': dr = 0; dc = -1; vimKey = 'h'; break
      case 'KeyJ': dr = 1; dc = 0; vimKey = 'j'; break
      case 'KeyK': dr = -1; dc = 0; vimKey = 'k'; break
      case 'KeyL': dr = 0; dc = 1; vimKey = 'l'; break
      default: return
    }

    // Add to input buffer for door matching
    this.inputBuffer += vimKey
    this.lastInputTime = performance.now()

    // Check door commands before moving
    const doorOpened = this.checkDoors()
    if (doorOpened) {
      this.emitState()
      return
    }

    // Attempt movement
    const newRow = this.playerRow + dr
    const newCol = this.playerCol + dc

    if (!this.isValidMove(newRow, newCol)) return

    const targetCell = this.grid[newRow][newCol]

    // Handle collectible pickup
    if (targetCell === 'collectible') {
      this.grid[newRow][newCol] = 'open'
      this.collectiblesLeft--
      this.score += 50
    }

    // Handle goal
    if (targetCell === 'goal') {
      this.playerRow = newRow
      this.playerCol = newCol
      this.winGame()
      return
    }

    this.playerRow = newRow
    this.playerCol = newCol
    this.emitState()
  }

  private isValidMove(row: number, col: number): boolean {
    if (!this.level) return false
    if (row < 0 || row >= this.level.height || col < 0 || col >= this.level.width) return false
    const cell = this.grid[row][col]
    return cell !== 'wall' && cell !== 'door'
  }

  private checkDoors(): boolean {
    const now = performance.now()
    let opened = false

    for (let i = this.doors.length - 1; i >= 0; i--) {
      const door = this.doors[i]
      if (this.inputBuffer.endsWith(door.command)) {
        // Open the door: change cell from 'door' to 'open'
        this.grid[door.row][door.col] = 'open'
        this.doors.splice(i, 1)
        this.inputBuffer = ''
        this.lastInputTime = now
        opened = true
      }
    }

    return opened
  }

  private winGame(): void {
    this.won = true
    this.gameOver = true
    this.loop.stop()

    // Score: (parSeconds - elapsed) * 10 + collectibles * 50
    const parMs = (this.level?.parSeconds ?? 60) * 1000
    const timeBonus = Math.max(0, Math.round((parMs - this.elapsedMs) / 100)) * 10
    this.score += timeBonus

    this.emitState()
    this.onGameOver(this.score)
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }
}