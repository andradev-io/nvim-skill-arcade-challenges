// Unit tests for arcade-lib.mjs — uses Node.js built-in test runner (node:test) and assert.
// Run: node scripts/arcade-lib.test.mjs

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeMazeLevel,
  sanitizeRhythmLevel,
  sanitizeDefenderWave,
  sanitizeSnakeLevel,
  sanitizeMemoryLevel,
  validateMazePlayability,
  validateRhythmPlayability,
  validateDefenderPlayability,
  validateSnakePlayability,
  validateMemoryPlayability,
  serializeToTypeScript,
  generateCampaignStage,
} from './arcade-lib.mjs'

const meta = { date: '2026-11-16', index: 0 }

// ── maze sanitizer ──────────────────────────────────────────────────────────

describe('sanitizeMazeLevel', () => {
  const validMaze = {
    name: 'Test Maze',
    width: 8,
    height: 6,
    grid: [
      ['start', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
      ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
      ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
    ],
    doors: [],
    markers: {},
    parSeconds: 30,
    parMotions: 4,
  }

  it('accepts a valid maze level', () => {
    const result = sanitizeMazeLevel(validMaze, meta)
    assert.ok(result.level, 'should return { level }')
    assert.equal(result.level.name, 'Test Maze')
    assert.equal(result.level.width, 8)
    assert.equal(result.level.height, 6)
  })

  it('assigns deterministic ID when missing', () => {
    const result = sanitizeMazeLevel(validMaze, meta)
    assert.equal(result.level.id, 'maze-20261116-0')
  })

  it('rejects non-object input', () => {
    assert.equal(sanitizeMazeLevel(null, meta).error, 'not an object')
    assert.equal(sanitizeMazeLevel('string', meta).error, 'not an object')
  })

  it('rejects missing name', () => {
    const bad = { ...validMaze, name: '' }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('name'))
  })

  it('rejects name over 40 chars', () => {
    const bad = { ...validMaze, name: 'A'.repeat(41) }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('name'))
  })

  it('rejects width out of range', () => {
    assert.ok(sanitizeMazeLevel({ ...validMaze, width: 7 }, meta).error?.includes('width'))
    assert.ok(sanitizeMazeLevel({ ...validMaze, width: 21 }, meta).error?.includes('width'))
  })

  it('rejects height out of range', () => {
    assert.ok(sanitizeMazeLevel({ ...validMaze, height: 5 }, meta).error?.includes('height'))
    assert.ok(sanitizeMazeLevel({ ...validMaze, height: 17 }, meta).error?.includes('height'))
  })

  it('rejects grid with wrong row count', () => {
    const bad = { ...validMaze, grid: validMaze.grid.slice(0, 5) }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('rows'))
  })

  it('rejects grid with invalid cell type', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[0][1] = 'invalid'
    assert.ok(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error?.includes('cell type'))
  })

  it('rejects grid without exactly one start', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[0][0] = 'open'
    assert.ok(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error?.includes('start'))
  })

  it('rejects grid without exactly one goal', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[5][6] = 'open'
    assert.ok(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error?.includes('goal'))
  })

  it('rejects door out of bounds', () => {
    const bad = { ...validMaze, doors: [{ row: 10, col: 0, requiredMotion: 'w' }] }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('out of bounds'))
  })

  it('rejects marker with bad key format', () => {
    const bad = { ...validMaze, markers: { 'bad': 'a' } }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('row,col'))
  })

  it('rejects more than 2 hints', () => {
    const bad = { ...validMaze, hints: ['a', 'b', 'c'] }
    assert.ok(sanitizeMazeLevel(bad, meta).error?.includes('at most 2'))
  })

  it('accepts optional hints', () => {
    const withHints = { ...validMaze, hints: ['Use hjkl to move.'] }
    const result = sanitizeMazeLevel(withHints, meta)
    assert.ok(result.level)
    assert.deepEqual(result.level.hints, ['Use hjkl to move.'])
  })
})

// ── rhythm sanitizer ────────────────────────────────────────────────────────

describe('sanitizeRhythmLevel', () => {
  const validRhythm = {
    name: 'Test Rhythm',
    bpm: 90,
    durationMs: 30000,
    laneCount: 4,
    laneKeys: ['h', 'j', 'k', 'l'],
    notes: [
      { lane: 0, timeMs: 1000 },
      { lane: 1, timeMs: 2000 },
      { lane: 2, timeMs: 3000 },
      { lane: 3, timeMs: 4000 },
    ],
    difficulty: 'basic',
  }

  it('accepts a valid rhythm level', () => {
    const result = sanitizeRhythmLevel(validRhythm, meta)
    assert.ok(result.level)
    assert.equal(result.level.bpm, 90)
    assert.equal(result.level.notes.length, 4)
  })

  it('expands pattern string into notes', () => {
    const withPattern = { ...validRhythm, pattern: 'hjkl', notes: undefined }
    const result = sanitizeRhythmLevel(withPattern, meta)
    assert.ok(result.level)
    assert.equal(result.level.notes.length, 4)
    assert.equal(result.level.notes[0].lane, 0) // h
    assert.equal(result.level.notes[1].lane, 1) // j
  })

  it('rejects bpm out of range', () => {
    assert.ok(sanitizeRhythmLevel({ ...validRhythm, bpm: 69 }, meta).error?.includes('bpm'))
    assert.ok(sanitizeRhythmLevel({ ...validRhythm, bpm: 161 }, meta).error?.includes('bpm'))
  })

  it('rejects mismatched laneKeys length', () => {
    const bad = { ...validRhythm, laneKeys: ['h', 'j'] }
    assert.ok(sanitizeRhythmLevel(bad, meta).error?.includes('laneKeys'))
  })

  it('rejects notes in same lane within 200ms', () => {
    const bad = {
      ...validRhythm,
      notes: [
        { lane: 0, timeMs: 1000 },
        { lane: 0, timeMs: 1100 },
      ],
    }
    assert.ok(sanitizeRhythmLevel(bad, meta).error?.includes('200ms'))
  })

  it('rejects invalid difficulty', () => {
    assert.ok(sanitizeRhythmLevel({ ...validRhythm, difficulty: 'extreme' }, meta).error?.includes('difficulty'))
  })

  it('rejects note out of duration bounds', () => {
    const bad = {
      ...validRhythm,
      notes: [{ lane: 0, timeMs: 35000 }],
    }
    assert.ok(sanitizeRhythmLevel(bad, meta).error?.includes('timeMs'))
  })
})

// ── defender sanitizer ──────────────────────────────────────────────────────

describe('sanitizeDefenderWave', () => {
  const validDefender = {
    wave: 1,
    commands: ['h', 'j', 'k', 'l'],
    enemyCount: 8,
    spawnIntervalMs: 2500,
    baseSpeed: 30,
    speedVariance: 10,
  }

  it('accepts a valid defender wave', () => {
    const result = sanitizeDefenderWave(validDefender, meta)
    assert.ok(result.level)
    assert.equal(result.level.wave, 1)
  })

  it('rejects empty commands', () => {
    assert.ok(sanitizeDefenderWave({ ...validDefender, commands: [] }, meta).error?.includes('commands'))
  })

  it('rejects enemyCount out of range', () => {
    assert.ok(sanitizeDefenderWave({ ...validDefender, enemyCount: 5 }, meta).error?.includes('enemyCount'))
    assert.ok(sanitizeDefenderWave({ ...validDefender, enemyCount: 31 }, meta).error?.includes('enemyCount'))
  })

  it('rejects speedVariance exceeding 40% of baseSpeed', () => {
    assert.ok(sanitizeDefenderWave({ ...validDefender, speedVariance: 13 }, meta).error?.includes('speedVariance'))
  })

  it('rejects non-positive wave number', () => {
    assert.ok(sanitizeDefenderWave({ ...validDefender, wave: 0 }, meta).error?.includes('wave'))
  })
})

// ── snake sanitizer ─────────────────────────────────────────────────────────

describe('sanitizeSnakeLevel', () => {
  const validSnake = {
    name: 'Test Snake',
    width: 10,
    height: 8,
    walls: [],
    initialFood: [
      { position: { row: 3, col: 5 }, label: 'dd', tip: 'Delete line', points: 10 },
    ],
    spawnRate: 5000,
    baseSpeed: 300,
    speedIncreasePerFood: 10,
    parFoods: 5,
    parTime: 60,
    allowWordMotions: false,
  }

  it('accepts a valid snake level', () => {
    const result = sanitizeSnakeLevel(validSnake, meta)
    assert.ok(result.level)
    assert.equal(result.level.name, 'Test Snake')
  })

  it('rejects food on wall', () => {
    const bad = {
      ...validSnake,
      walls: [{ row: 3, col: 5 }],
    }
    assert.ok(sanitizeSnakeLevel(bad, meta).error?.includes('on a wall'))
  })

  it('rejects duplicate wall positions', () => {
    const bad = {
      ...validSnake,
      walls: [{ row: 0, col: 0 }, { row: 0, col: 0 }],
    }
    assert.ok(sanitizeSnakeLevel(bad, meta).error?.includes('duplicate wall'))
  })

  it('rejects duplicate food positions', () => {
    const bad = {
      ...validSnake,
      initialFood: [
        { position: { row: 3, col: 5 }, label: 'dd', tip: 'Delete', points: 10 },
        { position: { row: 3, col: 5 }, label: 'yy', tip: 'Yank', points: 10 },
      ],
    }
    assert.ok(sanitizeSnakeLevel(bad, meta).error?.includes('duplicate food'))
  })

  it('rejects missing allowWordMotions', () => {
    const bad = { ...validSnake }
    delete bad.allowWordMotions
    assert.ok(sanitizeSnakeLevel(bad, meta).error?.includes('allowWordMotions'))
  })

  it('rejects spawnRate out of range', () => {
    assert.ok(sanitizeSnakeLevel({ ...validSnake, spawnRate: 400 }, meta).error?.includes('spawnRate'))
    assert.ok(sanitizeSnakeLevel({ ...validSnake, spawnRate: 6000 }, meta).error?.includes('spawnRate'))
  })
})

// ── memory sanitizer ────────────────────────────────────────────────────────

describe('sanitizeMemoryLevel', () => {
  const validMemory = {
    name: 'Test Memory',
    pairs: [
      { id: 'p1', command: 'h', description: 'Move left', category: 'motion' },
      { id: 'p2', command: 'j', description: 'Move down', category: 'motion' },
      { id: 'p3', command: 'k', description: 'Move up', category: 'motion' },
    ],
    gridCols: 3,
    gridRows: 2,
    parTime: 30,
    parMoves: 6,
  }

  it('accepts a valid memory level', () => {
    const result = sanitizeMemoryLevel(validMemory, meta)
    assert.ok(result.level)
    assert.equal(result.level.pairs.length, 3)
  })

  it('rejects duplicate pair IDs', () => {
    const bad = {
      ...validMemory,
      pairs: [
        { id: 'p1', command: 'h', description: 'Move left', category: 'motion' },
        { id: 'p1', command: 'j', description: 'Move down', category: 'motion' },
        { id: 'p2', command: 'k', description: 'Move up', category: 'motion' },
      ],
    }
    assert.ok(sanitizeMemoryLevel(bad, meta).error?.includes('duplicate pair id'))
  })

  it('rejects grid size mismatch', () => {
    const bad = { ...validMemory, gridCols: 4 }
    assert.ok(sanitizeMemoryLevel(bad, meta).error?.includes('gridCols*gridRows'))
  })

  it('rejects parMoves less than pairs.length', () => {
    const bad = { ...validMemory, parMoves: 2 }
    assert.ok(sanitizeMemoryLevel(bad, meta).error?.includes('parMoves'))
  })

  it('rejects invalid category', () => {
    const bad = {
      ...validMemory,
      pairs: [
        { id: 'p1', command: 'h', description: 'Move left', category: 'invalid' },
        { id: 'p2', command: 'j', description: 'Move down', category: 'motion' },
        { id: 'p3', command: 'k', description: 'Move up', category: 'motion' },
      ],
    }
    assert.ok(sanitizeMemoryLevel(bad, meta).error?.includes('category'))
  })
})

// ── playability validators ──────────────────────────────────────────────────

describe('validateMazePlayability', () => {
  it('passes for a solvable maze', () => {
    const level = {
      width: 8, height: 6,
      grid: [
        ['start', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'collectible', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
      ],
      doors: [],
      markers: {},
    }
    const errors = validateMazePlayability(level)
    assert.equal(errors.length, 0, `unexpected errors: ${errors.join(', ')}`)
  })

  it('fails when goal is unreachable', () => {
    const level = {
      width: 8, height: 6,
      grid: [
        ['start', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
      ],
      doors: [],
      markers: {},
    }
    const errors = validateMazePlayability(level)
    assert.ok(errors.some((e) => e.includes('not reachable')))
  })

  it('fails when collectible is unreachable', () => {
    const level = {
      width: 8, height: 6,
      grid: [
        ['start', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'collectible', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'wall', 'open', 'open', 'open', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
      ],
      doors: [],
      markers: {},
    }
    const errors = validateMazePlayability(level)
    assert.ok(errors.some((e) => e.includes('collectible') && e.includes('not reachable')))
  })

  it('fails when door references missing marker', () => {
    const level = {
      width: 8, height: 6,
      grid: [
        ['start', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'door', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
      ],
      doors: [{ row: 2, col: 5, requiredMotion: 'fz' }],
      markers: {},
    }
    const errors = validateMazePlayability(level)
    assert.ok(errors.some((e) => e.includes('marker')))
  })
})

describe('validateRhythmPlayability', () => {
  it('passes for a valid rhythm level', () => {
    const level = {
      notes: [{ lane: 0, timeMs: 1000 }, { lane: 1, timeMs: 2000 }],
      durationMs: 30000,
      laneKeys: ['h', 'j', 'k', 'l'],
      laneCount: 4,
    }
    assert.equal(validateRhythmPlayability(level).length, 0)
  })

  it('fails with no notes', () => {
    const level = { notes: [], durationMs: 30000, laneKeys: ['h', 'j', 'k', 'l'], laneCount: 4 }
    assert.ok(validateRhythmPlayability(level).some((e) => e.includes('note')))
  })

  it('fails with notes too close in same lane', () => {
    const level = {
      notes: [{ lane: 0, timeMs: 1000 }, { lane: 0, timeMs: 1100 }],
      durationMs: 30000,
      laneKeys: ['h', 'j', 'k', 'l'],
      laneCount: 4,
    }
    assert.ok(validateRhythmPlayability(level).some((e) => e.includes('200ms')))
  })
})

describe('validateDefenderPlayability', () => {
  it('passes for a valid defender wave', () => {
    const level = { commands: ['h', 'j'], enemyCount: 8, spawnIntervalMs: 2500, baseSpeed: 30, speedVariance: 10 }
    assert.equal(validateDefenderPlayability(level).length, 0)
  })

  it('fails with empty commands', () => {
    const level = { commands: [], enemyCount: 8, spawnIntervalMs: 2500, baseSpeed: 30, speedVariance: 10 }
    assert.ok(validateDefenderPlayability(level).some((e) => e.includes('commands')))
  })
})

describe('validateSnakePlayability', () => {
  it('passes for a connected open grid', () => {
    const level = {
      width: 10, height: 8, walls: [],
      initialFood: [{ position: { row: 3, col: 5 }, label: 'dd', tip: 'Delete', points: 10 }],
    }
    assert.equal(validateSnakePlayability(level).length, 0)
  })

  it('fails when open cells are disconnected', () => {
    // Create a wall that splits the grid
    const walls = []
    for (let r = 0; r < 8; r++) walls.push({ row: r, col: 4 })
    const level = {
      width: 10, height: 8, walls,
      initialFood: [{ position: { row: 0, col: 0 }, label: 'dd', tip: 'Delete', points: 10 }],
    }
    const errors = validateSnakePlayability(level)
    assert.ok(errors.some((e) => e.includes('connected')))
  })

  it('fails with no food', () => {
    const level = { width: 10, height: 8, walls: [], initialFood: [] }
    assert.ok(validateSnakePlayability(level).some((e) => e.includes('food')))
  })
})

describe('validateMemoryPlayability', () => {
  it('passes for a valid memory level', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      gridCols: 3, gridRows: 2, parMoves: 6,
    }
    assert.equal(validateMemoryPlayability(level).length, 0)
  })

  it('fails with grid size mismatch', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      gridCols: 4, gridRows: 2, parMoves: 6,
    }
    assert.ok(validateMemoryPlayability(level).some((e) => e.includes('gridCols')))
  })

  it('fails with duplicate pair IDs', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p1' }, { id: 'p2' }],
      gridCols: 3, gridRows: 2, parMoves: 6,
    }
    assert.ok(validateMemoryPlayability(level).some((e) => e.includes('duplicate')))
  })
})

// ── serializer ──────────────────────────────────────────────────────────────

describe('serializeToTypeScript', () => {
  it('produces valid TypeScript for a maze level', () => {
    const level = {
      id: 'maze-test',
      name: 'Test',
      width: 8,
      height: 6,
      grid: [
        ['start', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal', 'wall'],
      ],
      doors: [],
      markers: {},
      parSeconds: 30,
      parMotions: 4,
    }
    const { code, varName } = serializeToTypeScript(level, 'maze')
    assert.ok(code.includes('// Generated by arcade phase pipeline'))
    assert.ok(code.includes(`const ${varName}: MazeLevel`))
    assert.ok(code.includes("id: 'maze-test'"))
    assert.ok(code.includes('width: 8'))
  })

  it('produces valid TypeScript for a rhythm level', () => {
    const level = {
      id: 'rhythm-test',
      name: 'Test',
      bpm: 90,
      durationMs: 30000,
      laneCount: 4,
      laneKeys: ['h', 'j', 'k', 'l'],
      notes: [{ lane: 0, timeMs: 1000 }],
      difficulty: 'basic',
    }
    const { code } = serializeToTypeScript(level, 'rhythm')
    assert.ok(code.includes('RhythmLevel'))
    assert.ok(code.includes('bpm: 90'))
  })

  it('produces valid TypeScript for a defender wave', () => {
    const level = {
      wave: 1,
      commands: ['h', 'j', 'k', 'l'],
      enemyCount: 8,
      spawnIntervalMs: 2500,
      baseSpeed: 30,
      speedVariance: 10,
    }
    const { code } = serializeToTypeScript(level, 'defender')
    assert.ok(code.includes('WaveConfig'))
    assert.ok(code.includes('wave: 1'))
  })

  it('throws for unknown game', () => {
    assert.throws(() => serializeToTypeScript({}, 'chess'), /unknown game/)
  })
})

// ── campaign stage generator ────────────────────────────────────────────────

describe('generateCampaignStage', () => {
  it('produces correct structure for first stage', () => {
    const level = { name: 'Test Level' }
    const stage = generateCampaignStage(level, 'maze', [], 'easy')
    assert.equal(stage.gameId, 'maze')
    assert.equal(stage.levelIndex, 0)
    assert.equal(stage.chapter, 1)
    assert.equal(stage.unlockCondition.type, 'initial')
    assert.equal(stage.starThresholds.metric, 'parRatio')
  })

  it('chains unlock after previous game stage', () => {
    const existing = [
      { id: 'ch1-maze-l0', gameId: 'maze', levelIndex: 0 },
    ]
    const level = { name: 'Second Level' }
    const stage = generateCampaignStage(level, 'maze', existing, 'medium')
    assert.equal(stage.levelIndex, 1)
    assert.equal(stage.unlockCondition.type, 'completePrevious')
    assert.equal(stage.unlockCondition.previousStageId, 'ch1-maze-l0')
  })

  it('increments chapter every 5 stages', () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({
      id: `ch1-maze-l${i}`, gameId: 'maze', levelIndex: i,
    }))
    const stage = generateCampaignStage({ name: 'Ch2 Start' }, 'rhythm', existing, 'easy')
    assert.equal(stage.chapter, 2)
  })

  it('uses correct metric per game', () => {
    const rhythmStage = generateCampaignStage({ name: 'R' }, 'rhythm', [], 'easy')
    assert.equal(rhythmStage.starThresholds.metric, 'accuracy')

    const defenderStage = generateCampaignStage({ name: 'D' }, 'defender', [], 'easy')
    assert.equal(defenderStage.starThresholds.metric, 'score')
  })
})