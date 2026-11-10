import { create } from 'zustand'
import { loadSource, parseSource } from '../core/github'
import { parseConfig } from '../core/keymaps'
import type { Keymap, Skipped } from '../core/keymaps'

const KEY = 'arcade-keymaps'

interface Saved {
  source: string
  enabled: boolean
  leader: string
  files: string[]
  maps: Keymap[]
  skipped: Skipped[]
}

const EMPTY: Saved = { source: '', enabled: true, leader: '\\', files: [], maps: [], skipped: [] }

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) }
  } catch {
    /* blocked storage or corrupt JSON */
  }
  return EMPTY
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
}

interface KeymapStore extends Saved {
  status: 'idle' | 'loading' | 'error'
  error: string
  setSource: (v: string) => void
  setEnabled: (v: boolean) => void
  load: () => Promise<void>
  clear: () => void
}

const pick = (s: Saved): Saved => ({
  source: s.source,
  enabled: s.enabled,
  leader: s.leader,
  files: s.files,
  maps: s.maps,
  skipped: s.skipped,
})

export const useKeymapStore = create<KeymapStore>((set, get) => ({
  ...read(),
  status: 'idle',
  error: '',
  setSource: (source) => set({ source }),
  setEnabled: (enabled) => {
    set({ enabled })
    write(pick(get()))
  },
  load: async () => {
    const src = parseSource(get().source)
    if (!src) {
      set({ status: 'error', error: 'Type a GitHub user, user/repo, or a link to a keymaps file.' })
      return
    }
    set({ status: 'loading', error: '' })
    try {
      const files = await loadSource(src)
      const parsed = parseConfig(files)
      set({
        status: 'idle',
        enabled: true,
        leader: parsed.leader,
        files: files.map((f) => f.path),
        maps: parsed.maps,
        skipped: parsed.skipped,
      })
      write(pick(get()))
    } catch (e) {
      set({ status: 'error', error: (e as Error).message || 'Could not load that source.' })
    }
  },
  clear: () => {
    set({ ...EMPTY, source: get().source, status: 'idle', error: '' })
    write({ ...EMPTY, source: get().source })
  },
}))
