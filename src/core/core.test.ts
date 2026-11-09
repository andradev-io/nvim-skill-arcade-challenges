import { describe, expect, it } from 'vitest'
import { check, linesEqual } from './compare'
import { keyCount, keyRank, tokens } from './keys'
import { replay } from './replay'
import { decodeDraft, encodeDraft, fileCommand } from './roomCode'
import { buildChallenge, EMPTY_FORM, unsafeSolution } from './schema'
import type { DraftForm } from './types'

const form = (patch: Partial<DraftForm>): DraftForm => ({ ...EMPTY_FORM, ...patch })

describe('keys', () => {
  it('splits Vim notation', () => {
    expect(tokens('ci"x<Esc>')).toEqual(['c', 'i', '"', 'x', '<Esc>'])
    expect(keyCount('dwA <Esc>p')).toBe(6)
  })
  it('ranks by par', () => {
    expect(keyRank(5, 5)).toBe('S')
    expect(keyRank(7, 5)).toBe('A')
    expect(keyRank(10, 5)).toBe('B')
    expect(keyRank(11, 5)).toBe('C')
    expect(keyRank(3, 0)).toBe('')
  })
})

describe('compare', () => {
  it('ignores trailing spaces and blank lines', () => {
    expect(linesEqual('a  \nb\n\n', 'a\nb')).toBe(true)
    expect(linesEqual(' a', 'a')).toBe(false)
    expect(linesEqual(' a', 'a', true)).toBe(true)
  })
  it('checks text and cursor', () => {
    expect(check({ text: 'x', cursor: [1] }, { text: 'x', cursor: [1, 4] }).ok).toBe(true)
    expect(check({ cursor: [2, 0] }, { text: '', cursor: [2, 1] }).parts[0]).toEqual({ name: 'cursor', ok: false })
    expect(check({}, { text: '', cursor: [1, 0] }).ok).toBe(false)
  })
})

describe('replay', () => {
  it('changes inside quotes', () => {
    const r = replay('name = "old value here"', [1, 12], 'ci"new<Esc>')
    expect(r.text).toBe('name = "new"')
    expect(r.unsupported).toBeNull()
  })
  it('deletes a word and puts it back', () => {
    const r = replay('hello world', [1, 0], 'dwA <Esc>p')
    expect(linesEqual(r.text, 'world hello')).toBe(true)
  })
  it('handles substitute and counts', () => {
    expect(replay('a a a', [1, 0], ':s/a/b/g<CR>').text).toBe('b b b')
    expect(replay('a\nb\nc\nd', [1, 0], '2dd').text).toBe('c\nd')
  })
  it('reports keys it cannot run', () => {
    expect(replay('x', [1, 0], 'q').unsupported).toBe('q')
  })
})

describe('room code', () => {
  it('round trips a draft', () => {
    const { data, errors } = buildChallenge(
      form({ title: 'Swap', brief: 'b', text: 'hello world', etext: 'world hello', solution: 'dwA <Esc>p', why: 'w' }),
    )
    expect(errors).toEqual([])
    const code = encodeDraft(data)
    expect(code.startsWith('ARC1.')).toBe(true)
    expect(code).not.toMatch(/[+/=]/)
    expect(decodeDraft(code)).toEqual(data)
  })
  it('rejects a damaged code', () => {
    expect(decodeDraft('ARC1.@@@')).toBeNull()
    expect(decodeDraft('nope')).toBeNull()
  })
  it('escapes spaces in a file command', () => {
    expect(fileCommand('~/My Files/', 'x')).toBe(':ArcadeTry ~/My\\ Files/x.json')
  })
})

describe('schema', () => {
  it('blocks unsafe solutions', () => {
    expect(unsafeSolution(':!ls<CR>')).toMatch(/!/)
    expect(unsafeSolution(':lua print(1)<CR>')).toMatch(/lua/)
    expect(unsafeSolution('ddp|x')).toMatch(/\|/)
    expect(unsafeSolution('ci"x<Esc>')).toBeNull()
    expect(unsafeSolution(':%s/a/b/g<CR>')).toBeNull()
  })
  it('lists what is missing and derives the id', () => {
    const r = buildChallenge(form({ title: 'Swap two words' }))
    expect(r.data.id).toBe('swap-two-words')
    expect(r.errors).toContain('task description is required')
    expect(r.errors).toContain('set at least one expected end state')
  })
  it('rejects an already solved start', () => {
    const r = buildChallenge(form({ title: 'x', brief: 'b', text: 'a', etext: 'a', solution: 'x', why: 'w' }))
    expect(r.errors).toContain('expected text equals the start text: nothing to do')
  })
  it('flags a cursor outside the buffer and bad marks', () => {
    const r = buildChallenge(form({ title: 'x', text: 'a', crow: '3', marks: 'zz' }))
    expect(r.errors).toContain('cursor is outside the start buffer')
    expect(r.errors).toContain('marks must look like a=3,b=11')
  })
})
