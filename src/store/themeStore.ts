import { create } from 'zustand'

const KEY = 'arcade-terminal-theme'

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? 'arcade'
  } catch {
    return 'arcade'
  }
}

interface ThemeStore {
  id: string
  setTheme: (id: string) => void
}

/** The Terminal's color theme, remembered in this browser. */
export const useThemeStore = create<ThemeStore>((set) => ({
  id: read(),
  setTheme: (id) => {
    set({ id })
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* private mode */
    }
  },
}))
