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

interface TerminalStore {
  buffer: TerminalBuffer
  /** Bumped on every load, so the editor starts fresh even for the same buffer. */
  run: number
  open: (b: TerminalBuffer) => void
  reset: () => void
}

/** The text the Terminal page edits. Other pages hand a buffer over (a challenge, an example) and open the page. */
export const useTerminalStore = create<TerminalStore>((set) => ({
  buffer: SAMPLE_BUFFER,
  run: 0,
  open: (buffer) => set((s) => ({ buffer, run: s.run + 1 })),
  reset: () => set((s) => ({ run: s.run + 1 })),
}))
