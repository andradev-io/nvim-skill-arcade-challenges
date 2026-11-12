import { describe, expect, it } from 'vitest'
import { check, linesEqual } from './compare'
import { keyCount, keyRank, tokens } from './keys'
import { replay } from './replay'
import { decodeDraft, encodeDraft, fileCommand } from './roomCode'
import { buildChallenge, EMPTY_FORM, unsafeSolution } from './schema'
import { checkpointsReached } from './track'
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
  it('jumps to a target via label when jump_targets are provided', () => {
    const targets = [
      { label: 'a', row: 1, col: 0 },
      { label: 'b', row: 1, col: 6 },
      { label: 'c', row: 2, col: 0 },
    ]
    const r = replay('hello world\nfoo bar', [1, 0], 'sb', [], 'text', targets)
    expect(r.cursor).toEqual([1, 6])
    expect(r.unsupported).toBeNull()
  })
  it('falls back to substitute when no jump_targets', () => {
    const r = replay('abc', [1, 0], 'sx<Esc>')
    expect(r.text).toBe('xbc')
  })
})

describe('replay surround', () => {
  it('ysiw) adds brackets around word', () => {
    const r = replay('value', [1, 2], 'ysiw)')
    expect(r.text).toBe('(value)')
    expect(r.unsupported).toBeNull()
  })
  it('ysiw( adds spaced brackets', () => {
    const r = replay('value', [1, 2], 'ysiw(')
    expect(r.text).toBe('( value )')
    expect(r.unsupported).toBeNull()
  })
  it('ysiw" adds quotes', () => {
    const r = replay('value', [1, 2], 'ysiw"')
    expect(r.text).toBe('"value"')
    expect(r.unsupported).toBeNull()
  })
  it('ysa)" surrounds including outer parens', () => {
    const r = replay('(value)', [1, 3], 'ysa)"')
    expect(r.text).toBe('"(value)"')
    expect(r.unsupported).toBeNull()
  })
  it('ds( deletes surrounding brackets', () => {
    const r = replay('(hello)', [1, 3], 'ds(')
    expect(r.text).toBe('hello')
    expect(r.unsupported).toBeNull()
  })
  it('ds" deletes surrounding quotes', () => {
    const r = replay('"hello"', [1, 3], 'ds"')
    expect(r.text).toBe('hello')
    expect(r.unsupported).toBeNull()
  })
  it('cs([ changes brackets to square brackets', () => {
    // cs([: change surrounding ( to [. '[' is SPACED so pairFor('[') adds padding.
    const r = replay('(hello)', [1, 3], 'cs([')
    expect(r.text).toBe('[ hello ]')
    expect(r.unsupported).toBeNull()
  })
  it('cs(" changes spaced parens to quotes', () => {
    // cs(": change surrounding ( to ". findSurround detects padding on '( hello )',
    // strips it during replacement. pairFor('"') returns unspaced quotes.
    const r = replay('( hello )', [1, 4], 'cs("')
    expect(r.text).toBe('"hello"')
    expect(r.unsupported).toBeNull()
  })
  it('yss) whole-line surround', () => {
    const r = replay('  hello', [1, 2], 'yss)')
    expect(r.text).toBe('  (hello)')
    expect(r.unsupported).toBeNull()
  })
  it('unsupported char reports unsupported', () => {
    const r = replay('value', [1, 2], 'ysiwt')
    expect(r.unsupported).toBeTruthy()
  })
  it('missing pair for ds reports unsupported', () => {
    const r = replay('hello', [1, 2], 'ds(')
    expect(r.unsupported).toBeTruthy()
  })
  it('count prefix on ys (ys2w))', () => {
    const r = replay('one two three', [1, 0], 'ys2w)')
    expect(r.text).toBe('(one two) three')
    expect(r.unsupported).toBeNull()
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

describe('track', () => {
  const base = { area: 'track', title: 'T', brief: 'b', why: 'w', solution: '$', text: 'S...X', crow: '1', ccol: '0' }
  it('derives expect from the goal and keeps the map', () => {
    const r = buildChallenge(form({ ...base, goalRow: '1', goalCol: '4' }))
    expect(r.errors).toEqual([])
    expect(r.data.track).toEqual({ goal: [1, 4] })
    expect(r.data.expect).toEqual({ text: 'S...X', cursor: [1, 4] })
  })
  it('applies the plugin schema rules', () => {
    const e = (patch: Partial<DraftForm>) => buildChallenge(form({ ...base, goalRow: '1', goalCol: '4', ...patch })).errors
    expect(e({ goalRow: '', goalCol: '' })).toContain('set the goal cell (row and column)')
    expect(e({ goalCol: '9' })).toContain('track goal is outside the map')
    expect(e({ checkpoints: '1:4' })).toContain('checkpoints must be different cells, none of them the goal')
    expect(e({ checkpoints: '1:9' })).toContain('checkpoint 1:9 is outside the map')
    expect(e({ checkpoints: 'x' })).toContain('checkpoints must look like 2:3, 4:5 (row:col)')
    expect(e({ checkpoints: '1:1, 1:2, 1:3, 1:1, 1:2, 1:3, 1:0' })).toContain('at most 6 checkpoints')
    expect(e({ goalCol: '0' })).toContain('the start cell is already the goal')
    expect(e({ goalCol: '0', checkpoints: '1:2' })).toEqual([])
    expect(e({ text: 'S…X' })).toContain('track maps must be plain ASCII (columns are bytes in Neovim)')
  })
  it('keeps the key rules', () => {
    const r = buildChallenge(form({ ...base, goalRow: '1', goalCol: '4', forbidHjkl: true, forbidMouse: true }))
    expect(r.data.track?.forbid).toEqual(['hjkl', 'mouse'])
  })
  it('replays % } marks search and records visited cells', () => {
    expect(replay('(~[~]~)~', [1, 0], '%').cursor).toEqual([1, 6])
    expect(replay('a\nb\n\nc\nd', [1, 0], '}j').cursor).toEqual([4, 0])
    expect(replay('a\nb\nc\nd\ne', [1, 0], 'maG`a').cursor).toEqual([1, 0])
    expect(replay('one two\nX here', [1, 0], '/X<CR>').cursor).toEqual([2, 0])
    expect(replay('a\n b\nc', [1, 0], '+').cursor).toEqual([2, 1])
    const r = replay('S .1. .2. X', [1, 0], 'f1f2fX')
    expect(r.visited).toEqual([[1, 0], [1, 3], [1, 7], [1, 10]])
  })
  it('judges checkpoints in order and flags forbidden keys', () => {
    const t = { goal: [1, 10] as [number, number], checkpoints: [[1, 3], [1, 7]] as [number, number][] }
    expect(checkpointsReached(t, replay('S .1. .2. X', [1, 0], 'f1f2fX').visited)).toBe(2)
    expect(checkpointsReached(t, replay('S .1. .2. X', [1, 0], 'f2f1').visited)).toBe(0)
    expect(replay('a\nb', [1, 0], 'j', ['hjkl']).blocked).toBe('j')
    expect(replay('a\nb', [1, 0], '2G', ['hjkl']).blocked).toBeNull()
    expect(replay('a j', [1, 0], 'fj', ['hjkl']).blocked).toBeNull()
  })
})

describe('replay comment', () => {
  it('gcc toggles current line (python)', () => {
    const r = replay('def greet():\n    print("hi")', [1, 0], 'gcc', [], 'python')
    expect(r.text).toBe('# def greet():\n    print("hi")')
    expect(r.unsupported).toBeNull()
  })
  it('gcc uncomments already-commented line', () => {
    const r = replay('# def greet():\n    print("hi")', [1, 0], 'gcc', [], 'python')
    expect(r.text).toBe('def greet():\n    print("hi")')
    expect(r.unsupported).toBeNull()
  })
  it('gcc defaults to # for unknown filetype', () => {
    const r = replay('hello world', [1, 0], 'gcc', [], 'unknown')
    expect(r.text).toBe('# hello world')
    expect(r.unsupported).toBeNull()
  })
  it('{n}gcc toggles n lines', () => {
    const r = replay('a\nb\nc\nd', [1, 0], '2gcc', [], 'python')
    expect(r.text).toBe('# a\n# b\nc\nd')
    expect(r.unsupported).toBeNull()
  })
  it('gcj toggles current and next line', () => {
    const r = replay('def greet():\n    print("hi")', [1, 0], 'gcj', [], 'python')
    expect(r.text).toBe('# def greet():\n#     print("hi")')
    expect(r.unsupported).toBeNull()
  })
  it('gc$ toggles single line (javascript //)', () => {
    const r = replay('const x = 1\nconst y = 2', [1, 0], 'gc$', [], 'javascript')
    expect(r.text).toBe('// const x = 1\nconst y = 2')
    expect(r.unsupported).toBeNull()
  })
  it('gcG toggles from cursor to end', () => {
    const r = replay('a\nb\nc', [2, 0], 'gcG', [], 'python')
    expect(r.text).toBe('a\n# b\n# c')
    expect(r.unsupported).toBeNull()
  })
  it('skips blank lines when commenting', () => {
    const r = replay('a\n\nb', [1, 0], '3gcc', [], 'python')
    expect(r.text).toBe('# a\n\n# b')
    expect(r.unsupported).toBeNull()
  })
  it('cursor lands on first non-blank after toggle', () => {
    const r = replay('  indented line', [1, 0], 'gcc', [], 'python')
    expect(r.cursor).toEqual([1, 2])
    expect(r.unsupported).toBeNull()
  })
})

describe('examples', () => {
  it('round trip through the form and pass the schema', async () => {
    const { EXAMPLES } = await import('../examples')
    const { challengeToForm } = await import('./schema')
    for (const ex of EXAMPLES) {
      const r = buildChallenge(challengeToForm(ex.challenge))
      expect(r.errors, ex.label).toEqual([])
      expect(r.data, ex.label).toEqual(ex.challenge)
    }
  })
  it('text examples reach their end state with the reference keys', async () => {
    const { EXAMPLES } = await import('../examples')
    for (const { challenge: c } of EXAMPLES) {
      if (c.expect.text === undefined) continue
      const res = replay(c.text, c.cursor, c.solution, [], c.ft ?? 'text')
      expect(res.unsupported, c.id).toBeNull()
      expect(check(c.expect, res).ok, c.id).toBe(true)
    }
  })
  it('track examples visit every checkpoint in order without forbidden keys', async () => {
    const { EXAMPLES } = await import('../examples')
    const tracks = EXAMPLES.filter((x) => x.challenge.track)
    expect(tracks.length).toBeGreaterThanOrEqual(3)
    for (const { challenge: c } of tracks) {
      const t = c.track!
      const res = replay(c.text, c.cursor, c.solution, t.forbid, c.ft ?? 'text')
      expect(res.unsupported, c.id).toBeNull()
      expect(res.blocked, c.id).toBeNull()
      expect(checkpointsReached(t, res.visited), c.id).toBe(t.checkpoints?.length ?? 0)
      expect(res.cursor, c.id).toEqual(t.goal)
    }
  })
})
