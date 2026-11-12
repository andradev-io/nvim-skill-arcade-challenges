import { create } from 'zustand'

const STORAGE_KEY = 'nvim-arcade-highscores'

export type ArcadeGameId = 'maze' | 'rhythm' | 'defender'

export interface ArcadeHighScore {
  gameId: ArcadeGameId
  level: number
  score: number
  date: string // ISO date
}

interface StoredData {
  highScores: Record<string, ArcadeHighScore> // key: `${gameId}-${level}`
}

interface ArcadeState {
  highScores: Record<string, ArcadeHighScore>
  load: () => void
  /** Returns true if this is a new best for the given game+level. */
  saveScore: (gameId: ArcadeGameId, level: number, score: number) => boolean
  getBest: (gameId: ArcadeGameId, level: number) => number | null
  clearAll: () => void
}

function scoreKey(gameId: ArcadeGameId, level: number): string {
  return `${gameId}-${level}`
}

function read(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { highScores: {} }
    const parsed = JSON.parse(raw) as Partial<StoredData>
    return {
      highScores: parsed.highScores ?? {},
    }
  } catch {
    return { highScores: {} }
  }
}

function persist(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode or quota exceeded */
  }
}

const initial = read()

export const useArcadeStore = create<ArcadeState>((set, get) => ({
  highScores: initial.highScores,

  load: () => {
    const data = read()
    set({ highScores: data.highScores })
  },

  saveScore: (gameId, level, score) => {
    const key = scoreKey(gameId, level)
    const existing = get().highScores[key]
    if (existing && existing.score >= score) return false

    const currentData = read()
    const newHighScores: Record<string, ArcadeHighScore> = {
      ...currentData.highScores,
      [key]: { gameId, level, score, date: new Date().toISOString() },
    }
    persist({ highScores: newHighScores })
    set({ highScores: newHighScores })
    return true
  },

  getBest: (gameId, level) => {
    const key = scoreKey(gameId, level)
    return get().highScores[key]?.score ?? null
  },

  clearAll: () => {
    persist({ highScores: {} })
    set({ highScores: {} })
  },
}))