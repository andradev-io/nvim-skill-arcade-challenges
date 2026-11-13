import type { RhythmLevel } from './types'

/**
 * Helper to generate note events from a pattern string and BPM.
 * Each character in the pattern maps to a lane: h=0, j=1, k=2, l=3.
 * '-' is a rest (no note). Notes are placed one per beat.
 */
function notesFromPattern(pattern: string, bpm: number, startBeat = 0): ReadonlyArray<{ lane: number; timeMs: number }> {
  const msPerBeat = 60_000 / bpm
  const keyMap: Record<string, number> = { h: 0, j: 1, k: 2, l: 3 }
  const notes: Array<{ lane: number; timeMs: number }> = []
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '-' || !(ch in keyMap)) continue
    notes.push({ lane: keyMap[ch], timeMs: Math.round((startBeat + i) * msPerBeat) })
  }
  return notes
}

// Level 1: "First Steps" — 90 BPM, 30s, simple alternating h-j-k-l
const level1Pattern = 'hjkl'.repeat(11) // 44 beats ≈ 29.3s at 90 BPM
const level1Notes = notesFromPattern(level1Pattern, 90, 2)

// Level 2: "Cross Motion" — 100 BPM, 35s, crossing patterns with occasional pairs
const level2Pattern = 'hljk-hlkj-jhkl-lkhj-hjkl-lkjh-hljk-jlhk'
const level2Notes = notesFromPattern(level2Pattern, 100, 2)

// Level 3: "Double Time" — 120 BPM, 40s, faster tempo with denser patterns
const level3Pattern = 'hjklhkjl-jklhhlkj-hjkljklh-hlkjhjkl-jlhkhjlk-hjklhkjl-jklhhlkj-hjkljklh'
const level3Notes = notesFromPattern(level3Pattern, 120, 2)

export const RHYTHM_LEVELS: readonly RhythmLevel[] = [
  {
    id: 'rhythm-basic-1',
    name: 'First Steps',
    bpm: 90,
    durationMs: 30_000,
    laneCount: 4,
    laneKeys: ['h', 'j', 'k', 'l'],
    notes: level1Notes,
    difficulty: 'basic',
  },
  {
    id: 'rhythm-basic-2',
    name: 'Cross Motion',
    bpm: 100,
    durationMs: 35_000,
    laneCount: 4,
    laneKeys: ['h', 'j', 'k', 'l'],
    notes: level2Notes,
    difficulty: 'basic',
  },
  {
    id: 'rhythm-basic-3',
    name: 'Double Time',
    bpm: 120,
    durationMs: 40_000,
    laneCount: 4,
    laneKeys: ['h', 'j', 'k', 'l'],
    notes: level3Notes,
    difficulty: 'basic',
  },
] as const