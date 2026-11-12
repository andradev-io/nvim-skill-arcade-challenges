import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MazeGame } from './MazeGame'
import type { GameConfig, GameColors } from '../engine/types'
import type { MazeLevel } from './types'

const COLORS: GameColors = {
  bg: '#1e1e1e',
  fg: '#d4d4d4',
  accent: '#d4a053',
  warn: '#c9784a',
  line: '#3c3c3c',
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  // Mock getContext to avoid headless canvas issues
  const ctx = {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx)
  return canvas
}

const SIMPLE_LEVEL: MazeLevel = {
  id: 'test-1',
  name: 'Test',
  width: 4,
  height: 3,
  parSeconds: 30,
  doors: [],
  grid: [
    ['start', 'open', 'collectible', 'wall'],
    ['wall', 'wall', 'open', 'wall'],
    ['wall', 'goal', 'open', 'wall'],
  ],
}

const DOOR_LEVEL: MazeLevel = {
  id: 'test-door',
  name: 'Door Test',
  width: 4,
  height: 2,
  parSeconds: 30,
  doors: [{ row: 0, col: 2, command: 'w', direction: 'h' }],
  grid: [
    ['start', 'open', 'door', 'goal'],
    ['wall', 'wall', 'wall', 'wall'],
  ],
}

describe('MazeGame', () => {
  let config: GameConfig
  let stateChanges: number
  let gameOverScore: number | null

  beforeEach(() => {
    stateChanges = 0
    gameOverScore = null
    config = {
      canvas: makeCanvas(),
      colors: COLORS,
      onStateChange: () => { stateChanges++ },
      onGameOver: (score) => { gameOverScore = score },
    }
  })

  it('initializes player at start position', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(0)
    expect(state.collectiblesLeft).toBe(1)
  })

  it('blocks movement into walls', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    // Try moving up from start (row 0) — should stay put
    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k' }))

    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(0)

    game.stop()
  })

  it('allows valid movement with h/j/k/l', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    // Move right (l)
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))

    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(1)

    game.stop()
  })

  it('picks up collectibles and increments score', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    // Move right twice to reach collectible at (0,2)
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))

    const state = game.getMazeState()
    expect(state.collectiblesLeft).toBe(0)
    expect(state.score).toBe(50)

    game.stop()
  })

  it('opens doors when non-movement key matches command', () => {
    const game = new MazeGame(config)
    game.loadLevel(DOOR_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    // Move right to (0,1)
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))
    let state = game.getMazeState()
    expect(state.playerCol).toBe(1)

    // Type 'w' (non-movement key) to open door at (0,2)
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))
    state = game.getMazeState()
    expect(state.inputBuffer).toBe('') // buffer cleared after door opened

    // Now move right into the opened door cell (now 'open')
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))
    state = game.getMazeState()
    expect(state.playerCol).toBe(2) // moved through opened door

    game.stop()
  })

  it('accumulates digit and letter keys in input buffer without moving', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    // Type '3' then 'w' — neither should move the player
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3', key: '3' }))
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))

    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(0)
    expect(state.inputBuffer).toBe('3w')

    game.stop()
  })

  it('starts game with Enter when not running', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    let startCalled = false
    game.onRequestStart = () => { startCalled = true }

    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }))
    expect(startCalled).toBe(true)

    game.stop()
  })

  it('resets game with r during gameplay', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()
    let resetCalled = false
    game.onRequestReset = () => { resetCalled = true }

    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r' }))
    expect(resetCalled).toBe(true)

    game.stop()
  })

  it('navigates back with Backspace when not running', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    let backCalled = false
    game.onNavigateBack = () => { backCalled = true }

    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backspace', key: 'Backspace' }))
    expect(backCalled).toBe(true)

    game.stop()
  })

  it('wins when reaching goal cell', () => {
    // Create a minimal level where goal is adjacent to start
    const quickLevel: MazeLevel = {
      id: 'quick',
      name: 'Quick',
      width: 2,
      height: 1,
      parSeconds: 30,
      doors: [],
      grid: [['start', 'goal']],
    }

    const game = new MazeGame(config)
    game.loadLevel(quickLevel)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))

    expect(gameOverScore).not.toBeNull()
    expect(game.getState().isGameOver).toBe(true)

    game.stop()
  })

  it('pauses and resumes with Escape', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    expect(game.getState().isPaused).toBe(true)

    container.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    expect(game.getState().isPaused).toBe(false)

    game.stop()
  })
})