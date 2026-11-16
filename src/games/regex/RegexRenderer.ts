import type { GameColors } from '../engine/types'
import type { RegexLevel, RegexPuzzle, RegexState } from './types'

const FONT_SIZE = 18
const LINE_HEIGHT = 28
const PADDING_X = 40
const PADDING_Y = 60
const PROMPT_Y_OFFSET = 80
const HUD_HEIGHT = 40

export class RegexRenderer {
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

  draw(puzzle: RegexPuzzle, state: RegexState, level: RegexLevel): void {
    const { ctx, width, height, colors } = this

    // Clear background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    // Draw buffer lines centered vertically
    const totalBufferHeight = puzzle.bufferLines.length * LINE_HEIGHT
    const bufferStartY = (height - PROMPT_Y_OFFSET - HUD_HEIGHT - totalBufferHeight) / 2 + PADDING_Y

    ctx.font = `${FONT_SIZE}px monospace`
    ctx.textBaseline = 'top'

    for (let i = 0; i < puzzle.bufferLines.length; i++) {
      const line = puzzle.bufferLines[i]
      const y = bufferStartY + i * LINE_HEIGHT

      // Draw line number gutter
      ctx.fillStyle = colors.line
      ctx.textAlign = 'right'
      ctx.fillText(`${i + 1}`, PADDING_X - 12, y)

      // Draw line text
      ctx.textAlign = 'left'
      ctx.fillStyle = colors.fg
      ctx.fillText(line, PADDING_X, y)

      // Highlight target regions with semi-transparent accent overlay
      for (const target of puzzle.targets) {
        if (target.line !== i) continue
        const startX = PADDING_X + ctx.measureText(line.slice(0, target.startCol)).width
        const endX = PADDING_X + ctx.measureText(line.slice(0, target.endCol)).width
        ctx.fillStyle = colors.accent
        ctx.globalAlpha = 0.25
        ctx.fillRect(startX, y - 2, endX - startX, LINE_HEIGHT - 2)
        ctx.globalAlpha = 1
      }

      // Draw match highlights from last submission
      for (const match of state.matchHighlights) {
        if (match.line !== i) continue
        const startX = PADDING_X + ctx.measureText(line.slice(0, match.startCol)).width
        const endX = PADDING_X + ctx.measureText(line.slice(0, match.endCol)).width
        const isCorrect = state.lastResult === 'correct'
        ctx.fillStyle = isCorrect ? '#4a9' : colors.warn
        ctx.globalAlpha = 0.35
        ctx.fillRect(startX, y + LINE_HEIGHT - 6, endX - startX, 4)
        ctx.globalAlpha = 1
      }
    }

    // Draw search prompt at bottom
    const promptY = height - PROMPT_Y_OFFSET
    ctx.fillStyle = colors.fg
    ctx.font = `${FONT_SIZE + 2}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const promptPrefix = '/'
    ctx.fillText(promptPrefix, PADDING_X, promptY)

    const prefixWidth = ctx.measureText(promptPrefix).width
    const patternX = PADDING_X + prefixWidth

    // Draw pattern text
    ctx.fillStyle = colors.accent
    ctx.fillText(state.currentPattern, patternX, promptY)

    // Draw cursor
    const cursorX = patternX + ctx.measureText(state.currentPattern.slice(0, state.patternCursorPos)).width
    ctx.fillStyle = colors.accent
    ctx.fillRect(cursorX, promptY, 2, FONT_SIZE + 2)

    // Draw feedback text
    if (state.lastResult !== 'none') {
      const feedbackY = promptY + FONT_SIZE + 12
      ctx.font = `bold ${FONT_SIZE}px monospace`
      ctx.textAlign = 'center'

      switch (state.lastResult) {
        case 'correct':
          ctx.fillStyle = '#4a9'
          ctx.fillText('Correct!', width / 2, feedbackY)
          break
        case 'partial':
          ctx.fillStyle = colors.warn
          ctx.fillText('Partial match — try again', width / 2, feedbackY)
          break
        case 'wrong':
          ctx.fillStyle = colors.warn
          ctx.fillText('No match — try again', width / 2, feedbackY)
          break
        case 'skipped':
          ctx.fillStyle = colors.line
          ctx.fillText('Skipped (max attempts)', width / 2, feedbackY)
          break
      }
    }

    // Draw HUD at top
    this.drawHUD(state, level)

    // Draw hint overlay when active
    if (state.hintIndex >= 0 && level.hints && level.hints[state.hintIndex]) {
      this.drawHintOverlay(level.hints[state.hintIndex], state.hintIndex, level.hints.length)
    }

    // Draw pause/game-over overlays
    if (state.isPaused || state.isGameOver) {
      this.drawOverlay(state)
    }
  }

  private drawHUD(state: RegexState, level: RegexLevel): void {
    const { ctx, width, colors } = this
    const hudY = 12

    ctx.font = '14px monospace'
    ctx.textBaseline = 'top'
    ctx.fillStyle = colors.fg

    // Left side: puzzle progress and level name
    ctx.textAlign = 'left'
    ctx.fillText(
      `${level.name} — Puzzle ${state.currentPuzzleIndex + 1}/${level.puzzles.length}`,
      PADDING_X,
      hudY,
    )

    // Center: score
    ctx.textAlign = 'center'
    ctx.fillText(`Score: ${state.score}`, width / 2, hudY)

    // Right side: attempts and time
    ctx.textAlign = 'right'
    const seconds = (state.elapsedMs / 1000).toFixed(1)
    ctx.fillText(
      `Attempts: ${state.currentAttempts}/${level.maxAttemptsPerPuzzle}  Time: ${seconds}s`,
      width - PADDING_X,
      hudY,
    )

    // Separator line
    ctx.strokeStyle = colors.line
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PADDING_X, hudY + 22)
    ctx.lineTo(width - PADDING_X, hudY + 22)
    ctx.stroke()
  }

  private drawHintOverlay(hint: string, index: number, total: number): void {
    const { ctx, width, height, colors } = this

    const boxWidth = Math.min(500, width - 80)
    const boxHeight = 60
    const boxX = (width - boxWidth) / 2
    const boxY = height / 2 - boxHeight / 2 - 40

    // Semi-transparent background
    ctx.fillStyle = colors.bg
    ctx.globalAlpha = 0.9
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
    ctx.globalAlpha = 1

    // Border
    ctx.strokeStyle = colors.accent
    ctx.lineWidth = 2
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

    // Hint text
    ctx.fillStyle = colors.accent
    ctx.font = '14px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Hint ${index + 1}/${total}: ${hint}`, width / 2, boxY + boxHeight / 2)
  }

  private drawOverlay(state: RegexState): void {
    const { ctx, width, height, colors } = this

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = colors.fg
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const centerX = width / 2
    const centerY = height / 2

    if (state.isGameOver) {
      ctx.fillText('LEVEL COMPLETE!', centerX, centerY - 30)
      ctx.font = '18px monospace'
      ctx.fillText(`Final Score: ${state.score}`, centerX, centerY + 10)
      ctx.fillStyle = colors.line
      ctx.font = '14px monospace'
      ctx.fillText('Press Enter to restart or Backspace to return', centerX, centerY + 44)
    } else {
      ctx.fillText('PAUSED', centerX, centerY - 14)
      ctx.font = '16px monospace'
      ctx.fillStyle = colors.line
      ctx.fillText('Press ESC to resume', centerX, centerY + 18)
    }
  }
}