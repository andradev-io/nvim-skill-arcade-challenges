import type { GameColors } from '../engine/types'
import type { DefenderState, Enemy, Explosion } from './types'

const BASE_WIDTH = 40
const ENEMY_HEIGHT = 28
const ENEMY_PADDING_X = 8
const EXPLOSION_MAX_RADIUS = 20
const WAVE_ANNOUNCE_DURATION_MS = 1500

export class DefenderRenderer {
  private colors: GameColors

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly width: number,
    private readonly height: number,
    colors?: GameColors,
  ) {
    this.colors = colors ?? { bg: '#1e1e1e', fg: '#d4d4d4', accent: '#d4a053', warn: '#c9784a', line: '#3c3c3c' }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
  }

  draw(state: DefenderState, enemies: Enemy[], explosions: Explosion[], waveAnnounceStartMs: number): void {
    const { ctx, width, height, colors } = this

    // Clear background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    // Draw base (left bar)
    this.drawBase(state.lives)

    // Draw enemies
    for (const enemy of enemies) {
      if (!enemy.alive) continue
      this.drawEnemy(enemy)
    }

    // Draw explosions
    const now = performance.now()
    for (const explosion of explosions) {
      this.drawExplosion(explosion, now)
    }

    // Draw HUD
    this.drawHUD(state)

    // Draw wave announcement overlay
    if (state.waveActive && waveAnnounceStartMs > 0) {
      const elapsed = now - waveAnnounceStartMs
      if (elapsed < WAVE_ANNOUNCE_DURATION_MS) {
        this.drawWaveAnnouncement(state.wave, elapsed)
      }
    }

    // Draw pause overlay
    if (state.isPaused) {
      this.drawOverlay('PAUSED', 'Press ESC to resume')
    }

    // Draw game over overlay
    if (state.isGameOver) {
      this.drawOverlay('GAME OVER', `Final Score: ${state.score}  |  Press Enter to restart`)
    }
  }

  private drawBase(lives: number): void {
    const { ctx, height, colors } = this

    // Base bar
    ctx.fillStyle = colors.line
    ctx.fillRect(0, 0, BASE_WIDTH, height)

    // Life pips
    const pipSize = 10
    const pipGap = 6
    const startY = height / 2 - ((lives * (pipSize + pipGap)) - pipGap) / 2
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = colors.accent
      ctx.beginPath()
      ctx.arc(BASE_WIDTH / 2, startY + i * (pipSize + pipGap) + pipSize / 2, pipSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawEnemy(enemy: Enemy): void {
    const { ctx, colors } = this

    const label = enemy.command
    ctx.font = 'bold 14px monospace'
    const textWidth = ctx.measureText(label).width
    const boxWidth = textWidth + ENEMY_PADDING_X * 2
    const boxX = enemy.x - boxWidth / 2
    const boxY = enemy.y - ENEMY_HEIGHT / 2

    // Enemy background rect
    ctx.fillStyle = colors.line
    ctx.fillRect(boxX, boxY, boxWidth, ENEMY_HEIGHT)

    // Border
    ctx.strokeStyle = colors.fg
    ctx.lineWidth = 1
    ctx.strokeRect(boxX, boxY, boxWidth, ENEMY_HEIGHT)

    // Typed portion in accent color
    const typedStr = label.slice(0, enemy.typedCount)
    const remainingStr = label.slice(enemy.typedCount)

    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const textX = boxX + ENEMY_PADDING_X
    const textY = enemy.y

    if (typedStr.length > 0) {
      ctx.fillStyle = colors.accent
      ctx.fillText(typedStr, textX, textY)
    }

    if (remainingStr.length > 0) {
      const typedWidth = ctx.measureText(typedStr).width
      ctx.fillStyle = colors.fg
      ctx.fillText(remainingStr, textX + typedWidth, textY)
    }
  }

  private drawExplosion(explosion: Explosion, now: number): void {
    const { ctx, colors } = this
    const elapsed = now - explosion.startTime
    const progress = Math.min(1, elapsed / explosion.duration)
    const radius = EXPLOSION_MAX_RADIUS * progress
    const alpha = 1 - progress

    ctx.globalAlpha = alpha
    ctx.fillStyle = colors.warn
    ctx.beginPath()
    ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  private drawHUD(state: DefenderState): void {
    const { ctx, width, colors } = this

    ctx.font = '14px monospace'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    const hudY = 8

    // Score
    ctx.fillStyle = colors.fg
    ctx.fillText(`Score: ${state.score}`, BASE_WIDTH + 12, hudY)

    // Wave
    ctx.fillText(`Wave: ${state.wave}`, BASE_WIDTH + 160, hudY)

    // Streak
    if (state.streak > 0) {
      ctx.fillStyle = colors.accent
      ctx.fillText(`Streak: ${state.streak}`, BASE_WIDTH + 280, hudY)
    }

    // Enemies left
    ctx.fillStyle = colors.fg
    ctx.textAlign = 'right'
    ctx.fillText(`Enemies: ${state.waveEnemiesLeft}`, width - 12, hudY)

    // Buffer display at bottom
    if (state.buffer.length > 0) {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.font = 'bold 16px monospace'
      ctx.fillStyle = colors.accent
      ctx.fillText(`> ${state.buffer}`, BASE_WIDTH + 12, this.height - 8)
    }
  }

  private drawWaveAnnouncement(wave: number, elapsedMs: number): void {
    const { ctx, width, height, colors } = this
    const alpha = Math.max(0, 1 - elapsedMs / WAVE_ANNOUNCE_DURATION_MS)

    ctx.globalAlpha = alpha
    ctx.fillStyle = colors.accent
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`WAVE ${wave}`, width / 2, height / 2)
    ctx.globalAlpha = 1
  }

  private drawOverlay(title: string, subtitle: string): void {
    const { ctx, width, height, colors } = this

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = colors.fg
    ctx.font = 'bold 32px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, width / 2, height / 2 - 20)

    ctx.font = '16px monospace'
    ctx.fillText(subtitle, width / 2, height / 2 + 20)
  }
}