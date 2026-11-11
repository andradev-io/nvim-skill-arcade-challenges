export type Cursor = [number, number]

export interface QuickfixExpect {
  idx?: number
  size?: number
  all_contain?: string
}

export interface Expect {
  text?: string
  cursor?: [number] | [number, number]
  windows?: number
  layout?: 'row' | 'col'
  extra_tabs?: number
  quickfix?: QuickfixExpect
  float_text?: string
  alt_buffer?: boolean
  marks?: Record<string, number>
}

export type Forbid = 'hjkl' | 'arrows' | 'mouse'

/** A track: the buffer is a text-grid map, reach the goal cell (touching the checkpoints in order). */
export interface Track {
  goal: Cursor
  checkpoints?: Cursor[]
  forbid?: Forbid[]
}

export interface Challenge {
  id: string
  title: string
  area: string
  level: number
  brief: string
  text: string
  cursor: Cursor
  ft?: string
  expect: Expect
  track?: Track
  preset?: string
  preset_rows?: number[]
  solution: string
  why: string
  hint?: string
  author?: string
  plugin_par?: number
  needs?: string
  helps?: Record<string, string>
  loose?: boolean
  /** Daily/AI challenges: the day they are featured (YYYY-MM-DD), the model that wrote them and the prompt (file version and hash). */
  date?: string
  generated?: boolean
  model?: string
  prompt?: string
}

/** Every form field as typed text, exactly what the author sees. */
export interface DraftForm {
  title: string
  id: string
  idTouched: boolean
  area: string
  level: string
  brief: string
  text: string
  crow: string
  ccol: string
  ft: string
  etext: string
  erow: string
  ecol: string
  windows: string
  layout: string
  extraTabs: string
  qidx: string
  qsize: string
  qall: string
  floatText: string
  marks: string
  altBuffer: boolean
  preset: string
  presetRows: string
  solution: string
  why: string
  hint: string
  author: string
  hgroup: string
  htip: string
  pluginPar: string
  needs: string
  /** track area only: goal cell, checkpoints as "row:col, row:col", key rules */
  goalRow: string
  goalCol: string
  checkpoints: string
  forbidHjkl: boolean
  forbidArrows: boolean
  forbidMouse: boolean
}

export interface State {
  text: string
  cursor: Cursor
}
