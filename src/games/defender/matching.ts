import { tokens } from '../../core/keys'
import type { Enemy } from './types'

/**
 * Maps a KeyboardEvent.code and key to the character the user intended.
 * Returns null for non-printable keys (Escape, Enter, etc.).
 */
export function codeToChar(code: string, key: string): string | null {
  // Use event.key directly — it already accounts for Shift, CapsLock, layout
  if (key.length === 1) return key
  // Handle special named keys that produce characters
  if (key === ' ') return ' '
  return null
}

/**
 * Find the best matching enemy for the current input buffer tokens.
 * - Only considers alive enemies whose token sequence starts with bufferTokens
 * - Prefers full match over partial match
 * - Among equal matches, prefers leftmost (smallest x)
 * - Returns null if no enemy matches
 */
export function findMatch(
  bufferTokens: string[],
  enemies: Enemy[],
): { enemyId: number; fullMatch: boolean } | null {
  if (bufferTokens.length === 0) return null

  let bestFull: Enemy | null = null
  let bestPartial: Enemy | null = null

  for (const enemy of enemies) {
    if (!enemy.alive) continue

    // Check if enemy tokens start with bufferTokens
    if (bufferTokens.length > enemy.tokens.length) continue

    let matches = true
    for (let i = 0; i < bufferTokens.length; i++) {
      if (enemy.tokens[i] !== bufferTokens[i]) {
        matches = false
        break
      }
    }

    if (!matches) continue

    const isFull = bufferTokens.length === enemy.tokens.length

    if (isFull) {
      if (bestFull === null || enemy.x < bestFull.x) {
        bestFull = enemy
      }
    } else {
      if (bestPartial === null || enemy.x < bestPartial.x) {
        bestPartial = enemy
      }
    }
  }

  // Prefer full match over partial
  if (bestFull !== null) {
    return { enemyId: bestFull.id, fullMatch: true }
  }
  if (bestPartial !== null) {
    return { enemyId: bestPartial.id, fullMatch: false }
  }

  return null
}

/** Pre-split a command string into tokens using the shared tokenizer. */
export function splitCommand(command: string): string[] {
  return tokens(command)
}