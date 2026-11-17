import type { GameColors } from '../engine/types'
import type { ActiveObstacle, RacerLevel, RacerState } from './types'

const HUD_HEIGHT = 36
const CODE_LINES = [
  'function parse(tokens) {',
  '  const result = []',
  '  for (let i = 0; i < tokens.length; i++) {',
  '    if (tokens[i].type === "operator") {',
  '      result.push(transform(tokens[i]))',
  '    } else if (tokens[i].type === "motion") {',
  '      result.push(applyMotion(tokens[i]))',
  '    }',
  '  }',
  '  return result.filter(Boolean)',
  '}',
  '',
  'export function execute(cmd) {',
  '  const parsed = parse(tokenize(cmd))',
  '  return parsed.reduce((acc, op) => {',
  '    return acc.chain(op)',
  '  }, new CommandChain())',
  '}',
  '',
  'class CommandChain {',
  '  constructor() { this.ops = [] }',
  '  chain(op) { this.ops.push(op); return this }',
  '  run() { return this.ops.map(o => o.exec()) }',
  '}',
]

export class RacerRenderer {
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

  draw(state: RacerState, level: RacerLevel, typedBuffer: string): void {
    const { ctx, width, height, colors } = this
    const laneHeight = (height - HUD_HEIGHT) / level.laneCount

    // Clear background
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, height)

    // Draw scrolling code background
    this.drawCodeBackground(state.scrollPosition)

    // Draw lane dividers
    this.drawLaneDividers(level.laneCount, laneHeight)

    // Draw player cursor
    this.drawPlayer(state.currentLane, laneHeight)

    // Draw obstacles
    for (const obs of state.activeObstacles) {
      if (obs.cleared || obs.missed) continue
      if (obs.screenX < -100 || obs.screenX > width + 100) continue
      this.drawObstacle(obs, laneHeight)
    }

    // Draw command prompt overlay for active obstacle
    const activeObs = state.activeObstacles.find(
      (o) => o.prompted && !o.cleared && !o.missed && o.lane === state.currentLane,
    )
    if (activeObs) {
      this.drawCommandPrompt(activeObs, typedBuffer, laneHeight)
    }

    // Draw HUD
    this.drawHUD(state, level)

    // Draw pause overlay
    if (state.isPaused) {
      this.drawOverlay('PAUSED', 'Press ESC to resume')
    }

    // Draw game over overlay
    if (state.isGameOver) {
      const subtitle = state.scrollPosition >= level.trackLength
        ? `Track Complete! Score: ${state.score}  |  Press Enter to restart`
        : `Game Over  |  Score: ${state.score}  |  Press Enter to restart`
      this.drawOverlay(state.scrollPosition >= level.trackLength ? 'FINISHED' : 'GAME OVER', subtitle)
    }
  }

  private drawCodeBackground(scrollPosition: number): void {
    const { ctx, height, colors } = this
    const lineHeight = 22
    const offset = Math.floor(scrollPosition * 0.3) % (CODE_LINES.length * lineHeight)

    ctx.font = '13px monospace'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'

    for (let i = 0; i < Math.ceil(height / lineHeight) + 1; i++) {
      const lineIndex = (Math.floor(offset / lineHeight) + i) % CODE_LINES.length
      const y = i * lineHeight - (offset % lineHeight) + HUD_HEIGHT
      const line = CODE_LINES[lineIndex] ?? ''

      ctx.fillStyle = colors.line
      ctx.globalAlpha = 0.3
      ctx.fillText(line, 8 - (scrollPosition * 0.1) % 200, y)
      ctx.globalAlpha = 1
    }
  }

  private drawLaneDividers(laneCount: number, laneHeight: number): void {
    const { ctx, width, colors } = this

    ctx.strokeStyle = colors.line
    ctx.lineWidth = 1
    ctx.setLineDash([8, 6])

    for (let i = 1; i < laneCount; i++) {
      const y = HUD_HEIGHT + i * laneHeight
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    ctx.setLineDash([])
  }

  private drawPlayer(lane: number, laneHeight: number): void {
    const { ctx, colors } = this
    const playerX = this.width * 0.15
    const laneY = HUD_HEIGHT + lane * laneHeight + laneHeight / 2

    // Draw cursor block
    ctx.fillStyle = colors.accent
    ctx.fillRect(playerX - 6, laneY - 12, 12, 24)

    // Glow effect
    ctx.shadowColor = colors.accent
    ctx.shadowBlur = 10
    ctx.fillRect(playerX - 4, laneY - 10, 8, 20)
    ctx.shadowBlur = 0
  }

  private drawObstacle(obs: ActiveObstacle, laneHeight: number): void {
    const { ctx, colors } = this
    const laneY = HUD_HEIGHT + obs.lane * laneHeight + laneHeight / 2

    // Obstacle box
    ctx.font = 'bold 14px monospace'
    const textWidth = ctx.measureText(obs.command).width
    const boxWidth = textWidth + 20
    const boxHeight = 30
    const boxX = obs.screenX - boxWidth / 2
    const boxY = laneY - boxHeight / 2

    // Background
    ctx.fillStyle = obs.prompted ? colors.warn : colors.line
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight)

    // Border
    ctx.strokeStyle = obs.prompted ? colors.warn : colors.fg
    ctx.lineWidth = obs.prompted ? 2 : 1
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

    // Command text
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillStyle = obs.prompted ? colors.bg : colors.fg
    ctx.fillText(obs.command, obs.screenX, laneY)

    // Label above
    ctx.font = '11px monospace'
    ctx.fillStyle = colors.fg
    ctx.globalAlpha = 0.7
    ctx.fillText(obs.label, obs.screenX, boxY - 8)
    ctx.globalAlpha = 1
  }

  private drawCommandPrompt(obs: ActiveObstacle, typedBuffer: string, laneHeight: number): void {
    const { ctx, width, colors } = this
    const promptY = HUD_HEIGHT + obs.lane * laneHeight + laneHeight / 2

    // Semi-transparent overlay bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, promptY - 20, width, 40)

    ctx.font = 'bold 20px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'

    const centerX = width / 2
    const typedStr = typedBuffer
    const remainingStr = obs.command.slice(typedBuffer.length)

    // Typed portion in accent
    if (typedStr.length > 0) {
      ctx.fillStyle = colors.accent
      const fullWidth = ctx.measureText(obs.command).width
      const startX = centerX - fullWidth / 2
      ctx.textAlign = 'left'
      ctx.fillText(typedStr, startX, promptY)
    }

    // Remaining portion in dim
    if (remainingStr.length > 0) {
      ctx.fillStyle = colors.fg
      ctx.globalAlpha = 0.5
      const typedWidth = ctx.measureText(typedStr).width
      const fullWidth = ctx.measureText(obs.command).width
      const startX = centerX - fullWidth / 2 + typedWidth
      ctx.textAlign = 'left'
      ctx.fillText(remainingStr, startX, promptY)
      ctx.globalAlpha = 1
    }
  }

  private drawHUD(state: RacerState, level: RacerLevel): void {
    const { ctx, width, colors } = this

    // HUD background
    ctx.fillStyle = colors.line
    ctx.fillRect(0, 0, width, HUD_HEIGHT)

    ctx.font = '13px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const hudY = HUD_HEIGHT / 2

    // Score
    ctx.fillStyle = colors.fg
    ctx.fillText(`Score: ${state.score}`, 12, hudY)

    // Combo
    if (state.combo > 0) {
      ctx.fillStyle = colors.accent
      ctx.fillText(`Combo: ${state.combo}x`, 150, hudY)
    }

    // Lives
    ctx.fillStyle = state.lives <= 1 ? colors.warn : colors.fg
    ctx.fillText(`Lives: ${state.lives}`, 290, hudY)

    // Speed
    ctx.fillStyle = colors.fg
    ctx.fillText(`Speed: ${state.speedMultiplier.toFixed(1)}x`, 400, hudY)

    // Distance progress bar
    const progress = Math.min(1, state.scrollPosition / level.trackLength)
    const barX = 540
    const barWidth = 200
    const barHeight = 12

    ctx.fillStyle = colors.line
    ctx.fillRect(barX, hudY - barHeight / 2, barWidth, barHeight)

    ctx.fillStyle = colors.accent
    ctx.fillRect(barX, hudY - barHeight / 2, barWidth * progress, barHeight)

    ctx.strokeStyle = colors.fg
    ctx.lineWidth = 1
    ctx.strokeRect(barX, hudY - barHeight / 2, barWidth, barHeight)

    // Progress percentage
    ctx.textAlign = 'right'
    ctx.fillStyle = colors.fg
    ctx.fillText(`${Math.round(progress * 100)}%`, width - 12, hudY)
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