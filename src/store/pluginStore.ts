import { create } from 'zustand'
import { SHIMS } from '../plugins/registry'

const KEY = 'arcade-plugins'

interface Saved {
  /** Plugins found in the user's config (registry ids). */
  detected: string[]
  /** Plugin repos found in the config that the list does not know. */
  unknown: string[]
  /** What the user switched by hand: id to on/off. */
  overrides: Record<string, boolean>
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { detected: [], unknown: [], overrides: {}, ...(JSON.parse(raw) as Partial<Saved>) }
  } catch {
    /* blocked storage or corrupt JSON */
  }
  return { detected: [], unknown: [], overrides: {} }
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode */
  }
}

interface PluginStore extends Saved {
  setDetected: (ids: string[], unknown?: string[]) => void
  setOn: (id: string, on: boolean) => void
}

/**
 * Whether a plugin imitation is on: the user's choice, else on when the config uses it (all on when nothing was loaded).
 * Commenting is built into Neovim 0.10+, so it is on regardless.
 */
export function isOn(s: Pick<Saved, 'detected' | 'overrides'>, id: string): boolean {
  return s.overrides[id] ?? (id === 'comment' || s.detected.length === 0 || s.detected.includes(id))
}

export const enabledShims = (s: Pick<Saved, 'detected' | 'overrides'>): Set<string> => new Set(SHIMS.filter((p) => isOn(s, p.id)).map((p) => p.id))

export const usePluginStore = create<PluginStore>((set, get) => ({
  ...read(),
  setDetected: (detected, unknown = []) => {
    set({ detected, unknown, overrides: {} })
    write({ detected, unknown, overrides: {} })
  },
  setOn: (id, on) => {
    const overrides = { ...get().overrides, [id]: on }
    set({ overrides })
    write({ detected: get().detected, unknown: get().unknown, overrides })
  },
}))
