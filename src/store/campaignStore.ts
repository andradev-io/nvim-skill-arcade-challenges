import { create } from 'zustand'
import { CAMPAIGN_STAGES } from './campaignStages'
import type { CampaignStage } from './campaignStages'

const STORAGE_KEY = 'nvim-arcade-campaign'

export type CampaignGameId = 'maze' | 'rhythm' | 'defender' | 'snake' | 'memory'

export interface StarThresholds {
  oneStar: number
  twoStars: number
  threeStars: number
  metric: 'score' | 'parRatio' | 'accuracy'
}

export interface UnlockCondition {
  type: 'initial' | 'completePrevious' | 'starTotal'
  previousStageId?: string
  requiredStars?: number
}

export type StageStatus = 'locked' | 'unlocked' | 'completed'

export interface StageProgress {
  stageId: string
  status: StageStatus
  stars: number
  bestScore: number
  attempts: number
  completedAt?: string
}

interface StoredCampaignData {
  progress: Record<string, StageProgress>
}

interface CampaignState {
  progress: Record<string, StageProgress>
  load: () => void
  completeStage: (stageId: string, score: number, metricValue: number) => void
  isUnlocked: (stageId: string) => boolean
  getStars: (stageId: string) => number
  getTotalStars: () => number
  getMaxStars: () => number
  getCompletionPercent: () => number
  clearAll: () => void
}

function read(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { progress: {} }
    const parsed = JSON.parse(raw) as Partial<StoredCampaignData>
    return {
      progress: parsed.progress ?? {},
    }
  } catch {
    return { progress: {} }
  }
}

function persist(data: StoredCampaignData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode or quota exceeded */
  }
}

/** Compute stars earned for a given metric value against thresholds. */
export function computeStars(
  metricValue: number,
  thresholds: StarThresholds,
): number {
  const { metric, oneStar, twoStars, threeStars } = thresholds
  if (metric === 'parRatio') {
    // Lower is better
    if (metricValue <= threeStars) return 3
    if (metricValue <= twoStars) return 2
    if (metricValue <= oneStar) return 1
    return 0
  }
  // 'score' and 'accuracy': higher is better
  if (metricValue >= threeStars) return 3
  if (metricValue >= twoStars) return 2
  if (metricValue >= oneStar) return 1
  return 0
}

type StoredData = StoredCampaignData

const initial = read()

export const useCampaignStore = create<CampaignState>((set, get) => ({
  progress: initial.progress,

  load: () => {
    const data = read()
    set({ progress: data.progress })
  },

  completeStage: (stageId, score, metricValue) => {
    const stage = CAMPAIGN_STAGES.find((s) => s.id === stageId)
    if (!stage) return

    const currentData = read()
    const existing = currentData.progress[stageId]
    const newStars = computeStars(metricValue, stage.starThresholds)

    // Only update if this attempt yields more stars or a better score
    if (existing && existing.stars >= newStars && existing.bestScore >= score) {
      // Still count as an attempt but don't downgrade
      const updatedProgress: Record<string, StageProgress> = {
        ...currentData.progress,
        [stageId]: {
          ...existing,
          attempts: existing.attempts + 1,
        },
      }
      persist({ progress: updatedProgress })
      set({ progress: updatedProgress })
      return
    }

    const newProgress: StageProgress = {
      stageId,
      status: 'completed',
      stars: Math.max(newStars, existing?.stars ?? 0),
      bestScore: Math.max(score, existing?.bestScore ?? 0),
      attempts: (existing?.attempts ?? 0) + 1,
      completedAt: new Date().toISOString(),
    }

    const updatedProgress: Record<string, StageProgress> = {
      ...currentData.progress,
      [stageId]: newProgress,
    }

    // Propagate unlocks: mark stages as 'unlocked' if their condition is now met
    for (const s of CAMPAIGN_STAGES) {
      if (updatedProgress[s.id]?.status === 'completed') continue
      if (updatedProgress[s.id]?.status === 'unlocked') continue
      if (checkUnlock(s, updatedProgress)) {
        updatedProgress[s.id] = {
          stageId: s.id,
          status: 'unlocked',
          stars: 0,
          bestScore: 0,
          attempts: 0,
        }
      }
    }

    persist({ progress: updatedProgress })
    set({ progress: updatedProgress })
  },

  isUnlocked: (stageId) => {
    const stage = CAMPAIGN_STAGES.find((s) => s.id === stageId)
    if (!stage) return false
    const p = get().progress[stageId]
    if (p?.status === 'unlocked' || p?.status === 'completed') return true
    return checkUnlock(stage, get().progress)
  },

  getStars: (stageId) => {
    return get().progress[stageId]?.stars ?? 0
  },

  getTotalStars: () => {
    let total = 0
    for (const key in get().progress) {
      total += get().progress[key].stars
    }
    return total
  },

  getMaxStars: () => {
    return CAMPAIGN_STAGES.length * 3
  },

  getCompletionPercent: () => {
    const max = get().getMaxStars()
    if (max === 0) return 0
    return Math.round((get().getTotalStars() / max) * 100)
  },

  clearAll: () => {
    persist({ progress: {} })
    set({ progress: {} })
  },
}))

function checkUnlock(
  stage: CampaignStage,
  progress: Record<string, StageProgress>,
): boolean {
  const { unlockCondition } = stage
  if (unlockCondition.type === 'initial') return true
  if (unlockCondition.type === 'completePrevious') {
    const prev = progress[unlockCondition.previousStageId!]
    return prev?.status === 'completed'
  }
  if (unlockCondition.type === 'starTotal') {
    let total = 0
    for (const key in progress) {
      total += progress[key].stars
    }
    return total >= (unlockCondition.requiredStars ?? 0)
  }
  return false
}