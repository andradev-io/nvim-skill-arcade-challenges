#!/usr/bin/env node
// Standalone validator for arcade game levels. Parses TypeScript source files to extract level objects,
// runs the appropriate playability validator, and reports results.
//
// Usage: node scripts/validate-arcade.mjs <source-file> <game>
// Example: node scripts/validate-arcade.mjs src/games/maze/levels.ts maze
// Exit code 0 = all valid, 1 = failures found.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  validateMazePlayability,
  validateRhythmPlayability,
  validateDefenderPlayability,
  validateSnakePlayability,
  validateMemoryPlayability,
} from './arcade-lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const VALIDATORS = {
  maze: validateMazePlayability,
  rhythm: validateRhythmPlayability,
  defender: validateDefenderPlayability,
  snake: validateSnakePlayability,
  memory: validateMemoryPlayability,
}

const EXPORT_NAMES = {
  maze: 'MAZE_LEVELS',
  rhythm: 'RHYTHM_LEVELS',
  defender: 'WAVE_CONFIGS',
  snake: 'SNAKE_LEVELS',
  memory: 'MEMORY_LEVELS',
}

/**
 * Extracts JS object literals from a TypeScript source by finding const declarations
 * that are referenced in the export array. This is a best-effort regex parser — it handles
 * the specific patterns used in this project's level files.
 */
function extractLevels(source, game) {
  const exportName = EXPORT_NAMES[game]
  if (!exportName) throw new Error(`unknown game: ${game}`)

  // Find the export array — match balanced brackets to handle nested objects/arrays
  const exportStartRe = new RegExp(`export\\s+const\\s+${exportName}[^=]*=\\s*\\[`)
  const startMatch = exportStartRe.exec(source)
  if (!startMatch) throw new Error(`could not find export const ${exportName}`)

  const arrayStart = startMatch.index + startMatch[0].length
  // Find matching closing bracket, accounting for nesting and skipping brackets inside strings
  let depth = 1
  let arrayEnd = arrayStart
  let inString = false
  let stringChar = ''
  for (let i = arrayStart; i < source.length && depth > 0; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\' && i + 1 < source.length) { i++; continue } // skip escaped char
      if (ch === stringChar) inString = false
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true
      stringChar = ch
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) arrayEnd = i
    }
  }
  const arrayContent = source.slice(arrayStart, arrayEnd)

  // Try extracting named variable references first (e.g., [level1, level2])
  const varNames = arrayContent
    .split(',')
    .map((s) => s.trim().replace(/\bas\s+const\b/, '').trim())
    .filter((s) => s && /^[a-zA-Z_]\w*$/.test(s))

  const levels = []

  if (varNames.length > 0) {
    for (const varName of varNames) {
      const constRe = new RegExp(
        `const\\s+${varName}\\s*(?::\\s*\\w+(?:<[^>]*>)?)?\\s*=\\s*(\\{[\\s\\S]*?\\n\\})`,
      )
      const constMatch = constRe.exec(source)
      if (!constMatch) {
        console.error(`warning: could not extract const ${varName}`)
        continue
      }
      try {
        const jsonStr = tsObjectToJson(constMatch[1])
        const level = JSON.parse(jsonStr)
        level._varName = varName
        levels.push(level)
      } catch (e) {
        console.error(`warning: could not parse ${varName}: ${e.message}`)
      }
    }
  } else {
    // Inline object literals in the array — extract each top-level { ... } block
    let pos = 0
    let idx = 0
    while (pos < arrayContent.length) {
      const braceStart = arrayContent.indexOf('{', pos)
      if (braceStart < 0) break
      // Find matching closing brace
      let bd = 1
      let braceEnd = braceStart + 1
      for (let i = braceStart + 1; i < arrayContent.length && bd > 0; i++) {
        if (arrayContent[i] === '{') bd++
        else if (arrayContent[i] === '}') bd--
        if (bd === 0) braceEnd = i
      }
      const objStr = arrayContent.slice(braceStart, braceEnd + 1)
      try {
        const jsonStr = tsObjectToJson(objStr)
        const level = JSON.parse(jsonStr)
        level._varName = `inline_${idx}`
        // Mark fields that were variable references replaced with [] during TS->JSON conversion
        if (Array.isArray(level.notes) && level.notes.length === 0 && /notes:\s*[a-zA-Z_]/.test(objStr)) {
          level._notesUnresolved = true
        }
        if (Array.isArray(level.initialFood) && level.initialFood.length === 0 && /initialFood:\s*[a-zA-Z_]/.test(objStr)) {
          level._foodUnresolved = true
        }
        if (Array.isArray(level.pairs) && level.pairs.length === 0 && /pairs:\s*[a-zA-Z_]/.test(objStr)) {
          level._pairsUnresolved = true
        }
        levels.push(level)
        idx++
      } catch (e) {
        console.error(`warning: could not parse inline object at position ${braceStart}: ${e.message}`)
      }
      pos = braceEnd + 1
    }
  }

  return levels
}

/**
 * Best-effort conversion of a TypeScript object literal to JSON.
 * Handles: single-quoted strings, unquoted keys, trailing commas, comments.
 */
function tsObjectToJson(ts) {
  let s = ts
  // Remove single-line comments
  s = s.replace(/\/\/.*$/gm, '')
  // Remove multi-line comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  // Replace single quotes with double quotes (careful with nested strings)
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
  // Quote unquoted keys: word followed by colon
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":')
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, '$1')
  // Handle readonly arrays (as const)
  s = s.replace(/\bas\s+const\b/g, '')
  // Handle undefined
  s = s.replace(/\bundefined\b/g, 'null')
  // Replace bare variable references used as values (e.g., level1Notes, selectPairs(...))
  // with empty arrays so JSON.parse succeeds for structural validation.
  // Only match when the value is NOT a quoted string (no " before the identifier on the same line segment).
  s = s.replace(/:\s*(?![\"\[])([a-zA-Z_]\w*(?:\([^)]*\))?)\s*([,}])/g, ': []$2')
  // Handle numeric separators (30_000 -> 30000)
  s = s.replace(/(\d)_(\d)/g, '$1$2')
  return s
}

function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: node scripts/validate-arcade.mjs <source-file> <game>')
    console.error('Games: maze, rhythm, defender, snake, memory')
    process.exit(1)
  }

  const [sourceFile, game] = args
  const validator = VALIDATORS[game]
  if (!validator) {
    console.error(`Unknown game: ${game}. Valid games: ${Object.keys(VALIDATORS).join(', ')}`)
    process.exit(1)
  }

  const filePath = resolve(ROOT, sourceFile)
  let source
  try {
    source = readFileSync(filePath, 'utf8')
  } catch (e) {
    console.error(`Could not read ${filePath}: ${e.message}`)
    process.exit(1)
  }

  let levels
  try {
    levels = extractLevels(source, game)
  } catch (e) {
    console.error(`Could not extract levels: ${e.message}`)
    process.exit(1)
  }

  if (levels.length === 0) {
    console.log(`No levels found in ${sourceFile}`)
    process.exit(1)
  }

  console.log(`Validating ${levels.length} ${game} level(s) from ${sourceFile}...\n`)

  let failures = 0
  for (const level of levels) {
    const errors = validator(level)
    const name = level._varName || level.id || '(unknown)'
    if (errors.length === 0) {
      console.log(`  ✓ ${name}`)
    } else {
      console.log(`  ✗ ${name}`)
      for (const err of errors) {
        console.log(`    - ${err}`)
      }
      failures++
    }
  }

  console.log('')
  if (failures === 0) {
    console.log(`All ${levels.length} level(s) passed validation.`)
    process.exit(0)
  } else {
    console.log(`${failures}/${levels.length} level(s) failed validation.`)
    process.exit(1)
  }
}

main()