import type { GameColors } from './types'

const FALLBACK: GameColors = {
  bg: '#1e1e1e',
  fg: '#d4d4d4',
  accent: '#d4a053',   // warm amber
  warn: '#c9784a',     // burnt orange
  line: '#3c3c3c',
}

/**
 * Read game colors from CSS custom properties on :root.
 * Falls back to a warm amber/slate palette when variables are missing.
 */
export function readThemeColors(): GameColors {
  try {
    const style = getComputedStyle(document.documentElement)
    const get = (name: string, fallback: string): string => {
      const value = style.getPropertyValue(name).trim()
      return value || fallback
    }
    return {
      bg: get('--t-bg', FALLBACK.bg),
      fg: get('--t-fg', FALLBACK.fg),
      accent: get('--t-accent', FALLBACK.accent),
      warn: get('--t-warn', FALLBACK.warn),
      line: get('--t-line', FALLBACK.line),
    }
  } catch {
    return { ...FALLBACK }
  }
}