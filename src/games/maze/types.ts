export type CellType = 'open' | 'wall' | 'start' | 'goal' | 'collectible' | 'door'

export interface DoorSpec {
  row: number
  col: number
  command: string // e.g., "w", "3w", "dw"
  direction: 'h' | 'j' | 'k' | 'l'
}

export interface MazeLevel {
  id: string
  name: string
  width: number
  height: number
  grid: CellType[][]
  doors: DoorSpec[]
  parSeconds: number
}