import type { GameState } from '../engine/types'

export type Direction = 'h' | 'j' | 'k' | 'l'

export interface Position {
  row: number
  col: number
}

export interface FoodItem {
  position: Position
  label: string
  tip: string
  points: number
}

export interface SnakeLevel {
  id: string
  name: string
  width: number
  height: number
  walls: Position[]
  initialFood: FoodItem[]
  spawnRate: number
  baseSpeed: number
  speedIncreasePerFood: number
  parFoods: number
  parTime: number
  hints?: string[]
  allowWordMotions: boolean
}

export interface SnakeState extends GameState {
  snake: Position[]
  direction: Direction
  food: FoodItem[]
  foodsEaten: number
  lastTip: string | null
  elapsedMs: number
}