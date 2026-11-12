import { create } from 'zustand'

const STORAGE_KEY = 'nvim-arcade-scores'

export type Rank = 'S' | 'A' | 'B' | 'C'

export interface PersonalBest {
  challengeId: string
  keys: number
  ms: number
  rank: Rank
  date: string // ISO date
}

interface StoredData {
  bests: Record<string, PersonalBest>
  totalCompleted: number
  /** YYYY-MM-DD strings of days with at least one completion, sorted newest first. */
  activeDays: string[]
}

interface ScoringState {
  bests: Record<string, PersonalBest>
  totalCompleted: number
  streak: number
  load: () => void
  /** Returns true when this result is a new personal best for the challenge. */
  saveResult: (challengeId: string, keys: number, ms: number, rank: string) => boolean
  getStats: () => {
    total: number
    sCount: number
    aCount: number
    bCount: number
    cCount: number
    avgEfficiency: number
  }
  clearAll: () => void
}

function read(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { bests: {}, totalCompleted: 0, activeDays: [] }
    const parsed = JSON.parse(raw) as Partial<StoredData>
    return {
      bests: parsed.bests ?? {},
      totalCompleted: typeof parsed.totalCompleted === 'number' ? parsed.totalCompleted : 0,
      activeDays: Array.isArray(parsed.activeDays) ? parsed.activeDays : [],
    }
  } catch {
    return { bests: {}, totalCompleted: 0, activeDays: [] }
  }
}

function persist(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode or quota exceeded */
  }
}

/** Fewer keys wins; equal keys -> less time wins. */
function isBetter(newKeys: number, newMs: number, existing: PersonalBest | undefined): boolean {
  if (!existing) return true
  if (newKeys < existing.keys) return true
  if (newKeys === existing.keys && newMs < existing.ms) return true
  return false
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function computeStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0
  const sorted = [...activeDays].sort((a, b) => (a > b ? -1 : 1))
  const today = todayISO()
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000)
    if (diffDays === 1) streak++
    else break
  }
  return streak
}

const initial = read()

export const useScoringStore = create<ScoringState>((set, get) => ({
  bests: initial.bests,
  totalCompleted: initial.totalCompleted,
  streak: computeStreak(initial.activeDays),

  load: () => {
    const data = read()
    set({
      bests: data.bests,
      totalCompleted: data.totalCompleted,
      streak: computeStreak(data.activeDays),
    })
  },

  saveResult: (challengeId, keys, ms, rank) => {
    const validRank = rank === 'S' || rank === 'A' || rank === 'B' || rank === 'C' ? rank : 'C'
    const state = get()
    const existing = state.bests[challengeId]
    if (!isBetter(keys, ms, existing)) return false

    const today = todayISO()
    const currentData = read()
    const newBests = { ...currentData.bests, [challengeId]: { challengeId, keys, ms, rank: validRank, date: new Date().toISOString() } }
    const newTotal = currentData.totalCompleted + 1
    const hasToday = currentData.activeDays.includes(today)
    const newActiveDays = hasToday ? currentData.activeDays : [today, ...currentData.activeDays]

    const newData: StoredData = { bests: newBests as Record<string, PersonalBest>, totalCompleted: newTotal, activeDays: newActiveDays }
    persist(newData)

    set({
      bests: newBests as Record<string, PersonalBest>,
      totalCompleted: newTotal,
      streak: computeStreak(newActiveDays),
    })
    return true
  },

  getStats: () => {
    const { bests } = get()
    const entries = Object.values(bests)
    const total = entries.length
    let sCount = 0
    let aCount = 0
    let bCount = 0
    let cCount = 0
    let efficiencySum = 0
    let efficiencyCount = 0
    for (const b of entries) {
      if (b.rank === 'S') sCount++
      else if (b.rank === 'A') aCount++
      else if (b.rank === 'B') bCount++
      else cCount++
      // efficiency requires par; we approximate from rank thresholds
      // S: keys <= par -> 100%, A: keys <= 1.5*par -> ~67-100%, B: keys <= 2*par -> ~50-67%
      // We store keys but not par here, so we compute a rough efficiency from rank
      if (b.rank === 'S') { efficiencySum += 100; efficiencyCount++ }
      else if (b.rank === 'A') { efficiencySum += 80; efficiencyCount++ }
      else if (b.rank === 'B') { efficiencySum += 60; efficiencyCount++ }
      else { efficiencySum += 40; efficiencyCount++ }
    }
    return {
      total,
      sCount,
      aCount,
      bCount,
      cCount,
      avgEfficiency: efficiencyCount > 0 ? Math.round(efficiencySum / efficiencyCount) : 0,
    }
  },

  clearAll: () => {
    const empty: StoredData = { bests: {}, totalCompleted: 0, activeDays: [] }
    persist(empty)
    set({ bests: {}, totalCompleted: 0, streak: 0 })
  },
}))