/**
 * CodeMirror extension for LSP hover tooltips.
 * Uses CodeMirror's native Tooltip/showTooltip mechanism.
 */
import { StateEffect, StateField } from '@codemirror/state'
import { showTooltip, type Tooltip } from '@codemirror/view'

/** Effect to set or clear the hover tooltip. */
export const setHover = StateEffect.define<{ pos: number; text: string } | null>()

/** State field that provides the hover tooltip when active. */
export const hoverField = StateField.define<Tooltip | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setHover)) {
        if (e.value === null) return null
        return {
          pos: e.value.pos,
          above: true,
          create() {
            const dom = document.createElement('div')
            dom.className = 'cm-lsp-hover'
            dom.textContent = e.value!.text
            return { dom }
          },
        }
      }
    }
    // Clear tooltip on document changes or cursor movement
    if (tr.docChanged || tr.selection) return null
    return value
  },
  provide: (f) => showTooltip.from(f),
})

/** Dispatch a hover tooltip at the given position. */
export function dispatchHover(view: import('@codemirror/view').EditorView, pos: number, text: string): void {
  view.dispatch({ effects: setHover.of({ pos, text }) })
}

/** Clear any active hover tooltip. */
export function clearHover(view: import('@codemirror/view').EditorView): void {
  view.dispatch({ effects: setHover.of(null) })
}