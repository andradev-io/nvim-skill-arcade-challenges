import { create } from 'zustand'

export type TabId = 'describe' | 'play' | 'terminal' | 'check' | 'neovim' | 'submit'

interface UiStore {
  tab: TabId
  setTab: (tab: TabId) => void
}

/** Which workspace tab is open, so the hero buttons and the tab bar agree. */
export const useUiStore = create<UiStore>((set) => ({
  tab: 'play',
  setTab: (tab) => set({ tab }),
}))
