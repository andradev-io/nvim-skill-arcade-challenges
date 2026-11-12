import { describe, expect, it } from 'vitest'
import { replay } from './replay'
import { stepHarpoonSequence } from './track'
import type { HarpoonConfig } from './types'

describe('harpoon replay', () => {
  const config: HarpoonConfig = {
    slots: {
      a: { text: 'alpha\nbeta', cursor: [1, 0] },
      b: { text: 'gamma\ndelta', cursor: [2, 0] },
    },
    sequence: ['a', 'b'],
  }

  it('add saves current buffer state and jump restores it', () => {
    const sol = ':archoon add a<Esc>:archoon jump b<Esc>'
    const res = replay('start\nline', [1, 0], sol, [], 'text', undefined, config)
    expect(res.text).toBe('gamma\ndelta')
    expect(res.cursor).toEqual([2, 0])
    expect(res.activeSlot).toBe('b')
  })

  it('jump to unsaved slot is unsupported', () => {
    const sol = ':archoon jump c<Esc>'
    const res = replay('x', [1, 0], sol, [], 'text', undefined, config)
    expect(res.unsupported.length).toBeGreaterThan(0)
  })

  it('round-trip add then jump returns to saved state', () => {
    const sol = 'ddiNEW<Esc>:archoon add a<Esc>u:archoon jump a<Esc>'
    const res = replay('original', [1, 0], sol, [], 'text', undefined, config)
    expect(res.text).toBe('NEW')
    expect(res.activeSlot).toBe('a')
  })
})

describe('stepHarpoonSequence', () => {
  it('advances when active slot matches next expected', () => {
    expect(stepHarpoonSequence(['a', 'b', 'c'], 0, 'a')).toBe(1)
    expect(stepHarpoonSequence(['a', 'b', 'c'], 1, 'b')).toBe(2)
  })

  it('does not advance on mismatch', () => {
    expect(stepHarpoonSequence(['a', 'b'], 0, 'b')).toBe(0)
  })

  it('caps at sequence length', () => {
    expect(stepHarpoonSequence(['a'], 1, 'a')).toBe(1)
  })
})