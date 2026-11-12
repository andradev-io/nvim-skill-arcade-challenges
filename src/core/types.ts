export type Cursor = [number, number]

export interface QuickfixExpect {
  idx?: number
  size?: number
  all_contain?: string
}

export interface HarpoonSlot {
  text: string
  cursor?: Cursor
  ft?: string
}

export interface HarpoonConfig {
  slots: Record<string, HarpoonSlot>
  sequence?: string[]
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
  active_slot?: string
}

export type Forbid = 'hjkl' | 'arrows' | 'mouse'

/** A track: the buffer is a text-grid map, reach the goal cell (touching the checkpoints in order). */
export interface Track {
  goal: Cursor
  checkpoints?: Cursor[]
  forbid?: Forbid[]
}

export interface JumpTargetData {
  label: string
  row: number
  col: number
}

export interface PickerItem {
  label: string
  line?: number
  content?: string
}

export interface PickerConfig {
  type?: 'find_files' | 'grep' | 'buffers'
  prompt?: string
  items: PickerItem[]
  expect_selection?: number | string
}

/** A single entry in a which-key prefix group. */
export interface WhichKeyEntryData {
  key: string
  label: string
  group?: string
}

/** A prefix trigger with its entries and optional nested children. */
export interface WhichKeyPrefixData {
  trigger: string
  entries: WhichKeyEntryData[]
  children?: WhichKeyPrefixData[]
}

/** Which-key overlay configuration embedded in a challenge. */
export interface ChallengeWhichKey {
  prefixes: WhichKeyPrefixData[]
  timeout_ms?: number
}

/** A single hover entry for LSP simulation (row is 1-based). */
export interface LspHoverEntry {
  row: number
  col: number
  end_col?: number
  text: string
}

/** A single go-to-definition entry for LSP simulation (row is 1-based). */
export interface LspDefinitionEntry {
  row: number
  col: number
  end_col?: number
  target_row: number
  target_col: number
}

/** A single diagnostic entry for LSP simulation (row is 1-based). */
export interface LspDiagnosticEntry {
  row: number
  col: number
  end_col: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message?: string
}

/** LSP simulation configuration embedded in a challenge. */
export interface LspConfig {
  hover?: LspHoverEntry[]
  definition?: LspDefinitionEntry[]
  diagnostics?: LspDiagnosticEntry[]
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
  /** Pre-computed jump targets for label-based motion simulation. */
  jump_targets?: JumpTargetData[]
/** Picker simulation config (Telescope/fzf). */
  picker?: PickerConfig
  /** Harpoon slot configuration for named-mark navigation challenges. */
  harpoon?: HarpoonConfig
  /** Which-key prefix hint overlay configuration for this challenge. */
  which_key?: ChallengeWhichKey
  /** LSP simulation configuration (hover, go-to-definition, diagnostics). */
  lsp?: LspConfig
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
  jumpTargets: string
  pickerJson: string
  /** track area only: goal cell, checkpoints as "row:col, row:col", key rules */
  goalRow: string
  goalCol: string
  checkpoints: string
  forbidHjkl: boolean
  forbidArrows: boolean
  forbidMouse: boolean
/** Harpoon slots as "a=text|cursor|ft, b=..." and visit sequence as "a,b,c". */
  harpoonSlots: string
  harpoonSequence: string
  whichKeyJson: string
  lspJson: string
}

export interface State {
  text: string
  cursor: Cursor
}
