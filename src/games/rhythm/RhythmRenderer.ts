import type { GameColors } from '../engine/types'
import type { NoteEvent, RhythmState } from './types' // HitResult used in feedback popups

interface FeedbackPopup {
  text: string
  lane: number
  createdAt: number
  durationMs: number
}

interface LaneFlash {
  lane: number
  createdAt: number
}

interface RhythmRenderConfig {
  scrollDurationMs: number
  hitZoneY: number
  playfieldTopY: number
  laneWidth: number
  canvasHeight: number
  canvasWidth: number
}

interface RhythmDrawArgs {
  notes: NoteEvent[]
  songTimeMs: number
  state: RhythmState
  feedbacks: FeedbackPopup[]
  laneFlashes: LaneFlash[]
}

export class RhythmRenderer {
  private colors: GameColors

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    colors?: GameColors,
    private readonly config?: RhythmRenderConfig,
  ) {
    this.colors = colors ?? { bg: '#1a1a2e', fg: '#e0e0e0', accent: '#d4a574', warn: '#c0392b', line: '#333' }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
  }

  draw(args: RhythmDrawArgs): void {
    const { ctx, colors, config } = this
    if (!config) return

    const { scrollDurationMs, hitZoneY, playfieldTopY, laneWidth, canvasHeight, canvasWidth } = config
    const { notes, songTimeMs, state, feedbacks, laneFlashes } = args
    const laneCount = state.laneKeys.length || 4

    // Clear background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw lane dividers
    ctx.strokeStyle = colors.line
    ctx.lineWidth = 1
    for (let i = 0; i <= laneCount; i++) {
      const x = i * laneWidth
      ctx.beginPath()
      ctx.moveTo(x, playfieldTopY)
      ctx.lineTo(x, hitZoneY + 40)
      ctx.stroke()
    }

    // Draw hit zone band
    ctx.fillStyle = colors.accent
    ctx.globalAlpha = 0.15
    ctx.fillRect(0, hitZoneY - 20, canvasWidth, 40)
    ctx.globalAlpha = 1

    // Draw lane flashes on hit
    const now = performance.now()
    for (const flash of laneFlashes) {
      const age = now - flash.createdAt
      if (age >= 200) continue
      const opacity = 1 - age / 200
      ctx.fillStyle = colors.accent
      ctx.globalAlpha = opacity * 0.4
      ctx.fillRect(flash.lane * laneWidth, hitZoneY - 20, laneWidth, 40)
      ctx.globalAlpha = 1
    }

    // Draw notes
    for (const note of notes) {
      if (note.hit || note.missed) continue
      const y = this.noteY(note.timeMs, songTimeMs, scrollDurationMs, hitZoneY, playfieldTopY)
      if (y < playfieldTopY - 30 || y > hitZoneY + 60) continue

      const x = note.lane * laneWidth + laneWidth / 2
      const noteWidth = laneWidth * 0.6
      const noteHeight = 16

      ctx.fillStyle = colors.accent
      this.drawRoundedRect(x - noteWidth / 2, y - noteHeight / 2, noteWidth, noteHeight, 4)
    }

    // Draw key labels below hit zone
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < laneCount; i++) {
      const x = i * laneWidth + laneWidth / 2
      ctx.fillStyle = colors.fg
      ctx.fillText(state.laneKeys[i] ?? '?', x, hitZoneY + 50)
    }

    // Draw HUD at top
    ctx.fillStyle = colors.fg
    ctx.font = 'bold 16px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`Score: ${state.score}`, 8, 8)

    ctx.textAlign = 'center'
    ctx.fillText(`${state.combo} combo`, canvasWidth / 2, 8)

    ctx.textAlign = 'right'
    ctx.fillText(`${state.multiplier}x`, canvasWidth - 8, 8)

    // Draw feedback popups
    for (const fb of feedbacks) {
      const age = now - fb.createdAt
      if (age >= fb.durationMs) continue
      const progress = age / fb.durationMs
      const opacity = 1 - progress
      const floatY = hitZoneY - 40 - progress * 30

      const x = fb.lane * laneWidth + laneWidth / 2
      ctx.globalAlpha = opacity
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (fb.text === 'PERFECT!') {
        ctx.fillStyle = colors.accent
      } else if (fb.text === 'GOOD') {
        ctx.fillStyle = colors.fg
      } else {
        ctx.fillStyle = colors.warn
      }

      ctx.fillText(fb.text, x, floatY)
      ctx.globalAlpha = 1
    }

    // Progress bar at very top
    ctx.fillStyle = colors.line
    ctx.fillRect(0, 0, canvasWidth, 3)
    ctx.fillStyle = colors.accent
    ctx.fillRect(0, 0, canvasWidth * state.songProgress, 3)

    // Overlay for pause/game-over
    if (state.isPaused || state.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      ctx.fillStyle = colors.fg
      ctx.font = 'bold 24px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2

      if (state.isGameOver) {
        ctx.fillText('SONG COMPLETE!', centerX, centerY - 40)
        ctx.font = '16px monospace'
        ctx.fillText(`Final Score: ${state.score}`, centerX, centerY - 10)
        ctx.fillText(`Max Combo: ${state.maxCombo}`, centerX, centerY + 14)
        ctx.fillText(`Perfect: ${state.perfectCount}  Good: ${state.goodCount}  Miss: ${state.missCount}`, centerX, centerY + 38)
        ctx.fillText('Press ESC to return', centerX, centerY + 68)
      } else {
        ctx.fillText('PAUSED', centerX, centerY - 10)
        ctx.font = '16px monospace'
        ctx.fillText('Press ESC to resume', centerX, centerY + 20)
      }
    }
  }

  private noteY(
    noteTimeMs: number,
    songTimeMs: number,
    scrollDurationMs: number,
    hitZoneY: number,
    playfieldTopY: number,
  ): number {
    const timeUntilHit = noteTimeMs - songTimeMs
    const progress = 1 - timeUntilHit / scrollDurationMs
    return playfieldTopY + progress * (hitZoneY - playfieldTopY)
  }

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
  }
}