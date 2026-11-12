import { describe, expect, it } from 'vitest'
import type { BuiltinChallenge } from './builtin'
import { efficiency, filterCommands, firstKey, fuzzyScore, hintSteps, lineDiff, nextChallenge, orderedBuiltin, pendingText, resultText, stars } from './terminalUx'

const mk = (id: string, area: string, level: number): BuiltinChallenge => ({ id, area, level, title: id, ft: 'text', text: 'a', cursor: [1, 0], brief: '' })
const list = [mk('editing.b', 'editing', 2), mk('motion.a', 'motion', 1), mk('editing.a', 'editing', 1), mk('motion.b', 'motion', 3)]

describe('next challenge', () => {
  it('orders like the picker: areas as they appear, easiest first', () => {
    expect(orderedBuiltin(list).map((c) => c.id)).toEqual(['editing.a', 'editing.b', 'motion.a', 'motion.b'])
  })
  it('steps to the next one, null at the end or for an unknown id', () => {
    expect(nextChallenge(list, 'editing.a')?.id).toBe('editing.b')
    expect(nextChallenge(list, 'editing.b')?.id).toBe('motion.a')
    expect(nextChallenge(list, 'motion.b')).toBeNull()
    expect(nextChallenge(list, 'nope')).toBeNull()
  })
})

describe('rating', () => {
  it('stars from keys against par', () => {
    expect(stars(5, 5)).toBe(3)
    expect(stars(7, 5)).toBe(2)
    expect(stars(8, 5)).toBe(2)
    expect(stars(9, 5)).toBe(1)
    expect(stars(5, undefined)).toBe(0)
  })
  it('efficiency is capped at 100', () => {
    expect(efficiency(4, 8)).toBe(100)
    expect(efficiency(10, 5)).toBe(50)
    expect(efficiency(10, undefined)).toBe(0)
  })
  it('result text has keys, par, stars and hints', () => {
    const t = resultText({ title: 'Delete word', area: 'editing' }, 4, 3.25, 5, 2, 'https://x/#/terminal')
    expect(t).toContain('Delete word (editing)')
    expect(t).toContain('4 keys in 3.3s, par 5 ***, 2 hints')
    expect(t.endsWith('https://x/#/terminal')).toBe(true)
    expect(resultText({ title: 't', area: 'a' }, 4, 1, undefined, 0, 'u')).toContain('4 keys in 1.0s\n')
  })
})

describe('hints', () => {
  it('finds the first key of a solution', () => {
    expect(firstKey('ciwfoo<Esc>')).toBe('c')
    expect(firstKey('2dd')).toBe('2d')
    expect(firstKey('<C-v>jj')).toBe('<C-v>')
    expect(firstKey('  ')).toBeNull()
  })
  it('reveals area, kind, then first key', () => {
    const h = hintSteps({ area: 'editing', solution: 'ciwx<Esc>' })
    expect(h).toHaveLength(3)
    expect(h[0]).toMatch(/Editing/)
    expect(h[1]).toMatch(/change operator/)
    expect(h[2]).toBe('Start with `c`.')
  })
  it('gives only the area hint without a solution, and a generic one for unknown areas', () => {
    expect(hintSteps({ area: 'zzz' })).toHaveLength(1)
    expect(hintSteps({ area: 'zzz' })[0]).toMatch(/least keys/)
  })
})

describe('line diff', () => {
  it('marks wanted-but-missing lines and unwanted ones', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'del', text: 'b' },
      { kind: 'add', text: 'x' },
      { kind: 'same', text: 'c' },
    ])
  })
  it('ignores trailing spaces, and indentation when loose', () => {
    expect(lineDiff('a  \nb', 'a\nb').every((r) => r.kind === 'same')).toBe(true)
    expect(lineDiff('  a', 'a').every((r) => r.kind === 'same')).toBe(false)
    expect(lineDiff('  a', 'a', true).every((r) => r.kind === 'same')).toBe(true)
  })
  it('handles a missing or extra tail', () => {
    expect(lineDiff('a', 'a\nb').map((r) => r.kind)).toEqual(['same', 'add'])
    expect(lineDiff('a\nb', 'a').map((r) => r.kind)).toEqual(['same', 'del'])
  })
})

describe('pending keys', () => {
  it('writes register, counts, operator and buffered keys', () => {
    expect(pendingText({ registerName: 'a', prefixRepeat: ['2'], operator: 'd', motionRepeat: ['3'], keyBuffer: ['i'] })).toBe('"a2d3i')
    expect(pendingText({ prefixRepeat: ['2'], operator: 'delete' })).toBe('2d')
    expect(pendingText({ operator: 'uppercase' })).toBe('gU')
    expect(pendingText({})).toBe('')
    expect(pendingText(undefined)).toBe('')
  })
})

describe('palette matching', () => {
  const items = [{ label: 'New tab', group: 'Tab' }, { label: 'Retry challenge', group: 'Challenge' }, { label: 'Theme: Dracula', group: 'Theme' }]
  it('matches letters in order', () => {
    expect(fuzzyScore('nt', 'New tab')).not.toBeNull()
    expect(fuzzyScore('zz', 'New tab')).toBeNull()
    expect(fuzzyScore('', 'x')).toBe(0)
  })
  it('keeps the order with no query and ranks tighter matches first', () => {
    expect(filterCommands(items, '').map((i) => i.label)).toEqual(['New tab', 'Retry challenge', 'Theme: Dracula'])
    expect(filterCommands(items, 'drac').map((i) => i.label)).toEqual(['Theme: Dracula'])
    expect(filterCommands(items, 'retry')[0].label).toBe('Retry challenge')
    expect(filterCommands(items, 'qqq')).toEqual([])
  })
})
