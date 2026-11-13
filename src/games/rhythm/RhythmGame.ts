import type { GameColors, GameConfig, GameEngine, GameState } from '../engine/types'
import { GameLoop } from '../engine/GameLoop'
import { InputManager } from '../engine/InputManager'
import { RhythmRenderer } from './RhythmRenderer'
import type { HitResult, NoteEvent, RhythmLevel, RhythmState } from './types'
import { BASE_POINTS, GOOD_WINDOW_MS, classifyHit, computeMultiplier } from './scoring'

const SCROLL_DURATION_MS = 2000
const HIT_ZONE_Y = 540
const PLAYFIELD_TOP_Y = 40
const LANE_WIDTH = 80
const CANVAS_HEIGHT = 600
const CANVAS_WIDTH = 320

interface FeedbackPopup {
 text: string
 lane: number
 createdAt: number
 durationMs: number
}

export class RhythmGame implements GameEngine {
 private readonly canvas: HTMLCanvasElement
 private readonly ctx: CanvasRenderingContext2D
 private readonly onStateChange: (state: GameState) => void
 private readonly onGameOver: (finalScore: number) => void
 // @ts-expect-error Used by setColors() and passed to renderer; tsc -b project refs false positive
 private colors: GameColors

 private loop: GameLoop
 private input: InputManager
 private renderer: RhythmRenderer

 private level: RhythmLevel | null = null
 private notes: NoteEvent[] = []
 private score = 0
 private combo = 0
 private maxCombo = 0
 private multiplier = 1
 private perfectCount = 0
 private goodCount = 0
 private missCount = 0
 private lastHitResult: HitResult | null = null
 private songTimeMs = 0
 private running = false
 private paused = false
 private gameOver = false
 private feedbacks: FeedbackPopup[] = []
 private laneFlashes: Array<{ lane: number; createdAt: number }> = []

 constructor(config: GameConfig) {
 this.canvas = config.canvas
 this.ctx = config.canvas.getContext('2d')!
 this.colors = config.colors
 this.onStateChange = config.onStateChange
 this.onGameOver = config.onGameOver

 this.canvas.width = CANVAS_WIDTH
 this.canvas.height = CANVAS_HEIGHT

 this.renderer = new RhythmRenderer(this.ctx, config.colors, {
 scrollDurationMs: SCROLL_DURATION_MS,
 hitZoneY: HIT_ZONE_Y,
 playfieldTopY: PLAYFIELD_TOP_Y,
 laneWidth: LANE_WIDTH,
 canvasHeight: CANVAS_HEIGHT,
 canvasWidth: CANVAS_WIDTH,
 })
 this.input = new InputManager()
 this.loop = new GameLoop(
 (dt) => this.update(dt),
 () => this.render(),
 )

 this.input.setHandler((code) => this.handleKey(code))
 }

 loadLevel(level: RhythmLevel): void {
 this.level = level
 // Deep copy notes so mutations don't affect the level definition
 this.notes = level.notes.map((n) => ({ lane: n.lane, timeMs: n.timeMs }))
 this.score = 0
 this.combo = 0
 this.maxCombo = 0
 this.multiplier = 1
 this.perfectCount = 0
 this.goodCount = 0
 this.missCount = 0
 this.lastHitResult = null
 this.songTimeMs = 0
 this.gameOver = false
 this.paused = false
 this.feedbacks = []
 this.laneFlashes = []

 this.canvas.width = CANVAS_WIDTH
 this.canvas.height = CANVAS_HEIGHT

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

 getRhythmState(): RhythmState {
 const durationMs = this.level?.durationMs ?? 1
 return {
 ...this.getState(),
 combo: this.combo,
 maxCombo: this.maxCombo,
 multiplier: this.multiplier,
 perfectCount: this.perfectCount,
 goodCount: this.goodCount,
 missCount: this.missCount,
 lastHitResult: this.lastHitResult,
 songProgress: Math.min(1, this.songTimeMs / durationMs),
 laneKeys: this.level?.laneKeys ?? [],
 }
 }

 setColors(colors: GameColors): void {
 this.colors = colors
 this.renderer.setColors(colors)
 }

 /** Callback invoked when Backspace is pressed outside active gameplay. */
 onNavigateBack: (() => void) | null = null

 /** Callback invoked when Enter or r requests a start/restart. */
 onRequestStart: (() => void) | null = null

 /** Callback invoked when r requests a reset during gameplay. */
 onRequestReset: (() => void) | null = null

 private update(dt: number): void {
 if (this.paused || this.gameOver) return

 this.songTimeMs += dt

 // Mark missed notes: any unresolved note whose time has passed beyond the good window
 for (const note of this.notes) {
 if (!note.hit && !note.missed && this.songTimeMs > note.timeMs + GOOD_WINDOW_MS) {
 note.missed = true
 this.combo = 0
 this.multiplier = computeMultiplier(this.combo)
 this.missCount++
 this.lastHitResult = { grade: 'miss', lane: note.lane, deltaMs: this.songTimeMs - note.timeMs }
 this.addFeedback('MISS', note.lane)
 }
 }

 // Expire old feedback popups and lane flashes
 const now = performance.now()
 this.feedbacks = this.feedbacks.filter((f) => now - f.createdAt < f.durationMs)
 this.laneFlashes = this.laneFlashes.filter((f) => now - f.createdAt < 200)

 // Check song completion: all notes resolved AND song time past duration
 const allResolved = this.notes.every((n) => n.hit || n.missed)
 if (allResolved && this.songTimeMs >= (this.level?.durationMs ?? 0)) {
 this.endSong()
 return
 }

 this.emitState()
 }

 private render(): void {
 if (!this.level) return
 this.renderer.draw({
 notes: this.notes,
 songTimeMs: this.songTimeMs,
 state: this.getRhythmState(),
 feedbacks: this.feedbacks,
 laneFlashes: this.laneFlashes,
 })
 }

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

 if (code === 'Escape') {
 this.pause()
 return
 }

 if (code === 'KeyR') {
 this.onRequestReset?.()
 return
 }

 // Map key code to lane
 const lane = this.codeToLane(code)
 if (lane < 0) return

 this.tryHitNote(lane)
 }

 private codeToLane(code: string): number {
 if (!this.level) return -1
 // Extract char from KeyX codes (e.g., KeyH → h)
 if (!code.startsWith('Key') || code.length !== 4) return -1
 const char = code.charAt(3).toLowerCase()
 return this.level.laneKeys.indexOf(char)
 }

 private tryHitNote(lane: number): void {
 // Find closest unresolved note in this lane within the good window
 const candidates = this.notes
 .filter((n) => !n.hit && !n.missed && n.lane === lane)
 .map((n) => ({ note: n, delta: this.songTimeMs - n.timeMs }))
 .filter((c) => Math.abs(c.delta) <= GOOD_WINDOW_MS)
 .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))

 if (candidates.length === 0) {
 // Wrong timing or no note in lane — miss penalty
 this.combo = 0
 this.multiplier = computeMultiplier(this.combo)
 return
 }

 const { note, delta } = candidates[0]
 const grade = classifyHit(delta)

 if (grade === 'miss') {
 // Outside window despite being close — treat as miss
 note.missed = true
 this.combo = 0
 this.multiplier = computeMultiplier(this.combo)
 this.missCount++
 this.lastHitResult = { grade: 'miss', lane, deltaMs: delta }
 this.addFeedback('MISS', lane)
 } else {
 // Successful hit
 note.hit = true
 this.combo++
 this.multiplier = computeMultiplier(this.combo)
 this.maxCombo = Math.max(this.maxCombo, this.combo)
 this.score += BASE_POINTS[grade] * this.multiplier
 this.lastHitResult = { grade, lane, deltaMs: delta }

 if (grade === 'perfect') {
 this.perfectCount++
 this.addFeedback('PERFECT!', lane)
 } else {
 this.goodCount++
 this.addFeedback('GOOD', lane)
 }

 this.laneFlashes.push({ lane, createdAt: performance.now() })
 }

 this.emitState()
 }

 private addFeedback(text: string, lane: number): void {
 this.feedbacks.push({ text, lane, createdAt: performance.now(), durationMs: 500 })
 }

 private endSong(): void {
 this.gameOver = true
 this.loop.stop()
 this.emitState()
 this.onGameOver(this.score)
 }

 private emitState(): void {
 this.onStateChange(this.getState())
 }
}