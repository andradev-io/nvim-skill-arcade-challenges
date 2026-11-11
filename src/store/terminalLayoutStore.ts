import { create } from 'zustand'

const KEY = 'arcade-terminal-layout'
export const MIN_WIDTH = 220
export const MAX_WIDTH = 640
const DEFAULT_WIDTH = 330

export type Side = 'left' | 'right'

interface Layout {
  side: Side
  width: number
  open: boolean
}

const clamp = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)))

function read(): Layout {
  const fallback: Layout = { side: 'left', width: DEFAULT_WIDTH, open: true }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Layout> | null
    if (!raw || typeof raw !== 'object') return fallback
    return {
      side: raw.side === 'right' ? 'right' : 'left',
      width: typeof raw.width === 'number' ? clamp(raw.width) : DEFAULT_WIDTH,
      open: raw.open !== false,
    }
  } catch {
    return fallback
  }
}

interface LayoutStore extends Layout {
  setWidth: (w: number) => void
  toggle: () => void
  swapSide: () => void
}

function persist(l: Layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ side: l.side, width: l.width, open: l.open }))
  } catch {
    /* private mode */
  }
}

/** Where the Terminal's side menu sits, how wide it is and whether it is shown. Remembered in this browser. */
export const useTerminalLayout = create<LayoutStore>((set, get) => ({
  ...read(),
  setWidth: (w) => {
    set({ width: clamp(w) })
    persist(get())
  },
  toggle: () => {
    set((s) => ({ open: !s.open }))
    persist(get())
  },
  swapSide: () => {
    set((s) => ({ side: s.side === 'left' ? 'right' : 'left' }))
    persist(get())
  },
}))
