// Unit tests for arcade-lib.mjs — uses Vitest (matches daily-lib.test.mjs pattern).
// Run: npx vitest run scripts/arcade-lib.test.mjs

import { describe, expect, it } from 'vitest'
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
    expect(result.level).toBeTruthy() // should return { level }
    expect(result.level.name).toBe('Test Maze')
    expect(result.level.width).toBe(8)
    expect(result.level.height).toBe(6)
  })

  it('assigns deterministic ID when missing', () => {
    const result = sanitizeMazeLevel(validMaze, meta)
    expect(result.level.id).toBe('maze-20261116-0')
  })

  it('rejects non-object input', () => {
    expect(sanitizeMazeLevel(null, meta).error).toBe('not an object')
    expect(sanitizeMazeLevel('string', meta).error).toBe('not an object')
  })

  it('rejects missing name', () => {
    const bad = { ...validMaze, name: '' }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'name'
  })

  it('rejects name over 40 chars', () => {
    const bad = { ...validMaze, name: 'A'.repeat(41) }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'name'
  })

  it('rejects width out of range', () => {
    expect(sanitizeMazeLevel({ ...validMaze, width: 7 }, meta).error).toBeTruthy() // includes 'width'
    expect(sanitizeMazeLevel({ ...validMaze, width: 21 }, meta).error).toBeTruthy() // includes 'width'
  })

  it('rejects height out of range', () => {
    expect(sanitizeMazeLevel({ ...validMaze, height: 5 }, meta).error).toBeTruthy() // includes 'height'
    expect(sanitizeMazeLevel({ ...validMaze, height: 17 }, meta).error).toBeTruthy() // includes 'height'
  })

  it('rejects grid with wrong row count', () => {
    const bad = { ...validMaze, grid: validMaze.grid.slice(0, 5) }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'rows'
  })

  it('rejects grid with invalid cell type', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[0][1] = 'invalid'
    expect(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error).toBeTruthy() // includes 'cell type'
  })

  it('rejects grid without exactly one start', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[0][0] = 'open'
    expect(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error).toBeTruthy() // includes 'start'
  })

  it('rejects grid without exactly one goal', () => {
    const badGrid = validMaze.grid.map((r) => [...r])
    badGrid[5][6] = 'open'
    expect(sanitizeMazeLevel({ ...validMaze, grid: badGrid }, meta).error).toBeTruthy() // includes 'goal'
  })

  it('rejects door out of bounds', () => {
    const bad = { ...validMaze, doors: [{ row: 10, col: 0, requiredMotion: 'w' }] }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'out of bounds'
  })

  it('rejects marker with bad key format', () => {
    const bad = { ...validMaze, markers: { 'bad': 'a' } }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'row,col'
  })

  it('rejects more than 2 hints', () => {
    const bad = { ...validMaze, hints: ['a', 'b', 'c'] }
    expect(sanitizeMazeLevel(bad, meta).error).toBeTruthy() // includes 'at most 2'
  })

  it('accepts optional hints', () => {
    const withHints = { ...validMaze, hints: ['Use hjkl to move.'] }
    const result = sanitizeMazeLevel(withHints, meta)
    expect(result.level).toBeTruthy()
    expect(result.level.hints).toEqual(['Use hjkl to move.'])
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
    expect(result.level).toBeTruthy()
    expect(result.level.bpm).toBe(90)
    expect(result.level.notes.length).toBe(4)
  })

  it('expands pattern string into notes', () => {
    const withPattern = { ...validRhythm, pattern: 'hjkl', notes: undefined }
    const result = sanitizeRhythmLevel(withPattern, meta)
    expect(result.level).toBeTruthy()
    expect(result.level.notes.length).toBe(4)
    expect(result.level.notes[0].lane).toBe(0) // h
    expect(result.level.notes[1].lane).toBe(1) // j
  })

  it('rejects bpm out of range', () => {
    expect(sanitizeRhythmLevel({ ...validRhythm, bpm: 69 }, meta).error).toBeTruthy() // includes 'bpm'
    expect(sanitizeRhythmLevel({ ...validRhythm, bpm: 161 }, meta).error).toBeTruthy() // includes 'bpm'
  })

  it('rejects mismatched laneKeys length', () => {
    const bad = { ...validRhythm, laneKeys: ['h', 'j'] }
    expect(sanitizeRhythmLevel(bad, meta).error).toBeTruthy() // includes 'laneKeys'
  })

  it('rejects notes in same lane within 200ms', () => {
    const bad = {
      ...validRhythm,
      notes: [
        { lane: 0, timeMs: 1000 },
        { lane: 0, timeMs: 1100 },
      ],
    }
    expect(sanitizeRhythmLevel(bad, meta).error).toBeTruthy() // includes '200ms'
  })

  it('rejects invalid difficulty', () => {
    expect(sanitizeRhythmLevel({ ...validRhythm, difficulty: 'extreme' }, meta).error).toBeTruthy() // includes 'difficulty'
  })

  it('rejects note out of duration bounds', () => {
    const bad = {
      ...validRhythm,
      notes: [{ lane: 0, timeMs: 35000 }],
    }
    expect(sanitizeRhythmLevel(bad, meta).error).toBeTruthy() // includes 'timeMs'
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
    expect(result.level).toBeTruthy()
    expect(result.level.wave).toBe(1)
  })

  it('rejects empty commands', () => {
    expect(sanitizeDefenderWave({ ...validDefender, commands: [] }, meta).error).toBeTruthy() // includes 'commands'
  })

  it('rejects enemyCount out of range', () => {
    expect(sanitizeDefenderWave({ ...validDefender, enemyCount: 5 }, meta).error).toBeTruthy() // includes 'enemyCount'
    expect(sanitizeDefenderWave({ ...validDefender, enemyCount: 31 }, meta).error).toBeTruthy() // includes 'enemyCount'
  })

  it('rejects speedVariance exceeding 40% of baseSpeed', () => {
    expect(sanitizeDefenderWave({ ...validDefender, speedVariance: 13 }, meta).error).toBeTruthy() // includes 'speedVariance'
  })

  it('rejects non-positive wave number', () => {
    expect(sanitizeDefenderWave({ ...validDefender, wave: 0 }, meta).error).toBeTruthy() // includes 'wave'
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
    expect(result.level).toBeTruthy()
    expect(result.level.name).toBe('Test Snake')
  })

  it('rejects food on wall', () => {
    const bad = {
      ...validSnake,
      walls: [{ row: 3, col: 5 }],
    }
    expect(sanitizeSnakeLevel(bad, meta).error).toBeTruthy() // includes 'on a wall'
  })

  it('rejects duplicate wall positions', () => {
    const bad = {
      ...validSnake,
      walls: [{ row: 0, col: 0 }, { row: 0, col: 0 }],
    }
    expect(sanitizeSnakeLevel(bad, meta).error).toBeTruthy() // includes 'duplicate wall'
  })

  it('rejects duplicate food positions', () => {
    const bad = {
      ...validSnake,
      initialFood: [
        { position: { row: 3, col: 5 }, label: 'dd', tip: 'Delete', points: 10 },
        { position: { row: 3, col: 5 }, label: 'yy', tip: 'Yank', points: 10 },
      ],
    }
    expect(sanitizeSnakeLevel(bad, meta).error).toBeTruthy() // includes 'duplicate food'
  })

  it('rejects missing allowWordMotions', () => {
    const bad = { ...validSnake }
    delete bad.allowWordMotions
    expect(sanitizeSnakeLevel(bad, meta).error).toBeTruthy() // includes 'allowWordMotions'
  })

  it('rejects spawnRate out of range', () => {
    expect(sanitizeSnakeLevel({ ...validSnake, spawnRate: 400 }, meta).error).toBeTruthy() // includes 'spawnRate'
    expect(sanitizeSnakeLevel({ ...validSnake, spawnRate: 6000 }, meta).error).toBeTruthy() // includes 'spawnRate'
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
    expect(result.level).toBeTruthy()
    expect(result.level.pairs.length).toBe(3)
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
    expect(sanitizeMemoryLevel(bad, meta).error).toBeTruthy() // includes 'duplicate pair id'
  })

  it('rejects grid size mismatch', () => {
    const bad = { ...validMemory, gridCols: 4 }
    expect(sanitizeMemoryLevel(bad, meta).error).toBeTruthy() // includes 'gridCols*gridRows'
  })

  it('rejects parMoves less than pairs.length', () => {
    const bad = { ...validMemory, parMoves: 2 }
    expect(sanitizeMemoryLevel(bad, meta).error).toBeTruthy() // includes 'parMoves'
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
    expect(sanitizeMemoryLevel(bad, meta).error).toBeTruthy() // includes 'category'
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
    expect(errors.length).toBe(0) // no unexpected playability errors
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
    expect(errors.some((e) => e.includes('not reachable'))).toBeTruthy()
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
    expect(errors.some((e) => e.includes('collectible') && e.includes('not reachable'))).toBeTruthy()
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
    expect(errors.some((e) => e.includes('marker'))).toBeTruthy()
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
    expect(validateRhythmPlayability(level).length).toBe(0)
  })

  it('fails with no notes', () => {
    const level = { notes: [], durationMs: 30000, laneKeys: ['h', 'j', 'k', 'l'], laneCount: 4 }
    expect(validateRhythmPlayability(level).toBeTruthy().some((e) => e.includes('note')))
  })

  it('fails with notes too close in same lane', () => {
    const level = {
      notes: [{ lane: 0, timeMs: 1000 }, { lane: 0, timeMs: 1100 }],
      durationMs: 30000,
      laneKeys: ['h', 'j', 'k', 'l'],
      laneCount: 4,
    }
    expect(validateRhythmPlayability(level).toBeTruthy().some((e) => e.includes('200ms')))
  })
})

describe('validateDefenderPlayability', () => {
  it('passes for a valid defender wave', () => {
    const level = { commands: ['h', 'j'], enemyCount: 8, spawnIntervalMs: 2500, baseSpeed: 30, speedVariance: 10 }
    expect(validateDefenderPlayability(level).length).toBe(0)
  })

  it('fails with empty commands', () => {
    const level = { commands: [], enemyCount: 8, spawnIntervalMs: 2500, baseSpeed: 30, speedVariance: 10 }
    expect(validateDefenderPlayability(level).toBeTruthy().some((e) => e.includes('commands')))
  })
})

describe('validateSnakePlayability', () => {
  it('passes for a connected open grid', () => {
    const level = {
      width: 10, height: 8, walls: [],
      initialFood: [{ position: { row: 3, col: 5 }, label: 'dd', tip: 'Delete', points: 10 }],
    }
    expect(validateSnakePlayability(level).length).toBe(0)
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
    expect(errors.some((e) => e.includes('connected'))).toBeTruthy()
  })

  it('fails with no food', () => {
    const level = { width: 10, height: 8, walls: [], initialFood: [] }
    expect(validateSnakePlayability(level).toBeTruthy().some((e) => e.includes('food')))
  })
})

describe('validateMemoryPlayability', () => {
  it('passes for a valid memory level', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      gridCols: 3, gridRows: 2, parMoves: 6,
    }
    expect(validateMemoryPlayability(level).length).toBe(0)
  })

  it('fails with grid size mismatch', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      gridCols: 4, gridRows: 2, parMoves: 6,
    }
    expect(validateMemoryPlayability(level).toBeTruthy().some((e) => e.includes('gridCols')))
  })

  it('fails with duplicate pair IDs', () => {
    const level = {
      pairs: [{ id: 'p1' }, { id: 'p1' }, { id: 'p2' }],
      gridCols: 3, gridRows: 2, parMoves: 6,
    }
    expect(validateMemoryPlayability(level).toBeTruthy().some((e) => e.includes('duplicate')))
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
    expect(code.includes('// Generated by arcade phase pipeline').toBeTruthy())
    expect(code.includes(`const ${varName}: MazeLevel`).toBeTruthy())
    expect(code.includes("id: 'maze-test'").toBeTruthy())
    expect(code.includes('width: 8').toBeTruthy())
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
    expect(code.includes('RhythmLevel').toBeTruthy())
    expect(code.includes('bpm: 90').toBeTruthy())
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
    expect(code.includes('WaveConfig').toBeTruthy())
    expect(code.includes('wave: 1').toBeTruthy())
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
    expect(stage.gameId).toBe('maze')
    expect(stage.levelIndex).toBe(0)
    expect(stage.chapter).toBe(1)
    expect(stage.unlockCondition.type).toBe('initial')
    expect(stage.starThresholds.metric).toBe('parRatio')
  })

  it('chains unlock after previous game stage', () => {
    const existing = [
      { id: 'ch1-maze-l0', gameId: 'maze', levelIndex: 0 },
    ]
    const level = { name: 'Second Level' }
    const stage = generateCampaignStage(level, 'maze', existing, 'medium')
    expect(stage.levelIndex).toBe(1)
    expect(stage.unlockCondition.type).toBe('completePrevious')
    expect(stage.unlockCondition.previousStageId).toBe('ch1-maze-l0')
  })

  it('increments chapter every 5 stages', () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({
      id: `ch1-maze-l${i}`, gameId: 'maze', levelIndex: i,
    }))
    const stage = generateCampaignStage({ name: 'Ch2 Start' }, 'rhythm', existing, 'easy')
    expect(stage.chapter).toBe(2)
  })

  it('uses correct metric per game', () => {
    const rhythmStage = generateCampaignStage({ name: 'R' }, 'rhythm', [], 'easy')
    expect(rhythmStage.starThresholds.metric).toBe('accuracy')

    const defenderStage = generateCampaignStage({ name: 'D' }, 'defender', [], 'easy')
    expect(defenderStage.starThresholds.metric).toBe('score')
  })
})