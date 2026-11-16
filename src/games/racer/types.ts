import type { GameState } from '../engine/types'

export interface ObstacleSpec {
  position: number // 0-1 normalized along track
  command: string
  label: string
  points: number
  timeoutMs: number
  lane: number // -1 = spans all lanes
}

export interface RacerLevel {
  id: string
  name: string
  laneCount: number // 2-4
  trackLength: number
  baseSpeed: number
  maxSpeed: number
  obstacles: ReadonlyArray<ObstacleSpec>
  parSeconds: number
  parAccuracy: number
  hints?: string[]
}

export interface ActiveObstacle extends ObstacleSpec {
  screenX: number
  prompted: boolean
  typedBuffer: string
  cleared: boolean
  missed: boolean
  promptStartMs: number
}

export interface RacerState extends GameState {
  scrollPosition: number
  currentLane: number
  activeObstacles: ActiveObstacle[]
  combo: number
  totalObstacles: number
  clearedObstacles: number
  elapsedMs: number
  speedMultiplier: number
  lives: number
}