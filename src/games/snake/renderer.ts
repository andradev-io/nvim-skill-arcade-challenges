import type { GameColors } from '../engine/types'
import type { SnakeLevel, SnakeState } from './types'

const TIP_DURATION_MS = 2000

export class SnakeRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly cellSize: number
  private colors: GameColors

  constructor(ctx: CanvasRenderingContext2D, cellSize: number, colors: GameColors) {
    this.ctx = ctx
    this.cellSize = cellSize
    this.colors = colors
  }

  setColors(colors: GameColors): void {
    this.colors = colors
  }

  draw(state: SnakeState, level: SnakeLevel): void {
    const { width, height } = level
    const cs = this.cellSize

    // Clear background
    this.ctx.fillStyle = this.colors.bg
    this.ctx.fillRect(0, 0, width * cs, height * cs + 48)

    // Draw grid lines
    this.ctx.strokeStyle = this.colors.line
    this.ctx.lineWidth = 0.5
    this.ctx.globalAlpha = 0.3
    for (let r = 0; r <= height; r++) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, r * cs)
      this.ctx.lineTo(width * cs, r * cs)
      this.ctx.stroke()
    }
    for (let c = 0; c <= width; c++) {
      this.ctx.beginPath()
      this.ctx.moveTo(c * cs, 0)
      this.ctx.lineTo(c * cs, height * cs)
      this.ctx.stroke()
    }
    this.ctx.globalAlpha = 1

    // Draw walls
    this.ctx.fillStyle = this.colors.line
    for (const wall of level.walls) {
      this.ctx.fillRect(wall.col * cs, wall.row * cs, cs, cs)
    }

    // Draw food items
    for (const food of state.food) {
      const cx = food.position.col * cs + cs / 2
      const cy = food.position.row * cs + cs / 2
      const radius = cs * 0.35

      // Diamond shape
      this.ctx.fillStyle = this.colors.warn
      this.ctx.beginPath()
      this.ctx.moveTo(cx, cy - radius)
      this.ctx.lineTo(cx + radius, cy)
      this.ctx.lineTo(cx, cy + radius)
      this.ctx.lineTo(cx - radius, cy)
      this.ctx.closePath()
      this.ctx.fill()

      // Label text
      this.ctx.fillStyle = this.colors.bg
      this.ctx.font = `bold ${Math.max(8, cs * 0.35)}px monospace`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      const labelText = food.label.length > 4 ? food.label.slice(0, 4) : food.label
      this.ctx.fillText(labelText, cx, cy)
    }

    // Draw snake body
    for (let i = state.snake.length - 1; i >= 0; i--) {
      const seg = state.snake[i]
      const isHead = i === 0

      if (isHead) {
        // Head: brighter accent with border
        this.ctx.fillStyle = this.colors.accent
        this.ctx.fillRect(seg.col * cs + 1, seg.row * cs + 1, cs - 2, cs - 2)
        this.ctx.strokeStyle = this.colors.fg
        this.ctx.lineWidth = 1.5
        this.ctx.strokeRect(seg.col * cs + 1, seg.row * cs + 1, cs - 2, cs - 2)
      } else {
        // Body: slightly transparent accent
        this.ctx.globalAlpha = 0.7
        this.ctx.fillStyle = this.colors.accent
        this.ctx.fillRect(seg.col * cs + 2, seg.row * cs + 2, cs - 4, cs - 4)
        this.ctx.globalAlpha = 1
      }
    }

    // Draw tip overlay
    if (state.lastTip) {
      const elapsed = performance.now() - (state.elapsedMs - state.elapsedMs) // approximate
      const alpha = Math.max(0, 1 - elapsed / TIP_DURATION_MS)
      if (alpha > 0) {
        this.ctx.globalAlpha = Math.min(alpha, 0.95)
        this.ctx.fillStyle = this.colors.bg
        const tipY = height * cs * 0.3
        const tipH = 32
        this.ctx.fillRect(0, tipY - tipH / 2, width * cs, tipH)

        this.ctx.globalAlpha = Math.min(alpha, 1)
        this.ctx.fillStyle = this.colors.warn
        this.ctx.font = `bold ${cs * 0.5}px monospace`
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.fillText(state.lastTip, (width * cs) / 2, tipY)
        this.ctx.globalAlpha = 1
      }
    }

    // Draw HUD below the grid
    const hudY = height * cs + 4
    this.ctx.fillStyle = this.colors.fg
    this.ctx.font = `${cs * 0.5}px monospace`
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'

    const elapsedSec = (state.elapsedMs / 1000).toFixed(1)
    const speedLabel = `${state.score}pts | ${state.foodsEaten} eaten | ${elapsedSec}s`
    this.ctx.fillText(speedLabel, 4, hudY + 4)

    // Status indicator
    this.ctx.textAlign = 'right'
    const statusText = state.isPaused ? 'PAUSED'
      : state.isGameOver ? 'GAME OVER'
        : !state.isRunning ? 'READY'
          : 'RUNNING'

    this.ctx.fillStyle = state.isGameOver ? this.colors.warn : this.colors.fg
    this.ctx.fillText(statusText, width * cs - 4, hudY + 4)

    // Pause/Game Over overlays
    if (state.isPaused || state.isGameOver) {
      this.ctx.globalAlpha = 0.6
      this.ctx.fillStyle = this.colors.bg
      this.ctx.fillRect(0, 0, width * cs, height * cs)
      this.ctx.globalAlpha = 1

      this.ctx.fillStyle = this.colors.fg
      this.ctx.font = `bold ${cs * 1.2}px monospace`
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'

      const centerX = (width * cs) / 2
      const centerY = (height * cs) / 2

      if (state.isGameOver) {
        this.ctx.fillStyle = this.colors.warn
        this.ctx.fillText('GAME OVER', centerX, centerY - cs)
        this.ctx.fillStyle = this.colors.fg
        this.ctx.font = `${cs * 0.6}px monospace`
        this.ctx.fillText(`Score: ${state.score}`, centerX, centerY + cs * 0.5)
        this.ctx.fillText('Enter to restart', centerX, centerY + cs * 1.5)
      } else {
        this.ctx.fillText('PAUSED', centerX, centerY - cs * 0.5)
        this.ctx.font = `${cs * 0.5}px monospace`
        this.ctx.fillText('ESC to resume', centerX, centerY + cs * 0.5)
      }
    }
  }
}