import { create } from 'zustand'
import { EMPTY_FORM, slug } from '../core/schema'
import type { DraftForm } from '../core/types'

const KEY = 'arcade-draft'

function load(): DraftForm {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<DraftForm>) }
  } catch {
    /* blocked storage or corrupt JSON: start empty */
  }
  return EMPTY_FORM
}

function save(form: DraftForm) {
  try {
    localStorage.setItem(KEY, JSON.stringify(form))
  } catch {
    /* private mode */
  }
}

interface DraftStore {
  form: DraftForm
  set: <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => void
  reset: () => void
}

export const useDraftStore = create<DraftStore>((set) => ({
  form: load(),
  set: (key, value) =>
    set((s) => {
      const form = { ...s.form, [key]: value }
      // the id follows the title until the author edits it by hand
      if (key === 'title' && !form.idTouched) form.id = slug(String(value))
      if (key === 'id') form.idTouched = String(value) !== ''
      save(form)
      return { form }
    }),
  reset: () => {
    save(EMPTY_FORM)
    set({ form: EMPTY_FORM })
  },
}))
