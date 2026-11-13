import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MazeGame } from './MazeGame'
import { InputManager } from '../engine/InputManager'
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
  parMotions: 5,
  doors: [],
  markers: {},
  grid: [
    ['start', 'open', 'collectible', 'wall'],
    ['wall', 'wall', 'open', 'wall'],
    ['wall', 'goal', 'open', 'wall'],
  ],
}

const DOOR_LEVEL: MazeLevel = {
  id: 'test-door',
  name: 'Door Test',
  width: 5,
  height: 2,
  parSeconds: 30,
  parMotions: 5,
  doors: [{ row: 0, col: 3, requiredMotion: 'w' }],
  markers: {},
  grid: [
    ['start', 'open', 'wall', 'door', 'goal'],
    ['wall', 'wall', 'wall', 'wall', 'wall'],
  ],
}

const MARKER_LEVEL: MazeLevel = {
  id: 'test-marker',
  name: 'Marker Test',
  width: 6,
  height: 1,
  parSeconds: 30,
  parMotions: 3,
  doors: [],
  markers: { '0,4': 'x' },
  grid: [
    ['start', 'open', 'open', 'open', 'marker', 'goal'],
  ],
}

function dispatchKey(container: HTMLElement | HTMLCanvasElement, code: string): void {
  container.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.replace('Key', '').toLowerCase() }))
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

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyK') // try moving up from row 0

    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(0)
    expect(state.lastMotion?.result).toBe('blocked')

    game.stop()
  })

  it('allows valid movement with h/j/k/l', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyL')

    const state = game.getMazeState()
    expect(state.playerRow).toBe(0)
    expect(state.playerCol).toBe(1)
    expect(state.motionCount).toBe(1)

    game.stop()
  })

  it('picks up collectibles and increments score', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyL')
    dispatchKey(container, 'KeyL')

    const state = game.getMazeState()
    expect(state.collectiblesLeft).toBe(0)
    // Score is calculated at win time now, but collectible pickup still adds 50 during play
    expect(state.score).toBe(50)

    game.stop()
  })

  it('count prefix moves multiple cells', () => {
    const level: MazeLevel = {
      id: 'count-test',
      name: 'Count',
      width: 6,
      height: 1,
      parSeconds: 30,
      parMotions: 2,
      doors: [],
      markers: {},
      grid: [['start', 'open', 'open', 'open', 'open', 'goal']],
    }

    const game = new MazeGame(config)
    game.loadLevel(level)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'Digit3')
    dispatchKey(container, 'KeyL')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(3)
    expect(state.motionCount).toBe(1)

    game.stop()
  })

  it('count prefix stops at boundary with partial movement', () => {
    const level: MazeLevel = {
      id: 'partial-test',
      name: 'Partial',
      width: 4,
      height: 1,
      parSeconds: 30,
      parMotions: 2,
      doors: [],
      markers: {},
      grid: [['start', 'open', 'open', 'wall']],
    }

    const game = new MazeGame(config)
    game.loadLevel(level)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'Digit5')
    dispatchKey(container, 'KeyL')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(2) // stopped at wall, partial movement
    expect(state.lastMotion?.result).toBe('moved')

    game.stop()
  })

  it('opens door when landing on it with correct motion', () => {
    const game = new MazeGame(config)
    game.loadLevel(DOOR_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    // Move right twice to (0,2), then use w to land on door at (0,3)
    dispatchKey(container, 'KeyL')
    dispatchKey(container, 'KeyL')
    dispatchKey(container, 'KeyW')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(3) // moved onto opened door
    expect(state.lastMotion?.description).toBe('w')

    game.stop()
  })

  it('does not open door with wrong motion', () => {
    const game = new MazeGame(config)
    game.loadLevel(DOOR_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyL')
    dispatchKey(container, 'KeyL')
    // Try l to hit door — should be blocked since door requires 'w'
    dispatchKey(container, 'KeyL')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(2) // stayed put
    expect(state.lastMotion?.result).toBe('blocked')

    game.stop()
  })

  it('f{char} jumps to marker cell', () => {
    const game = new MazeGame(config)
    game.loadLevel(MARKER_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyF')
    dispatchKey(container, 'KeyX')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(4) // jumped to marker at col 4
    expect(state.lastMotion?.description).toBe('fx')
    expect(state.lastMotion?.result).toBe('moved')

    game.stop()
  })

  it('t{char} stops one cell before marker', () => {
    const game = new MazeGame(config)
    game.loadLevel(MARKER_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyT')
    dispatchKey(container, 'KeyX')

    const state = game.getMazeState()
    expect(state.playerCol).toBe(3) // one before marker at col 4
    expect(state.lastMotion?.description).toBe('tx')

    game.stop()
  })

  it('f with no matching marker reports no-target', () => {
    const game = new MazeGame(config)
    game.loadLevel(MARKER_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyF')
    dispatchKey(container, 'KeyZ') // no marker 'z'

    const state = game.getMazeState()
    expect(state.playerCol).toBe(0) // didn't move
    expect(state.lastMotion?.result).toBe('no-target')

    game.stop()
  })

  it('parser accumulates digits up to 4', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'Digit1')
    dispatchKey(container, 'Digit2')
    dispatchKey(container, 'Digit3')
    dispatchKey(container, 'Digit4')
    dispatchKey(container, 'Digit5') // should be ignored (max 4)

    const state = game.getMazeState()
    expect(state.parserCountStr).toBe('1234')

    game.stop()
  })

  it('parser shows pending state for f/t', () => {
    const game = new MazeGame(config)
    game.loadLevel(MARKER_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyF')

    const state = game.getMazeState()
    expect(state.parserPending).toBe('f')

    game.stop()
  })

  it('non-letter cancels pending f/t', () => {
    const game = new MazeGame(config)
    game.loadLevel(MARKER_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyF')
    dispatchKey(container, 'Escape') // should cancel pending and pause

    expect(game.getState().isPaused).toBe(true)
    const state = game.getMazeState()
    expect(state.parserPending).toBe('')

    game.stop()
  })

  it('starts game with Enter when not running', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    let startCalled = false
    game.onRequestStart = () => { startCalled = true }

    const container = config.canvas.parentElement ?? config.canvas
    ;(game as unknown as { input: InputManager }).input.bind(container)
    dispatchKey(container, 'Enter')
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
    dispatchKey(container, 'KeyR')
    expect(resetCalled).toBe(true)

    game.stop()
  })

  it('navigates back with Backspace when not running', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    let backCalled = false
    game.onNavigateBack = () => { backCalled = true }

    const container = config.canvas.parentElement ?? config.canvas
    ;(game as unknown as { input: InputManager }).input.bind(container)
    dispatchKey(container, 'Backspace')
    expect(backCalled).toBe(true)

    game.stop()
  })

  it('wins when reaching goal cell', () => {
    const quickLevel: MazeLevel = {
      id: 'quick',
      name: 'Quick',
      width: 2,
      height: 1,
      parSeconds: 30,
      parMotions: 5,
      doors: [],
      markers: {},
      grid: [['start', 'goal']],
    }

    const game = new MazeGame(config)
    game.loadLevel(quickLevel)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyL')

    expect(gameOverScore).not.toBeNull()
    expect(game.getState().isGameOver).toBe(true)

    game.stop()
  })

  it('pauses and resumes with Escape', () => {
    const game = new MazeGame(config)
    game.loadLevel(SIMPLE_LEVEL)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'Escape')
    expect(game.getState().isPaused).toBe(true)

    dispatchKey(container, 'Escape')
    expect(game.getState().isPaused).toBe(false)

    game.stop()
  })

  it('scoring includes motion efficiency bonus', () => {
    const quickLevel: MazeLevel = {
      id: 'score-test',
      name: 'Score',
      width: 2,
      height: 1,
      parSeconds: 30,
      parMotions: 5,
      doors: [],
      markers: {},
      grid: [['start', 'goal']],
    }

    const game = new MazeGame(config)
    game.loadLevel(quickLevel)
    game.start()

    const container = config.canvas.parentElement ?? config.canvas
    dispatchKey(container, 'KeyL')

    // parMotions=5, used 1 motion -> bonus = (5-1)*20 = 80
    // No collectibles, no advanced motions, time bonus > 0
    expect(gameOverScore).toBeGreaterThan(80)

    game.stop()
  })
})