import { create } from 'zustand'
import type { BuiltinChallenge } from '../core/builtin'
import type { Cursor, HarpoonConfig } from '../core/types'

export interface TerminalBuffer {
  name: string
  text: string
  cursor: Cursor
  /** Set when the buffer is a built-in challenge: the Terminal then judges the end state. */
  challenge?: BuiltinChallenge
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

/** A guess at the filetype from the buffer name and text (the user can change it). */
export function guessFiletype(name: string, text: string): string {
  const ext = /\.([a-z]+)$/i.exec(name)?.[1]?.toLowerCase()
  const byExt: Record<string, string> = { lua: 'lua', js: 'javascript', ts: 'typescript', py: 'python', sh: 'sh', md: 'markdown', html: 'html', css: 'css', json: 'json', yml: 'yaml', yaml: 'yaml', sql: 'sql', go: 'go', rs: 'rust', c: 'c', cs: 'cs', vim: 'vim' }
  if (ext && byExt[ext]) return byExt[ext]
  if (/^\s*(local\s+\w+\s*=|end\s*$)/m.test(text)) return 'lua'
  if (/\b(const|let)\s+\w+\s*=|=>/.test(text)) return 'javascript'
  if (/^\s*(def\s+\w+\(|import\s+\w+$)/m.test(text)) return 'python'
  return 'text'
}

/** One tab of the terminal: the live text, and the buffer it started from (for Reset). */
export interface Tab extends TerminalBuffer {
  id: number
  orig: TerminalBuffer
  /** Filetype: decides the comment characters of the comment plugin. */
  ft: string
}

let nextId = 1
const tabOf = (b: TerminalBuffer, ft?: string): Tab => ({ ...b, id: nextId++, orig: b, ft: ft ?? guessFiletype(b.name, b.text) })

interface TerminalStore {
  tabs: Tab[]
  active: number
  /** Bumped when the editor must restart from the stored text (a buffer was loaded, reset or a tab switched). */
  run: number
  /** Harpoon slot name -> tab index mapping for named-mark navigation. */
  harpoonSlots: Record<string, number>
  /** Replace the current tab with a buffer (a challenge, an example). */
  open: (b: TerminalBuffer) => void
  /** Keep what the editor holds, without restarting it. */
  save: (text: string, cursor: Cursor) => void
  reset: () => void
  setFt: (ft: string) => void
  newTab: () => void
  closeTab: (index?: number) => void
  goTab: (index: number) => void
  stepTab: (delta: number) => void
  /** Open tabs from harpoon slots in alphabetical order and record the slot->tab mapping. */
  openHarpoon: (config: HarpoonConfig) => void
}

/** What the Terminal page edits. Other pages hand a buffer over and open the page. */
export const useTerminalStore = create<TerminalStore>((set) => ({
  tabs: [tabOf(SAMPLE_BUFFER)],
  active: 0,
  run: 0,
  harpoonSlots: {},
  open: (b) => set((s) => ({ tabs: s.tabs.map((t, i) => (i === s.active ? tabOf(b, b.challenge?.ft) : t)), run: s.run + 1 })),
  save: (text, cursor) => set((s) => ({ tabs: s.tabs.map((t, i) => (i === s.active ? { ...t, text, cursor } : t)) })),
  setFt: (ft) => set((s) => ({ tabs: s.tabs.map((t, i) => (i === s.active ? { ...t, ft } : t)) })),
  reset: () =>
    set((s) => ({
      tabs: s.tabs.map((t, i) => (i === s.active ? { ...t, text: t.orig.text, cursor: t.orig.cursor } : t)),
      run: s.run + 1,
    })),
  newTab: () =>
    set((s) => ({
      tabs: [...s.tabs, tabOf({ name: '[No Name]', text: '', cursor: [1, 0] }, 'text')],
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
  openHarpoon: (config) =>
    set((s) => {
      const names = Object.keys(config.slots).sort()
      const tabs = [...s.tabs]
      const mapping: Record<string, number> = {}
      for (const name of names) {
        const slot = config.slots[name]
        const idx = tabs.length
        tabs.push(tabOf({ name: `[harpoon:${name}]`, text: slot.text, cursor: slot.cursor ?? [1, 0] }, slot.ft))
        mapping[name] = idx
      }
      return { tabs, harpoonSlots: mapping, run: s.run + 1 }
    }),
}))
