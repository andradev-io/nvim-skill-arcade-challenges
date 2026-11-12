const TARGET_FPS = 60
const FIXED_DT = 1000 / TARGET_FPS
const MAX_DT = 100 // cap to prevent spiral-of-death

export class GameLoop {
  private rafId: number | null = null
  private lastTime = 0
  private accumulator = 0
  private running = false

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = -1 // sentinel: first tick establishes baseline
    this.accumulator = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  get isRunning(): boolean {
    return this.running
  }

  private tick = (now: number): void => {
    if (!this.running) return

    // First frame after start(): establish baseline, no delta yet
    if (this.lastTime < 0) {
      this.lastTime = now
      this.render()
      this.rafId = requestAnimationFrame(this.tick)
      return
    }

    let dt = now - this.lastTime
    this.lastTime = now

    // Cap delta to prevent spiral-of-death after tab switch
    if (dt > MAX_DT) dt = MAX_DT

    this.accumulator += dt

    while (this.accumulator >= FIXED_DT) {
      this.update(FIXED_DT)
      this.accumulator -= FIXED_DT
    }

    this.render()
    this.rafId = requestAnimationFrame(this.tick)
  }
}