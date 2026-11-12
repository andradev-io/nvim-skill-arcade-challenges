import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameLoop } from './GameLoop'
import { InputManager } from './InputManager'

describe('GameLoop', () => {
  let rafCallbacks: Array<(time: number) => void>
  let rafIdCounter = 0
  let simulatedNow = 0

  beforeEach(() => {
    rafCallbacks = []
    rafIdCounter = 0
    simulatedNow = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      const id = ++rafIdCounter
      rafCallbacks.push(cb as (time: number) => void)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (_id: number) => {
      // no-op in tests; we control frame delivery
    })
    vi.stubGlobal('performance', { ...performance, now: () => simulatedNow })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function deliverFrame(time: number): void {
    simulatedNow = time
    const cb = rafCallbacks.shift()
    cb?.(time)
  }

  it('accumulates fixed timesteps and calls update multiple times per large delta', () => {
    const updates: number[] = []
    const loop = new GameLoop(
      (dt) => updates.push(dt),
      () => {},
    )

    loop.start()
    // First frame establishes lastTime
    deliverFrame(0)
    // Second frame with 200ms delta should produce 3 fixed updates (60fps = ~16.67ms each)
    deliverFrame(200)

    // 200 / 16.667 = 12 updates, but accumulator processes floor(200/16.667) = 12
    expect(updates.length).toBeGreaterThan(1)
    // Each update should be the fixed dt (~16.67ms)
    for (const dt of updates) {
      expect(dt).toBeCloseTo(1000 / 60, 0)
    }
  })

  it('caps delta at 100ms to prevent spiral-of-death', () => {
    const updates: number[] = []
    const loop = new GameLoop(
      (dt) => updates.push(dt),
      () => {},
    )

    loop.start()
    deliverFrame(0)
    // Simulate a 5-second gap (tab was hidden)
    deliverFrame(5000)

    // Should only process 100ms worth of updates, not 5000ms
    const totalDt = updates.reduce((sum, dt) => sum + dt, 0)
    expect(totalDt).toBeLessThanOrEqual(100 + 1000 / 60) // allow one extra frame margin
  })

  it('stops calling update/render after stop()', () => {
    const updates: number[] = []
    const loop = new GameLoop(
      (dt) => updates.push(dt),
      () => {},
    )

    loop.start()
    deliverFrame(0)
    loop.stop()

    const countBefore = updates.length
    deliverFrame(100)
    expect(updates.length).toBe(countBefore)
  })
})

describe('InputManager', () => {
  it('maps vim keys to lane indices', () => {
    expect(InputManager.codeToLane('KeyH')).toBe(0)
    expect(InputManager.codeToLane('KeyJ')).toBe(1)
    expect(InputManager.codeToLane('KeyK')).toBe(2)
    expect(InputManager.codeToLane('KeyL')).toBe(3)
  })

  it('returns -1 for unmapped keys', () => {
    expect(InputManager.codeToLane('KeyA')).toBe(-1)
    expect(InputManager.codeToLane('Space')).toBe(-1)
    expect(InputManager.codeToLane('Enter')).toBe(-1)
  })

  it('dispatches key events to handler', () => {
    const manager = new InputManager()
    const received: string[] = []
    manager.setHandler((code) => received.push(code))

    const el = document.createElement('div')
    manager.bind(el)

    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h' }))
    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'l' }))

    expect(received).toEqual(['KeyH', 'KeyL'])

    manager.unbind(el)
  })

  it('ignores modifier combos', () => {
    const manager = new InputManager()
    const received: string[] = []
    manager.setHandler((code) => received.push(code))

    const el = document.createElement('div')
    manager.bind(el)

    el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', ctrlKey: true }))
    expect(received).toEqual([])

    manager.unbind(el)
  })
})