/**
 * CodeMirror decorations for LSP diagnostic underlines.
 * Uses wavy underlines with severity-specific colors.
 */
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import type { LspDiagnosticEntry } from '../../core/types'

const SEVERITY_COLORS: Record<string, string> = {
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  hint: '#9e9e9e',
}

/** Build CodeMirror decorations for diagnostic entries. */
export function buildDiagnosticDecorations(view: EditorView, diags: LspDiagnosticEntry[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  // Collect and sort decorations by position
  const marks: { from: number; to: number; deco: Decoration }[] = []

  for (const d of diags) {
    const lineNum = d.row // 1-based
    if (lineNum < 1 || lineNum > doc.lines) continue
    const line = doc.line(lineNum)
    const from = line.from + Math.min(d.col, line.length)
    const to = line.from + Math.min(d.end_col, line.length)
    if (from >= to) continue

    const color = SEVERITY_COLORS[d.severity] ?? SEVERITY_COLORS.hint
    marks.push({
      from,
      to,
      deco: Decoration.mark({
        class: `cm-lsp-diag-${d.severity}`,
        attributes: {
          style: `text-decoration: underline wavy ${color}; text-underline-offset: 3px;`,
          ...(d.message ? { title: d.message } : {}),
        },
      }),
    })
  }

  // Sort by position for RangeSetBuilder
  marks.sort((a, b) => a.from - b.from || a.to - b.to)
  for (const m of marks) {
    builder.add(m.from, m.to, m.deco)
  }

  return builder.finish()
}