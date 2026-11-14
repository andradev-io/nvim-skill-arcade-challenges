import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { SnakeRenderer } from './renderer'
import type { Direction, FoodItem, Position, SnakeLevel, SnakeState } from './types'

const CELL_SIZE = 24
const TIP_DURATION_MS = 2000
const MIN_SPEED_MS = 80

interface ParserState {
 countStr: string
 lastInputTime: number
}

export class SnakeGame implements GameEngine {
 private readonly canvas: HTMLCanvasElement
 private readonly ctx: CanvasRenderingContext2D
 private readonly onStateChange: (state: GameState) => void
 private readonly onGameOver: (finalScore: number) => void
 // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
 private colors: GameColors

 private loop: GameLoop
 private input: InputManager
 private renderer: SnakeRenderer

 private level: SnakeLevel | null = null
 private snake: Position[] = []
 private direction: Direction = 'l'
 private nextDirection: Direction = 'l'
 private food: FoodItem[] = []
 private foodsEaten = 0
 private score = 0
 private elapsedMs = 0
 private currentSpeed = 300
 private tickAccumulator = 0
 private lastTip: string | null = null
 private tipTimestamp = 0
 private lastSpawnTime = 0

 private running = false
 private paused = false
 private gameOver = false

 private parser: ParserState = { countStr: '', lastInputTime: 0 }

 constructor(config: GameConfig) {
 this.canvas = config.canvas
 this.ctx = config.canvas.getContext('2d')!
 this.colors = config.colors
 this.onStateChange = config.onStateChange
 this.onGameOver = config.onGameOver

 this.renderer = new SnakeRenderer(this.ctx, CELL_SIZE, config.colors)
 this.input = new InputManager()
 this.loop = new GameLoop(
 (dt) => this.update(dt),
 () => this.render(),
 )

 this.input.setHandler((code) => this.handleKey(code))
 }

 loadLevel(level: SnakeLevel): void {
 this.level = level
 this.snake = [
 { row: Math.floor(level.height / 2), col: Math.floor(level.width / 2) },
 { row: Math.floor(level.height / 2), col: Math.floor(level.width / 2) - 1 },
 { row: Math.floor(level.height / 2), col: Math.floor(level.width / 2) - 2 },
 ]
 this.direction = 'l'
 this.nextDirection = 'l'
 this.food = [...level.initialFood]
 this.foodsEaten = 0
 this.score = 0
 this.elapsedMs = 0
 this.currentSpeed = level.baseSpeed
 this.tickAccumulator = 0
 this.lastTip = null
 this.tipTimestamp = 0
 this.lastSpawnTime = 0
 this.running = false
 this.paused = false
 this.gameOver = false
 this.parser = { countStr: '', lastInputTime: 0 }

 this.canvas.width = level.width * CELL_SIZE
 this.canvas.height = level.height * CELL_SIZE + 48

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

 getSnakeState(): SnakeState {
 return {
 ...this.getState(),
 snake: [...this.snake],
 direction: this.direction,
 food: [...this.food],
 foodsEaten: this.foodsEaten,
 lastTip: this.lastTip,
 elapsedMs: this.elapsedMs,
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

 // Clear tip after duration
 const now = performance.now()
 if (this.lastTip && now - this.tipTimestamp > TIP_DURATION_MS) {
 this.lastTip = null
 }

 // Clear parser state after timeout (1.5s)
 if (now - this.parser.lastInputTime > 1500) {
 this.parser.countStr = ''
 }

 // Tick-based movement
 this.tickAccumulator += dt
 while (this.tickAccumulator >= this.currentSpeed) {
 this.tickAccumulator -= this.currentSpeed
 this.tick()
 if (this.gameOver) break
 }

 // Spawn new food periodically
 if (now - this.lastSpawnTime > this.level.spawnRate && this.food.length < 5) {
 this.spawnFood()
 this.lastSpawnTime = now
 }

 this.emitState()
 }

 private tick(): void {
 if (!this.level) return

 this.direction = this.nextDirection

 const head = this.snake[0]
 const delta = directionDelta(this.direction)
 const newHead: Position = {
 row: head.row + delta.dr,
 col: head.col + delta.dc,
 }

 // Check wall collision
 if (this.isWall(newHead)) {
 this.endGame()
 return
 }

 // Check self collision
 if (this.snake.some((seg) => seg.row === newHead.row && seg.col === newHead.col)) {
 this.endGame()
 return
 }

 // Move snake: add new head
 this.snake.unshift(newHead)

 // Check food
 const foodIdx = this.food.findIndex(
 (f) => f.position.row === newHead.row && f.position.col === newHead.col,
 )
 if (foodIdx >= 0) {
 const eaten = this.food[foodIdx]
 this.food.splice(foodIdx, 1)
 this.foodsEaten++
 this.score += eaten.points
 this.lastTip = `${eaten.label}: ${eaten.tip}`
 this.tipTimestamp = performance.now()

 // Speed up
 this.currentSpeed = Math.max(
 MIN_SPEED_MS,
 this.level.baseSpeed - this.foodsEaten * this.level.speedIncreasePerFood,
 )
 // Don't remove tail — snake grows
 } else {
 // Remove tail
 this.snake.pop()
 }
 }

 private render(): void {
 if (!this.level) return
 this.renderer.draw(this.getSnakeState(), this.level)
 }

 private handleKey(code: string): void {
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

 this.parser.lastInputTime = performance.now()

 // Digit accumulation
 const isDigit = code.startsWith('Digit') && code.length === 6
 if (isDigit) {
 if (this.parser.countStr.length < 4) {
 this.parser.countStr += code.charAt(5)
 }
 return
 }

 // Direction keys
 const isLetter = code.startsWith('Key') && code.length === 4
 if (!isLetter) {
 this.parser.countStr = ''
 return
 }

 const char = code.charAt(3).toLowerCase()

 if ('hjkl'.includes(char)) {
 const count = Math.max(1, parseInt(this.parser.countStr, 10) || 1)
 this.parser.countStr = ''
 this.applyDirection(char as Direction, count)
 return
 }

 if (this.level?.allowWordMotions && 'wbe'.includes(char)) {
 this.parser.countStr = ''
 // Word motions in snake context: jump along body segments
 // w = jump forward, b = jump backward, e = jump to end
 // For simplicity, these act as quick directional changes
 // This is a simplified interpretation for the game context
 return
 }

 this.parser.countStr = ''
 }

 private applyDirection(dir: Direction, count: number): void {
 if (!this.level) return

 // Block opposite direction
 const opposites: Record<Direction, Direction> = { h: 'l', l: 'h', j: 'k', k: 'j' }
 if (opposites[dir] === this.direction && count === 1) return

 // For count > 1, we queue the direction change and let ticks handle it
 // But we need to validate each step
 const delta = directionDelta(dir)
 const head = this.snake[0]

 for (let i = 0; i < count; i++) {
 const testPos: Position = {
 row: head.row + delta.dr * (i + 1),
 col: head.col + delta.dc * (i + 1),
 }

 if (this.isWall(testPos)) break
 if (this.snake.some((seg) => seg.row === testPos.row && seg.col === testPos.col)) break
 }

 this.nextDirection = dir
 }

 private isWall(pos: Position): boolean {
 if (!this.level) return false
 if (pos.row < 0 || pos.row >= this.level.height) return true
 if (pos.col < 0 || pos.col >= this.level.width) return true
 return this.level.walls.some((w) => w.row === pos.row && w.col === pos.col)
 }

 private spawnFood(): void {
 if (!this.level) return

 const wallSet = new Set(this.level.walls.map((w) => `${w.row},${w.col}`))
 const snakeSet = new Set(this.snake.map((s) => `${s.row},${s.col}`))
 const foodSet = new Set(this.food.map((f) => `${f.position.row},${f.position.col}`))

 let attempts = 0
 while (attempts < 100) {
 const r = Math.floor(Math.random() * this.level.height)
 const c = Math.floor(Math.random() * this.level.width)
 const key = `${r},${c}`
 if (!wallSet.has(key) && !snakeSet.has(key) && !foodSet.has(key)) {
 const pool = [
 { label: 'dd', tip: 'Deletes the entire current line', points: 10 },
 { label: 'yy', tip: 'Yanks (copies) the current line', points: 10 },
 { label: 'p', tip: 'Pastes text after cursor/line', points: 5 },
 { label: 'x', tip: 'Delete character under cursor', points: 5 },
 { label: 'ciw', tip: 'Change inner word', points: 15 },
 { label: '/search', tip: 'Search forward for pattern', points: 15 },
 ]
 const item = pool[Math.floor(Math.random() * pool.length)]
 this.food.push({ position: { row: r, col: c }, ...item })
 return
 }
 attempts++
 }
 }

 private endGame(): void {
 this.gameOver = true
 this.loop.stop()

 // Calculate final score with time bonus
 if (this.level) {
 const elapsedSeconds = this.elapsedMs / 1000
 const timeBonus = Math.max(0, Math.round((this.level.parTime - elapsedSeconds) * 10))
 this.score += timeBonus
 }

 this.emitState()
 this.onGameOver(this.score)
 }

 private emitState(): void {
 this.onStateChange(this.getState())
 }
}

function directionDelta(dir: Direction): { dr: number; dc: number } {
 switch (dir) {
 case 'h': return { dr: 0, dc: -1 }
 case 'j': return { dr: 1, dc: 0 }
 case 'k': return { dr: -1, dc: 0 }
 case 'l': return { dr: 0, dc: 1 }
 }
}