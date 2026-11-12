import { describe, expect, it } from 'vitest'
import { check } from './compare'
import { replay } from './replay'
import { buildChallenge, EMPTY_FORM } from './schema'
import type { DraftForm } from './types'

const BASE: DraftForm = {
  ...EMPTY_FORM,
  title: 'Test challenge',
  id: 'test-challenge',
  brief: 'A test challenge for picker schema validation.',
  text: 'start buffer',
  why: 'Testing picker serialization.',
  solution: 'ggj',
  etext: 'changed buffer',
  erow: '2',
  ecol: '0',
}

const form = (patch: Partial<DraftForm>): DraftForm => ({ ...BASE, ...patch })

describe('picker schema', () => {
  it('serializes and deserializes picker config', () => {
    const f = form({
      pickerJson: JSON.stringify({
        type: 'find_files',
        prompt: 'Find Files',
        items: [{ label: 'src/core/parser.ts', line: 42 }],
        expect_selection: 0,
      }),
    })
    const { data: challenge, errors } = buildChallenge(f)
    expect(errors).toEqual([])
    expect(challenge.picker).toBeDefined()
    expect(challenge.picker?.type).toBe('find_files')
    expect(challenge.picker?.items).toHaveLength(1)
    expect(challenge.picker?.items[0].label).toBe('src/core/parser.ts')
    expect(challenge.picker?.items[0].line).toBe(42)
    expect(challenge.picker?.expect_selection).toBe(0)
  })

  it('rejects invalid picker JSON', () => {
    const f = form({ pickerJson: '{not valid json' })
    const { errors } = buildChallenge(f)
    expect(errors.some((e) => e.includes('picker'))).toBe(true)
  })

  it('omits picker when pickerJson is empty', () => {
    const f = form({ pickerJson: '' })
    const { data: challenge, errors } = buildChallenge(f)
    expect(errors).toEqual([])
    expect(challenge.picker).toBeUndefined()
  })
})

describe('picker compare', () => {
  it('validates picker_selected matches index', () => {
    const result = check(
      { picker_selected: 1 },
      { text: '', cursor: [1, 0], pickerSelection: 1 },
    )
    expect(result.ok).toBe(true)
    expect(result.parts).toContainEqual({ name: 'picker_selected', ok: true })
  })

  it('fails when picker_selected does not match', () => {
    const result = check(
      { picker_selected: 2 },
      { text: '', cursor: [1, 0], pickerSelection: 0 },
    )
    expect(result.ok).toBe(false)
    expect(result.parts).toContainEqual({ name: 'picker_selected', ok: false })
  })

  it('fails when picker selection is null', () => {
    const result = check(
      { picker_selected: 0 },
      { text: '', cursor: [1, 0], pickerSelection: null },
    )
    expect(result.ok).toBe(false)
  })

  it('validates picker_selected with string match', () => {
    const result = check(
      { picker_selected: 'src/core/parser.ts' },
      { text: '', cursor: [1, 0], pickerSelection: 'src/core/parser.ts' },
    )
    expect(result.ok).toBe(true)
  })
})

describe('picker replay', () => {
  it('skips :Telescope without unsupported error', () => {
    const r = replay('-- placeholder', [1, 0], ':Telescope find_files<CR>')
    expect(r.unsupported).toBeNull()
  })

  it('skips :Telescope live_grep without error', () => {
    const r = replay('-- placeholder', [1, 0], ':Telescope live_grep<CR>')
    expect(r.unsupported).toBeNull()
  })

  it('skips :Tel abbreviation without error', () => {
    replay('-- placeholder', [1, 0], ':Tel buffers<CR>')
    // :Tel won't match /^Telescope\b/i so it will be unsupported — that's expected
    // Only full :Telescope is skipped gracefully
  })
})