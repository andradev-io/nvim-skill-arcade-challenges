import { describe, expect, it } from 'vitest'
import { check } from './compare'
import { scoreIdOf, shortName, toChallenge } from './builtin'
import type { BuiltinChallenge } from './builtin'

const sample: BuiltinChallenge = {
  id: 'refactor.ts-as-const',
  title: 'Freeze the literal',
  area: 'refactor',
  level: 1,
  ft: 'typescript',
  text: 'const dirs = ["up"];',
  cursor: [1, 0],
  brief: 'Add as const.',
  expect: { text: 'const dirs = ["up"] as const;' },
  solution: '$i as const<Esc>',
  why: 'why',
}

describe('built-in challenges in the Terminal', () => {
  it('sends ids the score service accepts', () => {
    const re = /^[a-z0-9][a-z0-9-]{0,63}$/
    expect(scoreIdOf(sample.id)).toBe('refactor-ts-as-const')
    expect(re.test(scoreIdOf(sample.id))).toBe(true)
    expect(re.test(scoreIdOf('track.' + 'x'.repeat(80)))).toBe(true)
  })

  it('names the buffer without the area', () => {
    expect(shortName(sample)).toBe('ts-as-const')
  })

  it('is judged only when the export carries an expected end state', () => {
    expect(toChallenge({ ...sample, expect: undefined })).toBeNull()
    expect(toChallenge(undefined)).toBeNull()
    const c = toChallenge(sample)
    expect(c).not.toBeNull()
    expect(check({ text: c!.expect.text }, { text: 'const dirs = ["up"] as const;', cursor: [1, 0] }).ok).toBe(true)
    expect(check({ text: c!.expect.text }, { text: 'const dirs = ["up"];', cursor: [1, 0] }).ok).toBe(false)
  })

  it('keeps a cursor-only expectation', () => {
    const c = toChallenge({ ...sample, expect: { cursor: [3, 2] } })
    expect(c?.expect.cursor).toEqual([3, 2])
    expect(c?.expect.text).toBeUndefined()
  })
})
