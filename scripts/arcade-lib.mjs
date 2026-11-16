// Shared utilities for the arcade phase generation pipeline. Sanitizers validate model output field by field,
// playability validators check that a level is actually solvable, and the serializer + campaign helpers turn a
// validated level into source code. Pure helpers only — no network, no side effects except appendLevelToSource /
// appendStageToCampaign which read and write known files.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── re-exports from daily-lib ───────────────────────────────────────────────
export {
  resolveBaseUrl, redact, extractJson, slugify,
  resolveModels, modelChain, cleanModel,
  resolveBudgetMs, resolveTimeoutMs,
  capExtra, parsePromptFile, render,
  readUsage, addUsage, usageLines,
  knownSet, duplicateOf, remember,
} from './daily-lib.mjs'

// ── shared validation helpers ───────────────────────────────────────────────

const str = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined)
const posInt = (v) => (Number.isInteger(v) && v > 0 ? v : undefined)
const posNum = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined)
const intRange = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined)
const numRange = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined)

// ── maze sanitizer ──────────────────────────────────────────────────────────

const CELL_TYPES = new Set(['open', 'wall', 'start', 'goal', 'collectible', 'door', 'marker'])

export function sanitizeMazeLevel(raw, meta) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }

  const name = str(raw.name, 40)
  if (!name) return { error: 'name is required (string, max 40 chars)' }

  const width = intRange(raw.width, 8, 20)
  if (!width) return { error: 'width must be integer 8-20' }

  const height = intRange(raw.height, 6, 16)
  if (!height) return { error: 'height must be integer 6-16' }

  // grid
  if (!Array.isArray(raw.grid)) return { error: 'grid must be an array' }
  if (raw.grid.length !== height) return { error: `grid has ${raw.grid.length} rows, expected ${height}` }
  let startCount = 0
  let goalCount = 0
  for (let r = 0; r < height; r++) {
    const row = raw.grid[r]
    if (!Array.isArray(row)) return { error: `grid[${r}] is not an array` }
    if (row.length !== width) return { error: `grid[${r}] has ${row.length} cols, expected ${width}` }
    for (let c = 0; c < width; c++) {
      if (!CELL_TYPES.has(row[c])) return { error: `grid[${r}][${c}] has invalid cell type "${row[c]}"` }
      if (row[c] === 'start') startCount++
      if (row[c] === 'goal') goalCount++
    }
  }
  if (startCount !== 1) return { error: `grid must have exactly one start cell (found ${startCount})` }
  if (goalCount !== 1) return { error: `grid must have exactly one goal cell (found ${goalCount})` }

  // doors
  if (!Array.isArray(raw.doors)) return { error: 'doors must be an array' }
  const doors = []
  for (let i = 0; i < raw.doors.length; i++) {
    const d = raw.doors[i]
    if (!d || typeof d !== 'object') return { error: `doors[${i}] is not an object` }
    const dr = intRange(d.row, 0, height - 1)
    const dc = intRange(d.col, 0, width - 1)
    if (dr === undefined || dc === undefined) return { error: `doors[${i}] row/col out of bounds` }
    if (typeof d.requiredMotion !== 'string' || !d.requiredMotion.trim()) {
      return { error: `doors[${i}] requiredMotion must be a non-empty string` }
    }
    doors.push({ row: dr, col: dc, requiredMotion: d.requiredMotion })
  }

  // markers
  if (!raw.markers || typeof raw.markers !== 'object' || Array.isArray(raw.markers)) {
    return { error: 'markers must be a Record<string, string>' }
  }
  const markers = {}
  for (const [key, val] of Object.entries(raw.markers)) {
    const m = /^(\d+),(\d+)$/.exec(key)
    if (!m) return { error: `marker key "${key}" is not "row,col" format` }
    const mr = Number(m[1])
    const mc = Number(m[2])
    if (mr < 0 || mr >= height || mc < 0 || mc >= width) return { error: `marker "${key}" out of bounds` }
    if (typeof val !== 'string' || val.length !== 1) return { error: `marker value at "${key}" must be a single character` }
    markers[key] = val
  }

  const parSeconds = posNum(raw.parSeconds)
  if (!parSeconds) return { error: 'parSeconds must be a positive number' }

  const parMotions = posInt(raw.parMotions)
  if (!parMotions) return { error: 'parMotions must be a positive integer' }

  // hints
  let hints
  if (raw.hints !== undefined) {
    if (!Array.isArray(raw.hints)) return { error: 'hints must be an array' }
    if (raw.hints.length > 2) return { error: 'hints may have at most 2 entries' }
    hints = []
    for (let i = 0; i < raw.hints.length; i++) {
      const h = str(raw.hints[i], 80)
      if (!h) return { error: `hints[${i}] must be a string of at most 80 chars` }
      hints.push(h)
    }
  }

  const compact = (meta?.date ?? '').replace(/-/g, '')
  const id = str(raw.id, 60) ?? `maze-${compact}-${meta?.index ?? 0}`

  const level = { id, name, width, height, grid: raw.grid.map((r) => [...r]), doors, markers, parSeconds, parMotions }
  if (hints) level.hints = hints
  return { level }
}

// ── rhythm sanitizer ────────────────────────────────────────────────────────

const DIFFICULTIES = new Set(['basic', 'motions', 'operators', 'full'])

function notesFromPattern(pattern, bpm, startBeat = 0) {
  const msPerBeat = 60_000 / bpm
  const keyMap = { h: 0, j: 1, k: 2, l: 3 }
  const notes = []
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '-' || !(ch in keyMap)) continue
    notes.push({ lane: keyMap[ch], timeMs: Math.round((startBeat + i) * msPerBeat) })
  }
  return notes
}

export function sanitizeRhythmLevel(raw, meta) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }

  const name = str(raw.name, 40)
  if (!name) return { error: 'name is required (string, max 40 chars)' }

  const bpm = intRange(raw.bpm, 70, 160)
  if (!bpm) return { error: 'bpm must be integer 70-160' }

  const durationMs = intRange(raw.durationMs, 20000, 60000)
  if (!durationMs) return { error: 'durationMs must be integer 20000-60000' }

  const laneCount = intRange(raw.laneCount, 4, 12)
  if (!laneCount) return { error: 'laneCount must be integer 4-12' }

  if (!Array.isArray(raw.laneKeys)) return { error: 'laneKeys must be an array' }
  if (raw.laneKeys.length !== laneCount) return { error: `laneKeys length (${raw.laneKeys.length}) must equal laneCount (${laneCount})` }
  for (let i = 0; i < raw.laneKeys.length; i++) {
    if (typeof raw.laneKeys[i] !== 'string' || raw.laneKeys[i].length !== 1) {
      return { error: `laneKeys[${i}] must be a single character` }
    }
  }

  if (!DIFFICULTIES.has(raw.difficulty)) return { error: `difficulty must be one of: ${[...DIFFICULTIES].join(', ')}` }

  // notes: either provided directly or expanded from pattern
  let notes
  if (typeof raw.pattern === 'string' && raw.pattern.length > 0) {
    notes = notesFromPattern(raw.pattern, bpm)
  } else if (Array.isArray(raw.notes)) {
    notes = raw.notes
  } else {
    return { error: 'notes array or pattern string is required' }
  }

  // validate notes
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i]
    if (!n || typeof n !== 'object') return { error: `notes[${i}] is not an object` }
    if (!Number.isInteger(n.lane) || n.lane < 0 || n.lane >= laneCount) {
      return { error: `notes[${i}].lane must be integer in [0, ${laneCount - 1}]` }
    }
    if (!Number.isInteger(n.timeMs) || n.timeMs < 0 || n.timeMs > durationMs) {
      return { error: `notes[${i}].timeMs must be integer in [0, ${durationMs}]` }
    }
  }

  // no two notes in same lane within 200ms
  const byLane = new Map()
  for (const n of notes) {
    const times = byLane.get(n.lane) ?? []
    times.push(n.timeMs)
    byLane.set(n.lane, times)
  }
  for (const [, times] of byLane) {
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < 200) {
        return { error: `two notes in lane ${byLane.keys().next().value} are within 200ms (${times[i - 1]} and ${times[i]})` }
      }
    }
  }

  const compact = (meta?.date ?? '').replace(/-/g, '')
  const id = str(raw.id, 60) ?? `rhythm-${compact}-${meta?.index ?? 0}`

  return {
    level: {
      id,
      name,
      bpm,
      durationMs,
      laneCount,
      laneKeys: [...raw.laneKeys],
      notes: notes.map((n) => ({ lane: n.lane, timeMs: n.timeMs })),
      difficulty: raw.difficulty,
    },
  }
}

// ── defender sanitizer ──────────────────────────────────────────────────────

export function sanitizeDefenderWave(raw, meta) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }

  const wave = posInt(raw.wave)
  if (!wave) return { error: 'wave must be a positive integer' }

  if (!Array.isArray(raw.commands) || raw.commands.length === 0) {
    return { error: 'commands must be a non-empty array of strings' }
  }
  const commands = []
  for (let i = 0; i < raw.commands.length; i++) {
    if (typeof raw.commands[i] !== 'string' || !raw.commands[i].trim()) {
      return { error: `commands[${i}] must be a non-empty string` }
    }
    commands.push(raw.commands[i])
  }

  const enemyCount = intRange(raw.enemyCount, 6, 30)
  if (!enemyCount) return { error: 'enemyCount must be integer 6-30' }

  const spawnIntervalMs = intRange(raw.spawnIntervalMs, 500, 3000)
  if (!spawnIntervalMs) return { error: 'spawnIntervalMs must be integer 500-3000' }

  const baseSpeed = intRange(raw.baseSpeed, 20, 100)
  if (!baseSpeed) return { error: 'baseSpeed must be integer 20-100' }

  const maxVariance = baseSpeed * 0.4
  const speedVariance = numRange(raw.speedVariance, 0, maxVariance)
  if (speedVariance === undefined) return { error: `speedVariance must be number 0-${maxVariance}` }

  return {
    level: { wave, commands, enemyCount, spawnIntervalMs, baseSpeed, speedVariance },
  }
}

// ── snake sanitizer ─────────────────────────────────────────────────────────

export function sanitizeSnakeLevel(raw, meta) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }

  const name = str(raw.name, 40)
  if (!name) return { error: 'name is required (string, max 40 chars)' }

  const width = intRange(raw.width, 8, 20)
  if (!width) return { error: 'width must be integer 8-20' }

  const height = intRange(raw.height, 6, 16)
  if (!height) return { error: 'height must be integer 6-16' }

  // walls
  if (!Array.isArray(raw.walls)) return { error: 'walls must be an array' }
  const wallSet = new Set()
  const walls = []
  for (let i = 0; i < raw.walls.length; i++) {
    const w = raw.walls[i]
    if (!w || typeof w !== 'object') return { error: `walls[${i}] is not an object` }
    const wr = intRange(w.row, 0, height - 1)
    const wc = intRange(w.col, 0, width - 1)
    if (wr === undefined || wc === undefined) return { error: `walls[${i}] position out of bounds` }
    const key = `${wr},${wc}`
    if (wallSet.has(key)) return { error: `duplicate wall at ${key}` }
    wallSet.add(key)
    walls.push({ row: wr, col: wc })
  }

  // initialFood
  if (!Array.isArray(raw.initialFood) || raw.initialFood.length === 0) {
    return { error: 'initialFood must be a non-empty array' }
  }
  const foodPositions = new Set()
  const initialFood = []
  for (let i = 0; i < raw.initialFood.length; i++) {
    const f = raw.initialFood[i]
    if (!f || typeof f !== 'object') return { error: `initialFood[${i}] is not an object` }
    if (!f.position || typeof f.position !== 'object') return { error: `initialFood[${i}].position is required` }
    const fr = intRange(f.position.row, 0, height - 1)
    const fc = intRange(f.position.col, 0, width - 1)
    if (fr === undefined || fc === undefined) return { error: `initialFood[${i}] position out of bounds` }
    const fkey = `${fr},${fc}`
    if (wallSet.has(fkey)) return { error: `initialFood[${i}] is on a wall` }
    if (foodPositions.has(fkey)) return { error: `duplicate food position at ${fkey}` }
    foodPositions.add(fkey)
    const label = str(f.label, 30)
    if (!label) return { error: `initialFood[${i}].label is required (string, max 30)` }
    const tip = str(f.tip, 120)
    if (!tip) return { error: `initialFood[${i}].tip is required (string, max 120)` }
    const points = posInt(f.points)
    if (!points) return { error: `initialFood[${i}].points must be a positive integer` }
    initialFood.push({ position: { row: fr, col: fc }, label, tip, points })
  }

  const spawnRate = intRange(raw.spawnRate, 500, 5000)
  if (!spawnRate) return { error: 'spawnRate must be integer 500-5000' }

  const baseSpeed = intRange(raw.baseSpeed, 100, 400)
  if (!baseSpeed) return { error: 'baseSpeed must be integer 100-400' }

  const speedIncreasePerFood = numRange(raw.speedIncreasePerFood, 0, 50)
  if (speedIncreasePerFood === undefined) return { error: 'speedIncreasePerFood must be number 0-50' }

  const parFoods = posInt(raw.parFoods)
  if (!parFoods) return { error: 'parFoods must be a positive integer' }

  const parTime = posNum(raw.parTime)
  if (!parTime) return { error: 'parTime must be a positive number' }

  if (typeof raw.allowWordMotions !== 'boolean') return { error: 'allowWordMotions must be a boolean' }

  let hints
  if (raw.hints !== undefined) {
    if (!Array.isArray(raw.hints)) return { error: 'hints must be an array' }
    hints = []
    for (let i = 0; i < raw.hints.length; i++) {
      const h = str(raw.hints[i], 80)
      if (!h) return { error: `hints[${i}] must be a string of at most 80 chars` }
      hints.push(h)
    }
  }

  const compact = (meta?.date ?? '').replace(/-/g, '')
  const id = str(raw.id, 60) ?? `snake-${compact}-${meta?.index ?? 0}`

  const level = {
    id, name, width, height, walls, initialFood,
    spawnRate, baseSpeed, speedIncreasePerFood,
    parFoods, parTime, allowWordMotions: raw.allowWordMotions,
  }
  if (hints) level.hints = hints
  return { level }
}

// ── memory sanitizer ────────────────────────────────────────────────────────

const CATEGORIES = new Set(['motion', 'operator', 'text-object', 'combo'])

export function sanitizeMemoryLevel(raw, meta) {
  if (!raw || typeof raw !== 'object') return { error: 'not an object' }

  const name = str(raw.name, 40)
  if (!name) return { error: 'name is required (string, max 40 chars)' }

  if (!Array.isArray(raw.pairs) || raw.pairs.length === 0) {
    return { error: 'pairs must be a non-empty array' }
  }
  const pairIds = new Set()
  const pairs = []
  for (let i = 0; i < raw.pairs.length; i++) {
    const p = raw.pairs[i]
    if (!p || typeof p !== 'object') return { error: `pairs[${i}] is not an object` }
    const pid = str(p.id, 40)
    if (!pid) return { error: `pairs[${i}].id is required (string, max 40)` }
    if (pairIds.has(pid)) return { error: `duplicate pair id "${pid}"` }
    pairIds.add(pid)
    const command = str(p.command, 40)
    if (!command) return { error: `pairs[${i}].command is required (string, max 40)` }
    const description = str(p.description, 120)
    if (!description) return { error: `pairs[${i}].description is required (string, max 120)` }
    if (!CATEGORIES.has(p.category)) return { error: `pairs[${i}].category must be one of: ${[...CATEGORIES].join(', ')}` }
    pairs.push({ id: pid, command, description, category: p.category })
  }

  const gridCols = intRange(raw.gridCols, 3, 8)
  if (!gridCols) return { error: 'gridCols must be integer 3-8' }

  const gridRows = intRange(raw.gridRows, 2, 6)
  if (!gridRows) return { error: 'gridRows must be integer 2-6' }

  if (gridCols * gridRows !== pairs.length * 2) {
    return { error: `gridCols*gridRows (${gridCols * gridRows}) must equal pairs.length*2 (${pairs.length * 2})` }
  }

  const parTime = posNum(raw.parTime)
  if (!parTime) return { error: 'parTime must be a positive number' }

  const parMoves = posInt(raw.parMoves)
  if (!parMoves) return { error: 'parMoves must be a positive integer' }
  if (parMoves < pairs.length) return { error: `parMoves (${parMoves}) must be >= pairs.length (${pairs.length})` }

  let hints
  if (raw.hints !== undefined) {
    if (!Array.isArray(raw.hints)) return { error: 'hints must be an array' }
    hints = []
    for (let i = 0; i < raw.hints.length; i++) {
      const h = str(raw.hints[i], 80)
      if (!h) return { error: `hints[${i}] must be a string of at most 80 chars` }
      hints.push(h)
    }
  }

  const compact = (meta?.date ?? '').replace(/-/g, '')
  const id = str(raw.id, 60) ?? `memory-${compact}-${meta?.index ?? 0}`

  const level = { id, name, pairs, gridCols, gridRows, parTime, parMoves }
  if (hints) level.hints = hints
  return { level }
}

// ── playability validators ──────────────────────────────────────────────────

function bfs(grid, startR, startC, height, width) {
  const visited = new Set()
  const queue = [[startR, startC]]
  visited.add(`${startR},${startC}`)
  while (queue.length > 0) {
    const [r, c] = queue.shift()
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
      const key = `${nr},${nc}`
      if (visited.has(key)) continue
      if (grid[nr][nc] === 'wall') continue
      visited.add(key)
      queue.push([nr, nc])
    }
  }
  return visited
}

export function validateMazePlayability(level) {
  const errors = []
  const { grid, width, height, doors, markers } = level

  // count start/goal
  let startR, startC, goalR, goalC
  let startCount = 0, goalCount = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === 'start') { startR = r; startC = c; startCount++ }
      if (grid[r][c] === 'goal') { goalR = r; goalC = c; goalCount++ }
    }
  }
  if (startCount !== 1) errors.push(`expected exactly 1 start cell, found ${startCount}`)
  if (goalCount !== 1) errors.push(`expected exactly 1 goal cell, found ${goalCount}`)

  if (startCount === 1 && goalCount === 1) {
    const reachable = bfs(grid, startR, startC, height, width)

    if (!reachable.has(`${goalR},${goalC}`)) {
      errors.push('goal is not reachable from start')
    }

    // every collectible must be reachable
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === 'collectible' && !reachable.has(`${r},${c}`)) {
          errors.push(`collectible at (${r},${c}) is not reachable from start`)
        }
      }
    }
  }

  // doors with f/t motions must reference existing markers
  for (const door of doors) {
    const motion = door.requiredMotion
    const ftMatch = /^[ft](.)$/.exec(motion)
    if (ftMatch) {
      const targetChar = ftMatch[1]
      const markerValues = Object.values(markers ?? {})
      if (!markerValues.includes(targetChar)) {
        errors.push(`door at (${door.row},${door.col}) requires f/t motion targeting "${targetChar}" but no marker has that character`)
      }
    }
  }

  return errors
}

export function validateRhythmPlayability(level) {
  const errors = []
  const { notes, durationMs, laneKeys, laneCount } = level

  // When parsing TS source, notes may be unresolved variable refs replaced with [].
  // Skip the empty-notes check in that case; the sanitizer catches truly missing notes.
  if (!notes || (notes.length === 0 && !level._notesUnresolved)) {
    errors.push('at least one note is required')
    return errors
  }
  if (notes.length === 0) return errors // unresolved notes — skip further note checks

  if (laneKeys.length !== laneCount) {
    errors.push(`laneKeys.length (${laneKeys.length}) does not match laneCount (${laneCount})`)
  }

  for (let i = 0; i < notes.length; i++) {
    if (notes[i].timeMs < 0 || notes[i].timeMs > durationMs) {
      errors.push(`note[${i}].timeMs (${notes[i].timeMs}) is outside [0, ${durationMs}]`)
    }
  }

  // no two notes in same lane within 200ms
  const byLane = new Map()
  for (const n of notes) {
    const times = byLane.get(n.lane) ?? []
    times.push(n.timeMs)
    byLane.set(n.lane, times)
  }
  for (const [lane, times] of byLane) {
    times.sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] < 200) {
        errors.push(`two notes in lane ${lane} are within 200ms (${times[i - 1]} and ${times[i]})`)
      }
    }
  }

  return errors
}

export function validateDefenderPlayability(level) {
  const errors = []

  if (!level.commands || level.commands.length === 0) {
    errors.push('commands must be non-empty')
  }

  if (!Number.isInteger(level.enemyCount) || level.enemyCount < 1) {
    errors.push('enemyCount must be >= 1')
  }

  if (!Number.isInteger(level.spawnIntervalMs) || level.spawnIntervalMs < 500 || level.spawnIntervalMs > 5000) {
    errors.push('spawnIntervalMs must be in [500, 5000]')
  }

  if (typeof level.baseSpeed !== 'number' || level.baseSpeed <= 0) {
    errors.push('baseSpeed must be > 0')
  }

  if (typeof level.speedVariance !== 'number' || level.speedVariance < 0) {
    errors.push('speedVariance must be >= 0')
  }

  return errors
}

function floodFillSnake(width, height, walls) {
  const wallSet = new Set(walls.map((w) => `${w.row},${w.col}`))
  const visited = new Set()
  // find first open cell
  let startKey = null
  for (let r = 0; r < height && !startKey; r++) {
    for (let c = 0; c < width && !startKey; c++) {
      const key = `${r},${c}`
      if (!wallSet.has(key)) startKey = key
    }
  }
  if (!startKey) return { visited, openCount: 0 }

  const queue = [startKey]
  visited.add(startKey)
  while (queue.length > 0) {
    const key = queue.shift()
    const [r, c] = key.split(',').map(Number)
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
      const nk = `${nr},${nc}`
      if (visited.has(nk) || wallSet.has(nk)) continue
      visited.add(nk)
      queue.push(nk)
    }
  }

  let openCount = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!wallSet.has(`${r},${c}`)) openCount++
    }
  }

  return { visited, openCount }
}

export function validateSnakePlayability(level) {
  const errors = []
  const { width, height, walls, initialFood } = level

  // When parsing TS source, initialFood may be an unresolved function call replaced with [].
  if ((!initialFood || initialFood.length === 0) && !level._foodUnresolved) {
    errors.push('at least one food item is required')
  }
  if (initialFood && initialFood.length === 0 && level._foodUnresolved) return errors

  // flood-fill connectivity
  const { visited, openCount } = floodFillSnake(width, height, walls)
  if (visited.size !== openCount) {
    errors.push(`not all open cells are connected: ${visited.size} reachable out of ${openCount} open cells`)
  }

  // food not on walls
  const wallSet = new Set(walls.map((w) => `${w.row},${w.col}`))
  const foodPositions = new Set()
  for (const f of initialFood ?? []) {
    const key = `${f.position.row},${f.position.col}`
    if (wallSet.has(key)) {
      errors.push(`food at (${f.position.row},${f.position.col}) is on a wall`)
    }
    if (foodPositions.has(key)) {
      errors.push(`duplicate food position at (${f.position.row},${f.position.col})`)
    }
    foodPositions.add(key)
  }

  return errors
}

export function validateMemoryPlayability(level) {
  const errors = []
  const { pairs, gridCols, gridRows, parMoves } = level

  // When parsing TS source, pairs may be an unresolved function call replaced with [].
  if (pairs && pairs.length === 0 && level._pairsUnresolved) return errors

  if (gridCols * gridRows !== pairs.length * 2) {
    errors.push(`gridCols*gridRows (${gridCols * gridRows}) does not equal pairs.length*2 (${pairs.length * 2})`)
  }

  const ids = new Set()
  for (const p of pairs) {
    if (ids.has(p.id)) errors.push(`duplicate pair id "${p.id}"`)
    ids.add(p.id)
  }

  if (parMoves < pairs.length) {
    errors.push(`parMoves (${parMoves}) must be >= pairs.length (${pairs.length})`)
  }

  return errors
}

// ── TypeScript serializer ───────────────────────────────────────────────────

function jsValue(v, indent = 0) {
  const pad = '  '.repeat(indent)
  const pad1 = '  '.repeat(indent + 1)
  if (v === null || v === undefined) return 'undefined'
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    // check if it's an array of simple values
    const allSimple = v.every((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')
    if (allSimple && v.length <= 8) {
      return `[${v.map((x) => jsValue(x)).join(', ')}]`
    }
    const items = v.map((x) => `${pad1}${jsValue(x, indent + 1)}`).join(',\n')
    return `[\n${items},\n${pad}]`
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v)
    if (entries.length === 0) return '{}'
    const props = entries.map(([k, val]) => `${pad1}${JSON.stringify(k)}: ${jsValue(val, indent + 1)}`).join(',\n')
    return `{\n${props},\n${pad}}`
  }
  return String(v)
}

function serializeGrid(grid) {
  const rows = grid.map((row) => {
    const cells = row.map((c) => `'${c}'`).join(', ')
    return `    [${cells}],`
  })
  return `[\n${rows.join('\n')}\n  ]`
}

function serializeNotes(notes) {
  if (notes.length === 0) return '[]'
  const items = notes.map((n) => `    { lane: ${n.lane}, timeMs: ${n.timeMs} }`)
  return `[\n${items.join(',\n')},\n  ]`
}

function serializePairs(pairs) {
  const items = pairs.map((p) =>
    `    { id: '${p.id}', command: '${p.command}', description: '${p.description}', category: '${p.category}' }`
  )
  return `[\n${items.join(',\n')},\n  ]`
}

function serializePositions(positions) {
  if (positions.length === 0) return '[]'
  const items = positions.map((p) => `    { row: ${p.row}, col: ${p.col} }`)
  return `[\n${items.join(',\n')},\n  ]`
}

function serializeFoodItems(foods) {
  const items = foods.map((f) =>
    `    { position: { row: ${f.position.row}, col: ${f.position.col} }, label: '${f.label}', tip: '${f.tip}', points: ${f.points} }`
  )
  return `[\n${items.join(',\n')},\n  ]`
}

function serializeDoors(doors) {
  if (doors.length === 0) return '[]'
  const items = doors.map((d) => `    { row: ${d.row}, col: ${d.col}, requiredMotion: '${d.requiredMotion}' }`)
  return `[\n${items.join(',\n')},\n  ]`
}

function serializeMarkers(markers) {
  const entries = Object.entries(markers)
  if (entries.length === 0) return '{}'
  const items = entries.map(([k, v]) => `    '${k}': '${v}'`)
  return `{\n${items.join(',\n')},\n  }`
}

function serializeHints(hints) {
  if (!hints || hints.length === 0) return undefined
  return `[${hints.map((h) => `'${h}'`).join(', ')}]`
}

export function serializeToTypeScript(level, game) {
  const validGames = ['maze', 'rhythm', 'defender', 'snake', 'memory']
  if (!validGames.includes(game)) throw new Error(`unknown game: ${game}`)

  const date = new Date().toISOString().slice(0, 10)
  const idPart = level.id ? level.id.replace(/[^a-zA-Z0-9]/g, '_') : `wave${level.wave ?? 0}`
  const varName = `generated_${game}_${idPart}`
  const lines = [`// Generated by arcade phase pipeline on ${date}`]

  if (game === 'maze') {
    lines.push(`const ${varName}: MazeLevel = {`)
    lines.push(`  id: '${level.id}',`)
    lines.push(`  name: '${level.name}',`)
    lines.push(`  width: ${level.width},`)
    lines.push(`  height: ${level.height},`)
    lines.push(`  parSeconds: ${level.parSeconds},`)
    lines.push(`  parMotions: ${level.parMotions},`)
    lines.push(`  doors: ${serializeDoors(level.doors)},`)
    lines.push(`  markers: ${serializeMarkers(level.markers)},`)
    const hintsStr = serializeHints(level.hints)
    if (hintsStr) lines.push(`  hints: ${hintsStr},`)
    lines.push(`  grid: ${serializeGrid(level.grid)},`)
    lines.push('}')
  } else if (game === 'rhythm') {
    lines.push(`const ${varName}: RhythmLevel = {`)
    lines.push(`  id: '${level.id}',`)
    lines.push(`  name: '${level.name}',`)
    lines.push(`  bpm: ${level.bpm},`)
    lines.push(`  durationMs: ${level.durationMs},`)
    lines.push(`  laneCount: ${level.laneCount},`)
    lines.push(`  laneKeys: [${level.laneKeys.map((k) => `'${k}'`).join(', ')}],`)
    lines.push(`  notes: ${serializeNotes(level.notes)},`)
    lines.push(`  difficulty: '${level.difficulty}',`)
    lines.push('}')
  } else if (game === 'defender') {
    lines.push(`const ${varName}: WaveConfig = {`)
    lines.push(`  wave: ${level.wave},`)
    lines.push(`  commands: [${level.commands.map((c) => `'${c}'`).join(', ')}],`)
    lines.push(`  enemyCount: ${level.enemyCount},`)
    lines.push(`  spawnIntervalMs: ${level.spawnIntervalMs},`)
    lines.push(`  baseSpeed: ${level.baseSpeed},`)
    lines.push(`  speedVariance: ${level.speedVariance},`)
    lines.push('}')
  } else if (game === 'snake') {
    lines.push(`const ${varName}: SnakeLevel = {`)
    lines.push(`  id: '${level.id}',`)
    lines.push(`  name: '${level.name}',`)
    lines.push(`  width: ${level.width},`)
    lines.push(`  height: ${level.height},`)
    lines.push(`  walls: ${serializePositions(level.walls)},`)
    lines.push(`  initialFood: ${serializeFoodItems(level.initialFood)},`)
    lines.push(`  spawnRate: ${level.spawnRate},`)
    lines.push(`  baseSpeed: ${level.baseSpeed},`)
    lines.push(`  speedIncreasePerFood: ${level.speedIncreasePerFood},`)
    lines.push(`  parFoods: ${level.parFoods},`)
    lines.push(`  parTime: ${level.parTime},`)
    const hintsStr = serializeHints(level.hints)
    if (hintsStr) lines.push(`  hints: ${hintsStr},`)
    lines.push(`  allowWordMotions: ${level.allowWordMotions},`)
    lines.push('}')
  } else if (game === 'memory') {
    lines.push(`const ${varName}: MemoryLevel = {`)
    lines.push(`  id: '${level.id}',`)
    lines.push(`  name: '${level.name}',`)
    lines.push(`  pairs: ${serializePairs(level.pairs)},`)
    lines.push(`  gridCols: ${level.gridCols},`)
    lines.push(`  gridRows: ${level.gridRows},`)
    lines.push(`  parTime: ${level.parTime},`)
    lines.push(`  parMoves: ${level.parMoves},`)
    const hintsStr = serializeHints(level.hints)
    if (hintsStr) lines.push(`  hints: ${hintsStr},`)
    lines.push('}')
  }

  return { code: lines.join('\n'), varName }
}

// ── source file modifier ────────────────────────────────────────────────────

const GAME_FILES = {
  maze: 'src/games/maze/levels.ts',
  rhythm: 'src/games/rhythm/levels.ts',
  defender: 'src/games/defender/waves.ts',
  snake: 'src/games/snake/levels.ts',
  memory: 'src/games/memory/levels.ts',
}

const EXPORT_ARRAYS = {
  maze: 'MAZE_LEVELS',
  rhythm: 'RHYTHM_LEVELS',
  defender: 'WAVE_CONFIGS',
  snake: 'SNAKE_LEVELS',
  memory: 'MEMORY_LEVELS',
}

export function appendLevelToSource(game, tsCode, levelVarName) {
  const relPath = GAME_FILES[game]
  if (!relPath) throw new Error(`unknown game: ${game}`)
  const filePath = resolve(ROOT, relPath)
  const content = readFileSync(filePath, 'utf8')

  // insert the new const declaration before the export line
  const exportName = EXPORT_ARRAYS[game]
  const exportRe = new RegExp(`(export const ${exportName}[^=]*=\\s*\\[)`)
  const match = exportRe.exec(content)
  if (!match) throw new Error(`could not find export const ${exportName} in ${relPath}`)

  const insertPos = match.index
  const before = content.slice(0, insertPos)
  const after = content.slice(insertPos)

  // add varName to the exported array: find the closing bracket and insert before it
  const updatedAfter = after.replace(/\]$/, `, ${levelVarName}]`)

  const newContent = `${before}${tsCode}\n\n${updatedAfter}`
  writeFileSync(filePath, newContent, 'utf8')
  return filePath
}

// ── campaign stage generator ────────────────────────────────────────────────

const TIER_THRESHOLDS = {
  easy: {
    maze: { oneStar: 1.5, twoStars: 1.0, threeStars: 0.75, metric: 'parRatio' },
    rhythm: { oneStar: 50, twoStars: 75, threeStars: 90, metric: 'accuracy' },
    defender: { oneStar: 500, twoStars: 1000, threeStars: 1500, metric: 'score' },
    snake: { oneStar: 1.5, twoStars: 1.0, threeStars: 0.75, metric: 'parRatio' },
    memory: { oneStar: 1.5, twoStars: 1.0, threeStars: 0.75, metric: 'parRatio' },
  },
  medium: {
    maze: { oneStar: 1.8, twoStars: 1.2, threeStars: 0.85, metric: 'parRatio' },
    rhythm: { oneStar: 55, twoStars: 78, threeStars: 92, metric: 'accuracy' },
    defender: { oneStar: 1000, twoStars: 2000, threeStars: 3000, metric: 'score' },
    snake: { oneStar: 1.8, twoStars: 1.2, threeStars: 0.85, metric: 'parRatio' },
    memory: { oneStar: 1.8, twoStars: 1.2, threeStars: 0.85, metric: 'parRatio' },
  },
  hard: {
    maze: { oneStar: 2.0, twoStars: 1.3, threeStars: 0.9, metric: 'parRatio' },
    rhythm: { oneStar: 60, twoStars: 80, threeStars: 95, metric: 'accuracy' },
    defender: { oneStar: 1500, twoStars: 3000, threeStars: 4500, metric: 'score' },
    snake: { oneStar: 2.0, twoStars: 1.3, threeStars: 0.9, metric: 'parRatio' },
    memory: { oneStar: 2.0, twoStars: 1.3, threeStars: 0.9, metric: 'parRatio' },
  },
}

export function generateCampaignStage(level, game, existingStages, tier = 'easy') {
  const gameStages = existingStages.filter((s) => s.gameId === game)
  const levelIndex = gameStages.length
  const totalStages = existingStages.length

  // chapter: every 5 stages
  const chapter = Math.floor(totalStages / 5) + 1

  // star thresholds
  const thresholds = TIER_THRESHOLDS[tier]?.[game] ?? TIER_THRESHOLDS.easy[game]

  // unlock condition: linear chain within game
  let unlockCondition
  if (gameStages.length === 0 && existingStages.length === 0) {
    unlockCondition = { type: 'initial' }
  } else if (gameStages.length === 0) {
    // first stage of this game: unlock after last existing stage
    const lastStage = existingStages[existingStages.length - 1]
    unlockCondition = { type: 'completePrevious', previousStageId: lastStage.id }
  } else {
    const prevStage = gameStages[gameStages.length - 1]
    unlockCondition = { type: 'completePrevious', previousStageId: prevStage.id }
  }

  const stageId = `ch${chapter}-${game}-l${levelIndex}`

  return {
    id: stageId,
    gameId: game,
    levelIndex,
    name: level.name,
    description: `${level.name} — generated level for ${game}.`,
    starThresholds: { ...thresholds },
    unlockCondition,
    chapter,
  }
}

export function appendStageToCampaign(stage) {
  const filePath = resolve(ROOT, 'src/store/campaignStages.ts')
  const content = readFileSync(filePath, 'utf8')

  // build the stage entry as a string
  const entry = [
    '  {',
    `    id: '${stage.id}',`,
    `    gameId: '${stage.gameId}',`,
    `    levelIndex: ${stage.levelIndex},`,
    `    name: '${stage.name}',`,
    `    description: '${stage.description}',`,
    `    starThresholds: { oneStar: ${stage.starThresholds.oneStar}, twoStars: ${stage.starThresholds.twoStars}, threeStars: ${stage.starThresholds.threeStars}, metric: '${stage.starThresholds.metric}' },`,
    stage.unlockCondition.type === 'initial'
      ? `    unlockCondition: { type: 'initial' },`
      : stage.unlockCondition.type === 'starTotal'
        ? `    unlockCondition: { type: 'starTotal', requiredStars: ${stage.unlockCondition.requiredStars} },`
        : `    unlockCondition: { type: 'completePrevious', previousStageId: '${stage.unlockCondition.previousStageId}' },`,
    `    chapter: ${stage.chapter},`,
    '  },',
  ].join('\n')

  // find the last entry in CAMPAIGN_STAGES array (the closing ])
  const closeBracket = content.lastIndexOf(']')
  if (closeBracket < 0) throw new Error('could not find closing bracket of CAMPAIGN_STAGES')

  const newContent = content.slice(0, closeBracket) + entry + '\n' + content.slice(closeBracket)
  writeFileSync(filePath, newContent, 'utf8')
  return filePath
}