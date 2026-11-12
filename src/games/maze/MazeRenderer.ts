import type { GameColors } from '../engine/types'
import type { CellType, DoorSpec } from './types'

interface MazeRenderState {
  elapsedMs: number
  collectiblesLeft: number
  inputBuffer: string
  score: number
  isGameOver: boolean
  isPaused: boolean
}

export class MazeRenderer {
  private colors: GameColors

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly cellSize: number,
  ) {}

  setColors(colors: GameColors): void {
    this.colors = colors
  }

  draw(
    grid: CellType[][],
    doors: DoorSpec[],
    playerRow: number,
    playerCol: number,
    state: MazeRenderState,
  ): void {
    const { ctx, cellSize, colors } = this
    const height = grid.length
    const width = grid[0]?.length ?? 0

    // Clear background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width * cellSize, height * cellSize + 48)

    // Draw grid
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const x = c * cellSize
        const y = r * cellSize
        const cell = grid[r][c]

        if (cell === 'wall') {
          ctx.fillStyle = colors.line
          ctx.fillRect(x, y, cellSize, cellSize)
        } else if (cell === 'collectible') {
          this.drawDiamond(x + cellSize / 2, y + cellSize / 2, cellSize * 0.3, colors.warn)
        } else if (cell === 'goal') {
          ctx.fillStyle = colors.accent
          ctx.globalAlpha = 0.3
          ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4)
          ctx.globalAlpha = 1
          // Draw "G" label
          ctx.fillStyle = colors.accent
          ctx.font = `bold ${cellSize * 0.5}px monospace`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('G', x + cellSize / 2, y + cellSize / 2)
        } else if (cell === 'door') {
          // Find matching door spec
          const door = doors.find((d) => d.row === r && d.col === c)
          ctx.fillStyle = colors.warn
          ctx.fillRect(x + 4, y + cellSize * 0.3, cellSize - 8, cellSize * 0.4)
          if (door) {
            ctx.fillStyle = colors.bg
            ctx.font = `${cellSize * 0.35}px monospace`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(door.command, x + cellSize / 2, y + cellSize / 2)
          }
        }
      }
    }

    // Draw player
    const px = playerCol * cellSize + 4
    const py = playerRow * cellSize + 4
    ctx.fillStyle = colors.accent
    ctx.fillRect(px, py, cellSize - 8, cellSize - 8)

    // Draw HUD below the grid
    const hudY = height * cellSize + 4
    ctx.fillStyle = colors.fg
    ctx.font = '14px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const seconds = (state.elapsedMs / 1000).toFixed(1)
    ctx.fillText(`Time: ${seconds}s`, 8, hudY)
    ctx.fillText(`Score: ${state.score}`, 8, hudY + 18)
    ctx.fillText(`Items: ${state.collectiblesLeft}`, 160, hudY)

    if (state.inputBuffer) {
      ctx.fillStyle = colors.warn
      ctx.fillText(`Keys: ${state.inputBuffer}`, 160, hudY + 18)
    }

    // Overlay for pause/game-over
    if (state.isPaused || state.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, 0, width * cellSize, height * cellSize)

      ctx.fillStyle = colors.fg
      ctx.font = 'bold 24px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const centerX = (width * cellSize) / 2
      const centerY = (height * cellSize) / 2

      if (state.isGameOver) {
        ctx.fillText('COMPLETE!', centerX, centerY - 20)
        ctx.font = '16px monospace'
        ctx.fillText(`Final Score: ${state.score}`, centerX, centerY + 16)
        ctx.fillText('Press ESC to return', centerX, centerY + 44)
      } else {
        ctx.fillText('PAUSED', centerX, centerY - 10)
        ctx.font = '16px monospace'
        ctx.fillText('Press ESC to resume', centerX, centerY + 20)
      }
    }
  }

  private drawDiamond(cx: number, cy: number, radius: number, color: string): void {
    const { ctx } = this
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx, cy - radius)
    ctx.lineTo(cx + radius, cy)
    ctx.lineTo(cx, cy + radius)
    ctx.lineTo(cx - radius, cy)
    ctx.closePath()
    ctx.fill()
  }
}