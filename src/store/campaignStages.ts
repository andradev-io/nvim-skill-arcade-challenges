import type { CampaignGameId, StarThresholds, UnlockCondition } from './campaignStore'

export interface CampaignStage {
  id: string
  gameId: CampaignGameId
  levelIndex: number
  name: string
  description: string
  starThresholds: StarThresholds
  unlockCondition: UnlockCondition
  chapter: number
}

const PAR_RATIO_EASY: StarThresholds = { oneStar: 1.5, twoStars: 1.0, threeStars: 0.75, metric: 'parRatio' }
const PAR_RATIO_MEDIUM: StarThresholds = { oneStar: 1.8, twoStars: 1.2, threeStars: 0.85, metric: 'parRatio' }
const PAR_RATIO_HARD: StarThresholds = { oneStar: 2.0, twoStars: 1.3, threeStars: 0.9, metric: 'parRatio' }

const ACCURACY_EASY: StarThresholds = { oneStar: 50, twoStars: 75, threeStars: 90, metric: 'accuracy' }
const ACCURACY_MEDIUM: StarThresholds = { oneStar: 55, twoStars: 78, threeStars: 92, metric: 'accuracy' }
const ACCURACY_HARD: StarThresholds = { oneStar: 60, twoStars: 80, threeStars: 95, metric: 'accuracy' }

const DEFENDER_SCORE_W1: StarThresholds = { oneStar: 500, twoStars: 1000, threeStars: 1500, metric: 'score' }
export const DEFENDER_SCORE_W2: StarThresholds = { oneStar: 1000, twoStars: 2000, threeStars: 3000, metric: 'score' }
const DEFENDER_SCORE_W3: StarThresholds = { oneStar: 1500, twoStars: 3000, threeStars: 4500, metric: 'score' }
export const DEFENDER_SCORE_W4: StarThresholds = { oneStar: 2000, twoStars: 4000, threeStars: 6000, metric: 'score' }
const DEFENDER_SCORE_W5: StarThresholds = { oneStar: 2500, twoStars: 5000, threeStars: 7500, metric: 'score' }

export const CAMPAIGN_STAGES: CampaignStage[] = [
  // Chapter 1: Foundations (stages 1-5)
  {
    id: 'ch1-maze-l0',
    gameId: 'maze',
    levelIndex: 0,
    name: 'First Steps',
    description: 'Learn hjkl basics by navigating a simple maze.',
    starThresholds: PAR_RATIO_EASY,
    unlockCondition: { type: 'initial' },
    chapter: 1,
  },
  {
    id: 'ch1-maze-l1',
    gameId: 'maze',
    levelIndex: 1,
    name: 'Word Hopper',
    description: 'Practice w/b/e word motions through corridors.',
    starThresholds: PAR_RATIO_EASY,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch1-maze-l0' },
    chapter: 1,
  },
  {
    id: 'ch1-rhythm-l0',
    gameId: 'rhythm',
    levelIndex: 0,
    name: 'First Beats',
    description: 'Hit hjkl keys in time with a slow rhythm.',
    starThresholds: ACCURACY_EASY,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch1-maze-l1' },
    chapter: 1,
  },
  {
    id: 'ch1-maze-l2',
    gameId: 'maze',
    levelIndex: 2,
    name: 'Find It',
    description: 'Use f/t search motions to locate targets.',
    starThresholds: PAR_RATIO_MEDIUM,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch1-rhythm-l0' },
    chapter: 1,
  },
  {
    id: 'ch1-gate',
    gameId: 'maze',
    levelIndex: 0,
    name: 'Star Gate: Foundations',
    description: 'Earn 8+ total stars to prove your foundation.',
    starThresholds: PAR_RATIO_EASY,
    unlockCondition: { type: 'starTotal', requiredStars: 8 },
    chapter: 1,
  },

  // Chapter 2: Building Speed (stages 6-10)
  {
    id: 'ch2-rhythm-l1',
    gameId: 'rhythm',
    levelIndex: 1,
    name: 'Cross Motion',
    description: 'Handle crossing note patterns at moderate tempo.',
    starThresholds: ACCURACY_MEDIUM,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch1-gate' },
    chapter: 2,
  },
  {
    id: 'ch2-defender-w1',
    gameId: 'defender',
    levelIndex: 0,
    name: 'First Defense',
    description: 'Type basic vim commands to fend off threats.',
    starThresholds: DEFENDER_SCORE_W1,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch2-rhythm-l1' },
    chapter: 2,
  },
  {
    id: 'ch2-maze-l3',
    gameId: 'maze',
    levelIndex: 3,
    name: 'The Gauntlet',
    description: 'Combined skills maze testing everything so far.',
    starThresholds: PAR_RATIO_MEDIUM,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch2-defender-w1' },
    chapter: 2,
  },
  {
    id: 'ch2-rhythm-l2',
    gameId: 'rhythm',
    levelIndex: 2,
    name: 'Double Time',
    description: 'Keep up with faster rhythms under pressure.',
    starThresholds: ACCURACY_MEDIUM,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch2-maze-l3' },
    chapter: 2,
  },
  {
    id: 'ch2-gate',
    gameId: 'rhythm',
    levelIndex: 0,
    name: 'Star Gate: Speed',
    description: 'Earn 18+ total stars to advance to mastery.',
    starThresholds: ACCURACY_EASY,
    unlockCondition: { type: 'starTotal', requiredStars: 18 },
    chapter: 2,
  },

  // Chapter 3: Mastery (stages 11-15)
  {
    id: 'ch3-defender-w3',
    gameId: 'defender',
    levelIndex: 2,
    name: 'Complex Commands',
    description: 'Defend against waves requiring multi-key commands.',
    starThresholds: DEFENDER_SCORE_W3,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch2-gate' },
    chapter: 3,
  },
  {
    id: 'ch3-maze-replay',
    gameId: 'maze',
    levelIndex: 3,
    name: 'Gauntlet Replay',
    description: 'Replay the hardest maze for a better par ratio.',
    starThresholds: PAR_RATIO_HARD,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch3-defender-w3' },
    chapter: 3,
  },
  {
    id: 'ch3-defender-w5',
    gameId: 'defender',
    levelIndex: 4,
    name: 'Full Defense',
    description: 'Survive the full onslaught of wave 5.',
    starThresholds: DEFENDER_SCORE_W5,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch3-maze-replay' },
    chapter: 3,
  },
  {
    id: 'ch3-rhythm-replay',
    gameId: 'rhythm',
    levelIndex: 2,
    name: 'Perfect Rhythm',
    description: 'Three-star challenge on Double Time.',
    starThresholds: ACCURACY_HARD,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch3-defender-w5' },
    chapter: 3,
  },
  {
    id: 'ch3-final',
    gameId: 'defender',
    levelIndex: 4,
    name: 'Final Challenge',
    description: 'The ultimate combined test of all vim skills.',
    starThresholds: DEFENDER_SCORE_W5,
    unlockCondition: { type: 'completePrevious', previousStageId: 'ch3-rhythm-replay' },
    chapter: 3,
  },
]