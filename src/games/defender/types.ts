import type { GameState } from '../engine/types'

export interface Enemy {
  id: number
  command: string
  tokens: string[]
  typedCount: number
  x: number
  y: number
  speed: number
  alive: boolean
}

export interface Explosion {
  x: number
  y: number
  startTime: number
  duration: number
}

export interface WaveConfig {
  wave: number
  commands: string[]
  enemyCount: number
  spawnIntervalMs: number
  baseSpeed: number
  speedVariance: number
}

export interface DefenderState extends GameState {
  buffer: string
  streak: number
  waveEnemiesLeft: number
  waveActive: boolean
}