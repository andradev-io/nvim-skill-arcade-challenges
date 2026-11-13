export type CellType = 'open' | 'wall' | 'start' | 'goal' | 'collectible' | 'door' | 'marker'

export interface DoorSpec {
  row: number
  col: number
  requiredMotion: string // e.g., "w", "3w", "fa"
}

export interface MotionTrail {
  row: number
  col: number
  timestamp: number
}

export interface MazeLevel {
  id: string
  name: string
  width: number
  height: number
  grid: CellType[][]
  doors: DoorSpec[]
  markers: Record<string, string> // key: "row,col", value: character label
  parSeconds: number
  parMotions: number
  hints?: string[]
}