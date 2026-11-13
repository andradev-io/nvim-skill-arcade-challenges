import type { GameState } from '../engine/types'

export interface NoteEvent {
  lane: number // 0-based lane index
  timeMs: number // absolute time in ms when note should be hit
  hit?: boolean
  missed?: boolean
}

export type HitGrade = 'perfect' | 'good' | 'miss'

export interface HitResult {
  grade: HitGrade
  lane: number
  deltaMs: number // signed: negative = early, positive = late
}

export interface RhythmLevel {
  id: string
  name: string
  bpm: number
  durationMs: number
  laneCount: number
  laneKeys: string[] // ['h','j','k','l']
  notes: ReadonlyArray<{ lane: number; timeMs: number }>
  difficulty: 'basic' | 'motions' | 'operators' | 'full'
}

export interface RhythmState extends GameState {
  combo: number
  maxCombo: number
  multiplier: number
  perfectCount: number
  goodCount: number
  missCount: number
  lastHitResult: HitResult | null
  songProgress: number // 0..1
  laneKeys: string[]
}