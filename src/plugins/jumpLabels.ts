/**
 * Label-based jump motion simulation (Hop/Leap/EasyMotion style).
 * Scans word starts, assigns short labels from a home-row-first charset,
 * and provides a state machine for narrowing down to a target via typed keys.
 */
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'

export interface JumpTarget {
  label: string
  row: number
  col: number
}

export interface JumpState {
  candidates: JumpTarget[]
  typed: string
}

export type JumpFeedResult =
  | { type: 'continue'; state: JumpState }
  | { type: 'jump'; target: JumpTarget }
  | { type: 'cancel' }

// Home-row-first charset: asdfghjklqwertyuiopzxcvbnm
const CHARSET = 'asdfghjklqwertyuiopzxcvbnm'

/**
 * Compute jump targets by scanning word starts in the visible lines.
 * Returns targets sorted by distance from cursor, with unique labels assigned.
 */
export function computeJumpTargets(
  lines: string[],
  cursorLine: number,
  cursorCol: number,
  maxTargets = 200,
): JumpTarget[] {
  const targets: { row: number; col: number; dist: number }[] = []

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]
    let inWord = false
    for (let col = 0; col < line.length; col++) {
      const ch = line[col]
      const isWordChar = /\w/.test(ch)
      if (isWordChar && !inWord) {
        // Word start found
        const dist = Math.abs(row - cursorLine) * 1000 + Math.abs(col - cursorCol)
        targets.push({ row, col, dist })
        if (targets.length >= maxTargets * 2) break // collect extra, will trim after sort
      }
      inWord = isWordChar
    }
  }

  // Sort by distance from cursor
  targets.sort((a, b) => a.dist - b.dist)

  // Assign labels: single char first, then two chars
  const result: JumpTarget[] = []
  const used = new Set<string>()
  let charIdx = 0

  // First pass: single-char labels
  for (const t of targets) {
    if (result.length >= maxTargets) break
    if (charIdx >= CHARSET.length) break
    const label = CHARSET[charIdx++]
    if (!used.has(label)) {
      used.add(label)
      result.push({ label, row: t.row, col: t.col })
    }
  }

  // Second pass: two-char labels for remaining targets
  if (result.length < maxTargets && charIdx >= CHARSET.length) {
    let outer = 0
    let inner = 0
    while (result.length < maxTargets && outer < CHARSET.length) {
      const prefix = CHARSET[outer]
      while (result.length < maxTargets && inner < CHARSET.length) {
        const label = prefix + CHARSET[inner]
        const idx = result.length
        if (idx < targets.length) {
          const t = targets[idx]
          result.push({ label, row: t.row, col: t.col })
        }
        inner++
      }
      outer++
      inner = 0
    }
  }

  return result
}

/**
 * Validate that jump targets are within bounds and have unique labels.
 * Returns true if valid, false otherwise.
 */
export function validateJumpTargets(
  targets: JumpTarget[],
  lineCount: number,
  getLineLength: (row: number) => number,
): boolean {
  const seen = new Set<string>()
  for (const t of targets) {
    if (seen.has(t.label)) return false
    seen.add(t.label)
    if (t.row < 0 || t.row >= lineCount) return false
    if (t.col < 0 || t.col > getLineLength(t.row)) return false
  }
  return true
}

/** Initialize jump state with the given targets. */
export function initJumpState(targets: JumpTarget[]): JumpState {
  return { candidates: [...targets], typed: '' }
}

/** Feed a key into the jump state machine. */
export function feedJumpKey(state: JumpState, key: string): JumpFeedResult {
  if (key === 'Escape' || key.length !== 1) {
    return { type: 'cancel' }
  }

  const lower = key.toLowerCase()
  const newTyped = state.typed + lower
  const matching = state.candidates.filter((t) => t.label.startsWith(newTyped))

  if (matching.length === 0) {
    return { type: 'cancel' }
  }

  if (matching.length === 1 && matching[0].label.length === newTyped.length) {
    return { type: 'jump', target: matching[0] }
  }

  return { type: 'continue', state: { candidates: matching, typed: newTyped } }
}

/** Build CodeMirror decorations for jump labels. */
export function buildJumpDecorations(
  view: EditorView,
  targets: JumpTarget[],
  typedPrefix: string,
): DecorationSet {
  const decorations: { from: number; to: number; deco: Decoration }[] = []

  for (const t of targets) {
    if (!t.label.startsWith(typedPrefix)) continue
    const line = view.state.doc.line(t.row + 1)
    if (t.col > line.length) continue
    const pos = line.from + t.col
    const remainingLabel = t.label.slice(typedPrefix.length)
    decorations.push({
      from: pos,
      to: pos + 1,
      deco: Decoration.mark({
        class: 'cm-jump-target',
        attributes: { 'data-jump-label': remainingLabel },
      }),
    })
  }

  // Sort by position for DecorationSet
  decorations.sort((a, b) => a.from - b.from)
  return Decoration.set(decorations.map((d) => d.deco.range(d.from, d.to)))
}