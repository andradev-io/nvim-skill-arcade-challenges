import { create } from 'zustand'
import type { Cursor } from '../core/types'

export interface TerminalBuffer {
  name: string
  text: string
  cursor: Cursor
}

export const SAMPLE_BUFFER: TerminalBuffer = {
  name: 'scratch',
  text: `function greet(name) {
  return "hello, " + name
}

local items = { "alpha", "beta", "gamma" }
for i, item in ipairs(items) do
  print(i, item)
end
`,
  cursor: [1, 0],
}

/** One tab of the terminal: the live text, and the buffer it started from (for Reset). */
export interface Tab extends TerminalBuffer {
  id: number
  orig: TerminalBuffer
}

let nextId = 1
const tabOf = (b: TerminalBuffer): Tab => ({ ...b, id: nextId++, orig: b })

interface TerminalStore {
  tabs: Tab[]
  active: number
  /** Bumped when the editor must restart from the stored text (a buffer was loaded, reset or a tab switched). */
  run: number
  /** Replace the current tab with a buffer (a challenge, an example). */
  open: (b: TerminalBuffer) => void
  /** Keep what the editor holds, without restarting it. */
  save: (text: string, cursor: Cursor) => void
  reset: () => void
  newTab: () => void
  closeTab: (index?: number) => void
  goTab: (index: number) => void
  stepTab: (delta: number) => void
}

/** What the Terminal page edits. Other pages hand a buffer over and open the page. */
export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [tabOf(SAMPLE_BUFFER)],
  active: 0,
  run: 0,
  open: (b) => set((s) => ({ tabs: s.tabs.map((t, i) => (i === s.active ? tabOf(b) : t)), run: s.run + 1 })),
  save: (text, cursor) => set((s) => ({ tabs: s.tabs.map((t, i) => (i === s.active ? { ...t, text, cursor } : t)) })),
  reset: () =>
    set((s) => ({
      tabs: s.tabs.map((t, i) => (i === s.active ? { ...t, text: t.orig.text, cursor: t.orig.cursor } : t)),
      run: s.run + 1,
    })),
  newTab: () =>
    set((s) => ({
      tabs: [...s.tabs, tabOf({ name: '[No Name]', text: '', cursor: [1, 0] })],
      active: s.tabs.length,
      run: s.run + 1,
    })),
  closeTab: (index) =>
    set((s) => {
      if (s.tabs.length <= 1) return s
      const at = index ?? s.active
      const tabs = s.tabs.filter((_, i) => i !== at)
      const active = at < s.active ? s.active - 1 : Math.min(s.active, tabs.length - 1)
      return { tabs, active, run: s.run + 1 }
    }),
  goTab: (index) => set((s) => (index === s.active || !s.tabs[index] ? s : { active: index, run: s.run + 1 })),
  stepTab: (delta) =>
    set((s) => (s.tabs.length < 2 ? s : { active: (s.active + delta + s.tabs.length) % s.tabs.length, run: s.run + 1 })),
}))
