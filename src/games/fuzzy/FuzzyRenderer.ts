import type { GameColors } from '../engine/types'
import { matchPositions } from './fuzzyMatch'
import type { FuzzyEntry } from './types'

interface FuzzyRenderState {
  entries: ReadonlyArray<FuzzyEntry>
  filteredIndices: number[]
  cursorIndex: number
  searchQuery: string
  hint: string
  roundIndex: number
  totalRounds: number
  score: number
  keystrokes: number
  elapsedMs: number
  isPaused: boolean
  isGameOver: boolean
  lastResult: 'none' | 'correct' | 'wrong' | 'skipped'
  feedbackTimer: number
  feedbackDuration: number
  levelName: string
}

const ENTRY_HEIGHT = 24
const PROMPT_HEIGHT = 32
const HUD_HEIGHT = 28
const MAX_VISIBLE_ENTRIES = 18
const PADDING_X = 12

export class FuzzyRenderer {
  private colors: GameColors

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    readonly canvas: HTMLCanvasElement,
    colors?: GameColors,
  ) {
    this.colors = colors ?? { bg: '#1e1e1e', fg: '#d4d4d4', accent: '#d4a053', warn: '#c9784a', line: '#3c3c3c' }
  }

  setColors(colors: GameColors): void {
    this.colors = colors
  }

  draw(state: FuzzyRenderState): void {
    const { ctx, colors, canvas } = this
    const w = canvas.width
    const h = canvas.height

    // Clear
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, w, h)

    // Search prompt area
    this.drawPrompt(state.searchQuery, w)

    // Separator line
    ctx.fillStyle = colors.line
    ctx.fillRect(PADDING_X, PROMPT_HEIGHT - 1, w - PADDING_X * 2, 1)

    // Entry list
    this.drawEntries(state, w, h)

    // HUD at bottom
    this.drawHUD(state, w, h)

    // Feedback flash overlay
    if (state.feedbackTimer > 0 && state.lastResult !== 'none') {
      this.drawFeedback(state, w, h)
    }

    // Pause / game-over overlays
    if (state.isPaused || state.isGameOver) {
      this.drawOverlay(state, w, h)
    }
  }

  private drawPrompt(query: string, _w: number): void {
    const { ctx, colors } = this
    ctx.font = 'bold 16px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const y = PROMPT_HEIGHT / 2
    const promptPrefix = '> '

    // Prompt symbol in accent
    ctx.fillStyle = colors.accent
    ctx.fillText(promptPrefix, PADDING_X, y)

    // Query text
    const prefixWidth = ctx.measureText(promptPrefix).width
    ctx.fillStyle = colors.fg
    ctx.fillText(query, PADDING_X + prefixWidth, y)

    // Cursor blink (simple: always show as block after text)
    const queryWidth = ctx.measureText(query).width
    const cursorX = PADDING_X + prefixWidth + queryWidth + 2
    ctx.fillStyle = colors.accent
    ctx.globalAlpha = 0.7
    ctx.fillRect(cursorX, y - 8, 8, 16)
    ctx.globalAlpha = 1
  }

  private drawEntries(state: FuzzyRenderState, w: number, h: number): void {
    const { ctx, colors } = this
    const maxVisible = Math.min(MAX_VISIBLE_ENTRIES, Math.floor((h - PROMPT_HEIGHT - HUD_HEIGHT) / ENTRY_HEIGHT))
    const totalFiltered = state.filteredIndices.length

    // Scroll offset: keep cursor visible
    let scrollOffset = 0
    if (state.cursorIndex >= maxVisible) {
      scrollOffset = state.cursorIndex - maxVisible + 1
    }

    const visibleEnd = Math.min(scrollOffset + maxVisible, totalFiltered)

    for (let vi = scrollOffset; vi < visibleEnd; vi++) {
      const originalIndex = state.filteredIndices[vi]
      const entry = state.entries[originalIndex]
      const y = PROMPT_HEIGHT + (vi - scrollOffset) * ENTRY_HEIGHT
      const isSelected = vi === state.cursorIndex

      // Selection highlight
      if (isSelected) {
        ctx.fillStyle = colors.accent
        ctx.globalAlpha = 0.15
        ctx.fillRect(PADDING_X - 4, y, w - PADDING_X * 2 + 8, ENTRY_HEIGHT)
        ctx.globalAlpha = 1

        // Arrow indicator
        ctx.fillStyle = colors.accent
        ctx.font = '14px monospace'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText('>', PADDING_X - 2, y + ENTRY_HEIGHT / 2)
      }

      // Category badge
      let textStartX = PADDING_X + 14
      if (entry.category) {
        this.drawCategoryBadge(entry.category, textStartX, y + ENTRY_HEIGHT / 2)
        textStartX += ctx.measureText(`[${entry.category}]`).width + 10
      }

      // Entry text with match highlighting
      const positions = matchPositions(state.searchQuery, entry.text)
      this.drawHighlightedText(entry.text, positions, textStartX, y + ENTRY_HEIGHT / 2, isSelected)
    }

    // "No matches" message
    if (totalFiltered === 0 && state.searchQuery.length > 0) {
      ctx.fillStyle = colors.warn
      ctx.font = '14px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText('No matches', w / 2, PROMPT_HEIGHT + 40)
    }

    // Hint text when query is empty
    if (state.searchQuery.length === 0 && state.hint) {
      ctx.fillStyle = colors.fg
      ctx.globalAlpha = 0.5
      ctx.font = 'italic 13px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(state.hint, w / 2, PROMPT_HEIGHT + 40)
      ctx.globalAlpha = 1
    }
  }

  private drawCategoryBadge(category: string, x: number, y: number): void {
    const { ctx, colors } = this
    ctx.font = '11px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const label = `[${category}]`
    const width = ctx.measureText(label).width + 8

    // Badge background
    ctx.fillStyle = colors.line
    ctx.globalAlpha = 0.6
    ctx.fillRect(x, y - 8, width, 16)
    ctx.globalAlpha = 1

    // Badge text
    ctx.fillStyle = colors.accent
    ctx.fillText(label, x + 4, y)
  }

  private drawHighlightedText(
    text: string,
    matchPositions: number[],
    x: number,
    y: number,
    isSelected: boolean,
  ): void {
    const { ctx, colors } = this
    ctx.font = '14px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const posSet = new Set(matchPositions)
    let currentX = x

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const isMatch = posSet.has(i)

      if (isMatch) {
        ctx.fillStyle = colors.accent
        ctx.font = 'bold 14px monospace'
      } else {
        ctx.fillStyle = isSelected ? colors.fg : colors.fg
        ctx.globalAlpha = isSelected ? 1 : 0.8
        ctx.font = '14px monospace'
      }

      ctx.fillText(ch, currentX, y)
      currentX += ctx.measureText(ch).width
      ctx.globalAlpha = 1
    }
  }

  private drawHUD(state: FuzzyRenderState, w: number, h: number): void {
    const { ctx, colors } = this
    const hudY = h - HUD_HEIGHT + 4

    // Top separator
    ctx.fillStyle = colors.line
    ctx.fillRect(PADDING_X, h - HUD_HEIGHT, w - PADDING_X * 2, 1)

    ctx.font = '13px monospace'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = colors.fg

    const seconds = (state.elapsedMs / 1000).toFixed(1)
    ctx.fillText(`Round: ${state.roundIndex + 1}/${state.totalRounds}`, PADDING_X, hudY + HUD_HEIGHT / 2)
    ctx.fillText(`Score: ${state.score}`, PADDING_X + 140, hudY + HUD_HEIGHT / 2)
    ctx.fillText(`Keys: ${state.keystrokes}`, PADDING_X + 260, hudY + HUD_HEIGHT / 2)
    ctx.fillText(`${seconds}s`, PADDING_X + 360, hudY + HUD_HEIGHT / 2)

    // Match count on right
    ctx.textAlign = 'right'
    ctx.fillStyle = colors.accent
    ctx.fillText(`${state.filteredIndices.length} matches`, w - PADDING_X, hudY + HUD_HEIGHT / 2)
  }

  private drawFeedback(state: FuzzyRenderState, w: number, h: number): void {
    const { ctx, colors } = this
    const opacity = state.feedbackTimer / state.feedbackDuration

    let color: string
    let label: string
    if (state.lastResult === 'correct') {
      color = colors.accent
      label = 'CORRECT!'
    } else if (state.lastResult === 'wrong') {
      color = colors.warn
      label = 'WRONG'
    } else if (state.lastResult === 'skipped') {
      color = colors.warn
      label = 'SKIPPED'
    } else {
      return
    }

    ctx.fillStyle = color
    ctx.globalAlpha = opacity * 0.2
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1

    ctx.fillStyle = color
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = opacity
    ctx.fillText(label, w / 2, h / 2 - 40)
    ctx.globalAlpha = 1
  }

  private drawOverlay(state: FuzzyRenderState, w: number, h: number): void {
    const { ctx, colors } = this

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = colors.fg
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const centerX = w / 2
    const centerY = h / 2

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