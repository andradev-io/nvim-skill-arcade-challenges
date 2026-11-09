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
}

export interface State {
  text: string
  cursor: Cursor
}
