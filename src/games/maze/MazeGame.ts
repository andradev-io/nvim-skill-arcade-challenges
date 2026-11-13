import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { MazeRenderer } from './MazeRenderer'
import type { CellType, DoorSpec, MazeLevel, MotionTrail } from './types'
import { moveDirectional, wordForward, wordBackward, wordEnd, repeatWordMotion, findChar } from './motions'

const CELL_SIZE = 32
const PARSER_TIMEOUT_MS = 1500
const TRAIL_DURATION_MS = 300

interface ParsedMotion {
  count: number
  motion: string
  arg?: string
  result: 'moved' | 'blocked' | 'no-target'
  description: string
}

interface MotionParserState {
  countStr: string
  pendingMotion: string // 'f' or 't' waiting for argument
  lastMotion: ParsedMotion | null
}

interface MazeState extends GameState {
  playerRow: number
  playerCol: number
  collectiblesLeft: number
  elapsedMs: number
  levelId: string
  motionCount: number
  lastMotion: ParsedMotion | null
  parserCountStr: string
  parserPending: string
}

export class MazeGame implements GameEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly onStateChange: (state: GameState) => void
  private readonly onGameOver: (finalScore: number) => void
  // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
  private colors: GameColors

  private loop: GameLoop
  private input: InputManager
  private renderer: MazeRenderer

  private level: MazeLevel | null = null
  private grid: CellType[][] = []
  private doors: DoorSpec[] = []
  private markers: Record<string, string> = {}
  private playerRow = 0
  private playerCol = 0
  private score = 0
  private collectiblesLeft = 0
  private elapsedMs = 0
  private running = false
  private paused = false
  private gameOver = false
  // @ts-expect-error Set in winGame() and read by renderer; tsc -b project refs false positive
  private won = false

  // Motion tracking
  private motionCount = 0
  private motionsUsed: string[] = []
  private trails: MotionTrail[] = []

  // Parser state
  private parser: MotionParserState = {
    countStr: '',
    pendingMotion: '',
    lastMotion: null,
  }
  private lastInputTime = 0

  constructor(config: GameConfig) {
    this.canvas = config.canvas
    this.ctx = config.canvas.getContext('2d')!
    this.colors = config.colors
    this.onStateChange = config.onStateChange
    this.onGameOver = config.onGameOver

    this.renderer = new MazeRenderer(this.ctx, CELL_SIZE, config.colors)
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
    this.markers = { ...level.markers }
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
    this.motionCount = 0
    this.motionsUsed = []
    this.trails = []
    this.parser = { countStr: '', pendingMotion: '', lastMotion: null }
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
      levelId: this.level?.id ?? '',
      motionCount: this.motionCount,
      lastMotion: this.parser.lastMotion,
      parserCountStr: this.parser.countStr,
      parserPending: this.parser.pendingMotion,
    }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
    this.renderer.setColors(colors)
  }

  private update(dt: number): void {
    if (this.paused || this.gameOver) return

    this.elapsedMs += dt

    // Clear parser state after timeout
    const now = performance.now()
    if (now - this.lastInputTime > PARSER_TIMEOUT_MS) {
      if (this.parser.countStr.length > 0 || this.parser.pendingMotion.length > 0) {
        this.parser.countStr = ''
        this.parser.pendingMotion = ''
      }
    }

    // Expire old trail entries
    this.trails = this.trails.filter((t) => now - t.timestamp < TRAIL_DURATION_MS)

    this.emitState()
  }

  private render(): void {
    if (!this.level) return
    this.renderer.draw(
      this.grid,
      this.doors,
      this.markers,
      this.trails,
      this.playerRow,
      this.playerCol,
      this.getMazeState(),
    )
  }

  /** Callback invoked when Backspace is pressed outside active gameplay. */
  onNavigateBack: (() => void) | null = null

  /** Callback invoked when Enter or r requests a start/restart. */
  onRequestStart: (() => void) | null = null

  /** Callback invoked when r requests a reset during gameplay. */
  onRequestReset: (() => void) | null = null

  private handleKey(code: string): void {
    // --- Global shortcuts that work in any state ---

    if (code === 'Backspace') {
      if (!this.running || this.gameOver) {
        this.onNavigateBack?.()
      }
      return
    }

    // --- State-specific shortcuts ---

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

    // --- Active gameplay ---

    // Cancel pending f/t before handling pause/reset so the parser state is clean
    if (this.parser.pendingMotion && (code === 'Escape' || code === 'KeyR')) {
      this.parser.pendingMotion = ''
      this.parser.countStr = ''
      this.lastInputTime = performance.now()
      if (code === 'Escape') {
        this.pause()
      } else {
        this.onRequestReset?.()
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

    this.lastInputTime = performance.now()

    // If waiting for f/t argument character
    if (this.parser.pendingMotion) {
      const isLetter = code.startsWith('Key') && code.length === 4
      if (isLetter) {
        const char = code.charAt(3).toLowerCase()
        this.executeMotion(this.parser.pendingMotion, char)
        this.parser.pendingMotion = ''
        this.parser.countStr = ''
      } else {
        // Non-letter cancels pending motion
        this.parser.pendingMotion = ''
        this.parser.countStr = ''
      }
      return
    }

    // Digit accumulation (max 4 digits)
    const isDigit = code.startsWith('Digit') && code.length === 6
    if (isDigit) {
      if (this.parser.countStr.length < 4) {
        this.parser.countStr += code.charAt(5)
      }
      return
    }

    // Motion keys
    const isLetter = code.startsWith('Key') && code.length === 4
    if (!isLetter) {
      // Unknown key resets parser
      this.parser.countStr = ''
      return
    }

    const char = code.charAt(3).toLowerCase()

    switch (char) {
      case 'h':
      case 'j':
      case 'k':
      case 'l':
        this.executeMotion(char)
        this.parser.countStr = ''
        break
      case 'w':
      case 'b':
      case 'e':
        this.executeMotion(char)
        this.parser.countStr = ''
        break
      case 'f':
      case 't':
        this.parser.pendingMotion = char
        break
      default:
        // Unknown letter resets parser
        this.parser.countStr = ''
        break
    }
  }

  private executeMotion(motion: string, arg?: string): void {
    if (!this.level) return

    const count = Math.max(1, parseInt(this.parser.countStr, 10) || 1)
    const prevRow = this.playerRow
    const prevCol = this.playerCol
    let newRow = prevRow
    let newCol = prevCol
    let result: ParsedMotion['result'] = 'moved'
    let description = ''

    switch (motion) {
      case 'h': {
        const dest = moveDirectional(this.grid, prevRow, prevCol, 0, -1, count)
        newRow = dest.row
        newCol = dest.col
        result = newRow === prevRow && newCol === prevCol ? 'blocked' : 'moved'
        description = `${count > 1 ? count : ''}h`
        break
      }
      case 'j': {
        const dest = moveDirectional(this.grid, prevRow, prevCol, 1, 0, count)
        newRow = dest.row
        newCol = dest.col
        result = newRow === prevRow && newCol === prevCol ? 'blocked' : 'moved'
        description = `${count > 1 ? count : ''}j`
        break
      }
      case 'k': {
        const dest = moveDirectional(this.grid, prevRow, prevCol, -1, 0, count)
        newRow = dest.row
        newCol = dest.col
        result = newRow === prevRow && newCol === prevCol ? 'blocked' : 'moved'
        description = `${count > 1 ? count : ''}k`
        break
      }
      case 'l': {
        const dest = moveDirectional(this.grid, prevRow, prevCol, 0, 1, count)
        newRow = dest.row
        newCol = dest.col
        result = newRow === prevRow && newCol === prevCol ? 'blocked' : 'moved'
        description = `${count > 1 ? count : ''}l`
        break
      }
      case 'w': {
        const dest = repeatWordMotion(wordForward, this.grid, prevRow, prevCol, count)
        if (dest) {
          newRow = dest.row
          newCol = dest.col
        } else {
          result = 'blocked'
        }
        description = `${count > 1 ? count : ''}w`
        break
      }
      case 'b': {
        const dest = repeatWordMotion(wordBackward, this.grid, prevRow, prevCol, count)
        if (dest) {
          newRow = dest.row
          newCol = dest.col
        } else {
          result = 'blocked'
        }
        description = `${count > 1 ? count : ''}b`
        break
      }
      case 'e': {
        const dest = repeatWordMotion(wordEnd, this.grid, prevRow, prevCol, count)
        if (dest) {
          newRow = dest.row
          newCol = dest.col
        } else {
          result = 'blocked'
        }
        description = `${count > 1 ? count : ''}e`
        break
      }
      case 'f': {
        if (!arg) return
        const dest = findChar(this.grid, this.markers, prevRow, prevCol, arg, false)
        if (dest) {
          newRow = dest.row
          newCol = dest.col
        } else {
          result = 'no-target'
        }
        description = `f${arg}`
        break
      }
      case 't': {
        if (!arg) return
        const dest = findChar(this.grid, this.markers, prevRow, prevCol, arg, true)
        if (dest) {
          newRow = dest.row
          newCol = dest.col
        } else {
          result = 'no-target'
        }
        description = `t${arg}`
        break
      }
      default:
        return
    }

    // Check if destination is a door — only open if requiredMotion matches
    const targetCell = this.grid[newRow]?.[newCol]
    if (targetCell === 'door') {
      const doorIdx = this.doors.findIndex((d) => d.row === newRow && d.col === newCol)
      if (doorIdx >= 0) {
        const door = this.doors[doorIdx]
        if (door.requiredMotion === description) {
          // Open the door
          this.grid[newRow][newCol] = 'open'
          this.doors.splice(doorIdx, 1)
        } else {
          // Wrong motion for this door — treat as blocked
          result = 'blocked'
          newRow = prevRow
          newCol = prevCol
        }
      }
    }

    // Record trail for multi-cell motions
    if (newRow !== prevRow || newCol !== prevCol) {
      const now = performance.now()
      // Add intermediate positions for directional moves
      if ('hjkl'.includes(motion) && count > 1) {
        const dr = motion === 'j' ? 1 : motion === 'k' ? -1 : 0
        const dc = motion === 'l' ? 1 : motion === 'h' ? -1 : 0
        let tr = prevRow
        let tc = prevCol
        while (tr !== newRow || tc !== newCol) {
          tr += dr
          tc += dc
          this.trails.push({ row: tr, col: tc, timestamp: now })
        }
      } else {
        this.trails.push({ row: newRow, col: newCol, timestamp: now })
      }
    }

    // Handle collectible pickup
    if (this.grid[newRow]?.[newCol] === 'collectible') {
      this.grid[newRow][newCol] = 'open'
      this.collectiblesLeft--
      this.score += 50
    }

    // Handle goal
    if (this.grid[newRow]?.[newCol] === 'goal') {
      this.playerRow = newRow
      this.playerCol = newCol
      this.motionCount++
      this.motionsUsed.push(motion)
      this.parser.lastMotion = { count, motion, arg, result, description }
      this.winGame()
      return
    }

    // Move player
    this.playerRow = newRow
    this.playerCol = newCol
    this.motionCount++
    this.motionsUsed.push(motion)
    this.parser.lastMotion = { count, motion, arg, result, description }

    this.emitState()
  }

  private winGame(): void {
    this.won = true
    this.gameOver = true
    this.loop.stop()

    // Scoring: collectibles + motion efficiency + advanced motion variety + time
    const collectedCount = (this.level?.grid.flat().filter((c) => c === 'collectible').length ?? 0) - this.collectiblesLeft
    const collectibleScore = 50 * collectedCount
    const parMotions = this.level?.parMotions ?? 10
    const motionBonus = Math.max(0, (parMotions - this.motionCount) * 20)
    const advancedTypes = new Set(this.motionsUsed.filter((m) => 'wbeft'.includes(m)))
    const advancedBonus = advancedTypes.size * 10
    const parMs = (this.level?.parSeconds ?? 60) * 1000
    const timeBonus = Math.max(0, Math.round((parMs - this.elapsedMs) / 100)) * 10
    this.score = collectibleScore + motionBonus + advancedBonus + timeBonus

    this.emitState()
    this.onGameOver(this.score)
  }

  private emitState(): void {
    this.onStateChange(this.getState())
  }
}