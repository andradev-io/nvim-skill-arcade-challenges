import { create } from 'zustand'
import { challengeToForm, EMPTY_FORM, slug } from '../core/schema'
import type { Challenge, DraftForm } from '../core/types'
import { EXAMPLES } from '../examples'

const KEY = 'arcade-draft'

/** First visit: start with a working example, so every panel has something to show. */
const FIRST_VISIT = challengeToForm(EXAMPLES[0].challenge)

function load(): DraftForm {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<DraftForm>) }
  } catch {
    /* blocked storage or corrupt JSON: use the example */
  }
  return FIRST_VISIT
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
  /** Replace the whole form with a challenge (an example or a published one). */
  loadChallenge: (c: Partial<Challenge>) => void
  /** Empty form. */
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
  loadChallenge: (c) => {
    const form = challengeToForm(c)
    save(form)
    set({ form })
  },
  reset: () => {
    save(EMPTY_FORM)
    set({ form: EMPTY_FORM })
  },
}))
