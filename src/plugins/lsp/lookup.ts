/**
 * Lookup functions for scripted LSP simulation.
 * All row values in entries are 1-based; cursor.line is 0-based.
 */
import type { LspConfig, LspHoverEntry, LspDefinitionEntry, LspDiagnosticEntry } from '../../core/types'

interface CursorPos {
  line: number // 0-based
  ch: number   // 0-based
}

/** Find a hover entry matching the cursor position (exact col or within [col, end_col]). */
export function findHover(data: LspConfig | undefined, cursor: CursorPos): LspHoverEntry | null {
  if (!data?.hover) return null
  const row = cursor.line + 1
  for (const h of data.hover) {
    if (h.row !== row) continue
    const endCol = h.end_col ?? h.col
    if (cursor.ch >= h.col && cursor.ch <= endCol) return h
  }
  return null
}

/** Find a go-to-definition entry matching the cursor position. */
export function findDefinition(data: LspConfig | undefined, cursor: CursorPos): LspDefinitionEntry | null {
  if (!data?.definition) return null
  const row = cursor.line + 1
  for (const d of data.definition) {
    if (d.row !== row) continue
    const endCol = d.end_col ?? d.col
    if (cursor.ch >= d.col && cursor.ch <= endCol) return d
  }
  return null
}

/** Find the next diagnostic after the cursor position (wraps around). */
export function findNextDiagnostic(data: LspConfig | undefined, cursor: CursorPos): LspDiagnosticEntry | null {
  if (!data?.diagnostics || data.diagnostics.length === 0) return null
  const row = cursor.line + 1
  // Sort diagnostics by position for consistent ordering
  const sorted = [...data.diagnostics].sort((a, b) => a.row - b.row || a.col - b.col)
  // Find first diagnostic strictly after cursor
  for (const d of sorted) {
    if (d.row > row || (d.row === row && d.col > cursor.ch)) return d
  }
  // Wrap around to first diagnostic
  return sorted[0]
}

/** Find the previous diagnostic before the cursor position (wraps around). */
export function findPrevDiagnostic(data: LspConfig | undefined, cursor: CursorPos): LspDiagnosticEntry | null {
  if (!data?.diagnostics || data.diagnostics.length === 0) return null
  const row = cursor.line + 1
  // Sort diagnostics by position for consistent ordering
  const sorted = [...data.diagnostics].sort((a, b) => a.row - b.row || a.col - b.col)
  // Find last diagnostic strictly before cursor
  for (let i = sorted.length - 1; i >= 0; i--) {
    const d = sorted[i]
    if (d.row < row || (d.row === row && d.col < cursor.ch)) return d
  }
  // Wrap around to last diagnostic
  return sorted[sorted.length - 1]
}